// Self-migrating schema for the field app. Runs once when the API starts (see field.js) and is safe to run on every start.
//   core tables        -> this file
//   module tables      -> src/field/sql/*.sql   (CREATE TABLE IF NOT EXISTS ...; statements split on ";" + newline)
//   demo / sample data -> src/field/seed/*.js   (export default async function seed({ pool, bcrypt }))
// Demo seeds are skipped when NODE_ENV=production or FIELD_SEED_DEMO=0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, addColumn } from './common.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const CORE = [
  `CREATE TABLE IF NOT EXISTS field_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    icon VARCHAR(40) NOT NULL DEFAULT 'notifications',
    title VARCHAR(160) NOT NULL,
    sub VARCHAR(255) NOT NULL DEFAULT '',
    body TEXT NULL,
    cat ENUM('Approvals','Alerts','Updates') NOT NULL DEFAULT 'Updates',
    rows_json JSON NULL,
    a1 VARCHAR(60) NOT NULL DEFAULT '',
    a1_icon VARCHAR(40) NOT NULL DEFAULT '',
    a2 VARCHAR(60) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL DEFAULT NULL,
    KEY idx_staff (staff_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS field_reset_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    code_hash CHAR(64) NOT NULL,
    via VARCHAR(10) NOT NULL DEFAULT 'sms',
    attempts TINYINT NOT NULL DEFAULT 0,
    used TINYINT(1) NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_staff (staff_id, id)
  )`
];

let ready;
/** Applies the schema once per process. Never throws: a broken migration is logged and the API still starts. */
export function ensureFieldSchema() {
  ready ||= run().catch(e => console.error('[field] schema setup failed:', e));
  return ready;
}

const splitSql = text => text.split(/;\s*\n/).map(s => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);

async function run() {
  // staff.employee_code (ART-0247 style) used for sign-in
  await addColumn('staff', 'employee_code', 'VARCHAR(20) NULL');
  await pool.query("UPDATE staff SET employee_code = CONCAT('ART-', LPAD(id, 4, '0')) WHERE employee_code IS NULL OR employee_code = ''");
  const [[ix]] = await pool.query("SELECT COUNT(*) n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND INDEX_NAME = 'uq_employee_code'");
  if (!ix.n) await pool.query('ALTER TABLE staff ADD UNIQUE KEY uq_employee_code (employee_code)');

  for (const sql of CORE) await pool.query(sql);

  // expense claims: remarks on approve / reject
  await addColumn('field_expenses', 'remarks', "VARCHAR(255) NOT NULL DEFAULT ''");

  const sqlDir = path.join(here, 'sql');
  if (fs.existsSync(sqlDir)) {
    for (const f of fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort()) {
      for (const stmt of splitSql(fs.readFileSync(path.join(sqlDir, f), 'utf8'))) {
        try { await pool.query(stmt); } catch (e) { console.error(`[field] ${f}: ${e.message}\n  ${stmt.slice(0, 100)}`); }
      }
    }
  }

  if (process.env.NODE_ENV === 'production' || process.env.FIELD_SEED_DEMO === '0') return;
  const seedDir = path.join(here, 'seed');
  if (fs.existsSync(seedDir)) {
    for (const f of fs.readdirSync(seedDir).filter(f => f.endsWith('.js')).sort()) {
      try {
        const m = await import(pathToFileURL(path.join(seedDir, f)).href);
        await m.default({ pool, bcrypt });
      } catch (e) { console.error(`[field] seed ${f} failed: ${e.message}`); }
    }
  }
}

// `node src/field/migrate.js` runs it by hand and exits
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await ensureFieldSchema();
  console.log('field schema ready');
  await pool.end();
}
