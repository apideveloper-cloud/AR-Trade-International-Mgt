// Backups: the whole database AND the uploads folder (product images, CVs, vouchers), each an automatic copy every 6 hours plus a manual
// "Back up now" from the admin console. Copies older than 7 days are deleted automatically to keep the disk tidy (the newest copy of each
// kind is always kept).
//  - database: plain-Node dump (no mysqldump needed) of every table in one consistent snapshot, gzip-compressed (.sql.gz)
//  - uploads : a gzip tar (.tar.gz) of server/uploads; an automatic run is skipped when no file changed since the last copy
// Files live in server/backups/ (never served over the web) and every run is recorded in the backup_log table.
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import * as tar from 'tar';
import { pool } from './db.js';
import { fail } from './util.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DIR = path.resolve(here, '../backups');
let curDir = DEFAULT_DIR; // where NEW backups go; the Master Admin can change it (copies already made stay where they were made)
const UPLOADS = path.resolve(here, '../uploads');
export const INTERVAL_H = Math.max(1, Number(process.env.BACKUP_EVERY_HOURS) || 6);
export const KEEP_DAYS = Math.max(1, Number(process.env.BACKUP_KEEP_DAYS) || 7);
const SKIP = new Set(['backup_log', 'rate_hits']); // the log itself and throw-away counters are not worth saving
const BATCH = 500;
const NAME = /^ar-(backup|uploads)-[\w-]+\.(sql|tar)\.gz$/;
const SCOPES = ['db', 'files'];

let running = null; // 'db' | 'files' | null
let lastSkip = { files: 0 }; // when an automatic uploads run last found nothing new
export const backupDir = () => curDir;
export const isRunning = () => running;
// live progress of the run in flight, shown as a percentage bar on the Backups page
let prog = null;
const setProg = (pct, phase) => { if (prog) { prog.pct = Math.max(prog.pct, Math.min(100, Math.round(pct))); prog.phase = phase; } };

export async function ensureBackupTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scope ENUM('db','files') NOT NULL DEFAULT 'db',
    file VARCHAR(120) NOT NULL,
    kind ENUM('auto','manual') NOT NULL,
    status ENUM('Running','Done','Failed') NOT NULL DEFAULT 'Running',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    tables_n INT NOT NULL DEFAULT 0,
    rows_n BIGINT NOT NULL DEFAULT 0,
    sig VARCHAR(80) NOT NULL DEFAULT '',
    ms INT NOT NULL DEFAULT 0,
    error VARCHAR(300) NOT NULL DEFAULT '',
    by_name VARCHAR(120) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_scope_kind_created (scope, kind, created_at)
  )`);
  await pool.query('CREATE TABLE IF NOT EXISTS backup_config (k VARCHAR(40) PRIMARY KEY, v VARCHAR(500) NOT NULL)'); // not the public settings table: a server path must never leave the admin API
  const [cols] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'backup_log'");
  const have = new Set(cols.map(r => r.c));
  if (!have.has('scope')) await pool.query("ALTER TABLE backup_log ADD COLUMN scope ENUM('db','files') NOT NULL DEFAULT 'db' AFTER id");
  if (!have.has('dir')) await pool.query("ALTER TABLE backup_log ADD COLUMN dir VARCHAR(500) NOT NULL DEFAULT '' AFTER file");
  if (!have.has('sig')) await pool.query("ALTER TABLE backup_log ADD COLUMN sig VARCHAR(80) NOT NULL DEFAULT '' AFTER rows_n");
  const [[cfg]] = await pool.query("SELECT v FROM backup_config WHERE k = 'dir'").then(r => (r[0].length ? r : [[null]]));
  if (cfg?.v) curDir = cfg.v;
  await pool.query("UPDATE backup_log SET status = 'Failed', error = 'The server stopped while this backup was running' WHERE status = 'Running' AND created_at < (NOW() - INTERVAL 30 MINUTE)");
}

const stamp = () => {
  const d = new Date(Date.now() + 6 * 3600e3); // Bangladesh time in the file name
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
};

/* ---------------------------------------------------------------- database ---------------------------------------------------------------- */

/** Writes the whole database to `file` (gzip). Resolves to { tables, rows }. */
async function dumpDb(file) {
  const conn = await pool.getConnection();
  const gz = zlib.createGzip({ level: 6 });
  const ws = fs.createWriteStream(file);
  const done = new Promise((res, rej) => { ws.on('finish', res); ws.on('error', rej); gz.on('error', rej); });
  gz.pipe(ws);
  const put = async s => { if (!gz.write(s)) await once(gz, 'drain'); };
  let tables = 0, rows = 0;
  try {
    await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT'); // one moment in time for every table
    const [[db]] = await conn.query('SELECT DATABASE() d');
    await put(`-- AR Trade International database backup\n-- Database: ${db.d}\n-- Started: ${new Date().toISOString()}\n`);
    await put("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n");
    const [list] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const names = list.map(r => Object.values(r)[0]).filter(n => !SKIP.has(n)).sort();
    let total = 0; // exact row count first (inside the same snapshot), so the percentage is real
    for (const t of names) { const [[n]] = await conn.query(`SELECT COUNT(*) n FROM ${mysql.escapeId(t)}`); total += Number(n.n); }
    total = Math.max(total, 1);
    for (const t of names) {
      const id = mysql.escapeId(t);
      setProg(2 + (rows / total) * 90, 'Saving table ' + t);
      const [[c]] = await conn.query(`SHOW CREATE TABLE ${id}`);
      await put(`-- Table ${t}\nDROP TABLE IF EXISTS ${id};\n${c['Create Table']};\n`);
      const [pk] = await conn.query("SELECT COLUMN_NAME c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION", [t]);
      const order = pk.length ? ' ORDER BY ' + pk.map(p => mysql.escapeId(p.c)).join(', ') : '';
      for (let off = 0; ; off += BATCH) {
        const [data, fields] = await conn.query({ sql: `SELECT * FROM ${id}${order} LIMIT ${BATCH} OFFSET ${off}`, dateStrings: true, typeCast: (f, next) => (f.type === 'JSON' ? f.string() : next()) });
        if (!data.length) break;
        const cols = fields.map(f => mysql.escapeId(f.name)).join(', ');
        await put(`INSERT INTO ${id} (${cols}) VALUES\n${data.map(r => '(' + fields.map(f => mysql.escape(r[f.name])).join(',') + ')').join(',\n')};\n`);
        rows += data.length;
        setProg(2 + (rows / total) * 90, 'Saving table ' + t);
        if (data.length < BATCH) break;
      }
      await put('\n');
      tables++;
    }
    await conn.query('COMMIT');
    await put(`SET FOREIGN_KEY_CHECKS=1;\nSET UNIQUE_CHECKS=1;\n-- Dump completed on ${new Date().toISOString()} (${tables} tables, ${rows} rows)\n`);
  } catch (e) {
    try { await conn.query('ROLLBACK'); } catch { /* connection already gone */ }
    gz.destroy();
    throw e;
  } finally {
    conn.release();
  }
  gz.end();
  await done;
  return { tables, rows };
}

/** A finished database copy must unzip cleanly and end with the "Dump completed" line. */
async function verifyDb(file) {
  setProg(94, 'Checking the file');
  let tail = '';
  await new Promise((res, rej) => {
    fs.createReadStream(file).pipe(zlib.createGunzip()).on('data', d => { tail = (tail + d.toString('utf8')).slice(-400); }).on('end', res).on('error', rej);
  });
  if (!/-- Dump completed on /.test(tail)) throw new Error('The backup file is incomplete');
}

/* ----------------------------------------------------------------- uploads ---------------------------------------------------------------- */

/** Walks the uploads folder: how many files, how many bytes, and the newest change. The three together say "has anything changed?". */
async function scanUploads() {
  let n = 0, bytes = 0, newest = 0;
  const walk = async dir => {
    for (const e of await fs.promises.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) { const s = await fs.promises.stat(p); n++; bytes += s.size; if (s.mtimeMs > newest) newest = s.mtimeMs; }
    }
  };
  if (fs.existsSync(UPLOADS)) await walk(UPLOADS);
  return { n, bytes, sig: `${n}:${bytes}:${Math.round(newest)}` };
}

async function verifyTar(file, minFiles) {
  let entries = 0;
  await tar.t({ file, onReadEntry: () => { entries++; } });
  if (entries < minFiles) throw new Error('The uploads archive is incomplete');
}

/* ----------------------------------------------------------------- shared ----------------------------------------------------------------- */

const dirOf = r => r.dir || DEFAULT_DIR; // a row with no folder was made in the default one
const removeFile = async (f, dir = DEFAULT_DIR) => { if (NAME.test(f)) await fs.promises.rm(path.join(dir, f), { force: true }); };

/** Master Admin: where new backups are written. Must be an absolute path the server can write to, and never inside the uploads folder or the program's own files. */
export async function setDir(input) {
  const raw = String(input || '').trim();
  if (!raw) throw fail(400, 'Enter a folder path');
  if (raw.length > 400 || /[\0\r\n]/.test(raw)) throw fail(400, 'That path is not valid');
  if (!path.isAbsolute(raw)) throw fail(400, 'Use a full path, for example D:\\Backups\\AR or /var/backups/artrade');
  const dir = path.resolve(raw);
  const inside = (p, root) => { const r = path.relative(root, p); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
  const app = path.resolve(here, '..');
  if (inside(dir, UPLOADS)) throw fail(400, 'The backup folder cannot be inside the uploads folder (the uploads backup would copy itself)');
  if (inside(dir, path.join(app, 'src')) || inside(dir, path.join(app, 'node_modules')) || inside(dir, path.resolve(app, '../client'))) throw fail(400, 'Choose a folder outside the program files');
  if (running) throw fail(409, 'A backup is running. Change the folder after it finishes.');
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    const probe = path.join(dir, '.write-test-' + process.pid);
    await fs.promises.writeFile(probe, 'ok'); await fs.promises.rm(probe, { force: true });
  } catch (e) { throw fail(400, 'The server cannot write to that folder (' + (e.code || 'error') + '). Check the path and permissions.'); }
  await pool.query("INSERT INTO backup_config (k, v) VALUES ('dir', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [dir]);
  curDir = dir;
  return dir;
}

/** Copies older than KEEP_DAYS go (the newest finished copy of each kind always stays); failed runs go after a week. */
export async function prune() {
  let removed = 0;
  for (const scope of SCOPES) for (const kind of ['auto', 'manual']) {
    const [[keep]] = await pool.query("SELECT id FROM backup_log WHERE scope = ? AND kind = ? AND status = 'Done' ORDER BY created_at DESC, id DESC LIMIT 1", [scope, kind]);
    const [old] = await pool.query("SELECT id, file, dir FROM backup_log WHERE scope = ? AND kind = ? AND status = 'Done' AND created_at < (NOW() - INTERVAL ? DAY) AND id <> ?", [scope, kind, KEEP_DAYS, keep?.id || 0]);
    for (const o of old) { await removeFile(o.file, dirOf(o)); await pool.query('DELETE FROM backup_log WHERE id = ?', [o.id]); removed++; }
  }
  const [bad] = await pool.query("SELECT id, file, dir FROM backup_log WHERE status = 'Failed' AND created_at < (NOW() - INTERVAL ? DAY)", [KEEP_DAYS]);
  for (const o of bad) { await removeFile(o.file, dirOf(o)); await pool.query('DELETE FROM backup_log WHERE id = ?', [o.id]); removed++; }
  // files in the folder that the log no longer knows (an old run that crashed half way) are tidied up too
  const [known] = await pool.query('SELECT file FROM backup_log');
  const set = new Set(known.map(k => k.file));
  for (const dir of new Set([curDir, DEFAULT_DIR])) if (fs.existsSync(dir)) {
    for (const f of await fs.promises.readdir(dir)) {
      const full = path.join(dir, f);
      const age = Date.now() - (await fs.promises.stat(full)).mtimeMs;
      if ((f.endsWith('.part') && age > 3600e3) || (NAME.test(f) && !set.has(f) && age > KEEP_DAYS * 864e5)) await fs.promises.rm(full, { force: true });
    }
  }
  return removed;
}

/** Makes one backup now. scope 'db' or 'files'; kind 'auto' (scheduler) or 'manual' (a person pressed the button). */
export async function runBackup(scope, kind, by = '') {
  if (!SCOPES.includes(scope)) throw fail(400, 'Unknown backup type');
  if (running) throw fail(409, `A ${running === 'db' ? 'database' : 'uploads'} backup is already running. Please wait for it to finish.`);
  running = scope;
  prog = { scope, kind, pct: 0, phase: 'Starting', startedAt: Date.now() };
  const dir = curDir;
  const file = scope === 'db' ? `ar-backup-${stamp()}-${kind}.sql.gz` : `ar-uploads-${stamp()}-${kind}.tar.gz`;
  const t0 = Date.now();
  let logId = null;
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    let scan = null;
    if (scope === 'files') {
      scan = await scanUploads();
      if (kind === 'auto') { // nothing new since the last copy: do not waste disk on an identical archive
        const [[last]] = await pool.query("SELECT sig FROM backup_log WHERE scope = 'files' AND status = 'Done' ORDER BY created_at DESC, id DESC LIMIT 1");
        if (last && last.sig === scan.sig) { lastSkip.files = Date.now(); return null; }
      }
    }
    const [r] = await pool.query('INSERT INTO backup_log (scope, file, dir, kind, status, by_name) VALUES (?,?,?,?,?,?)', [scope, file, dir === DEFAULT_DIR ? '' : dir, kind, 'Running', by || (kind === 'auto' ? 'Automatic' : '')]);
    logId = r.insertId;
    const full = path.join(dir, file);
    let tables = 0, rows = 0;
    if (scope === 'db') {
      ({ tables, rows } = await dumpDb(full + '.part'));
      await verifyDb(full + '.part');
    } else {
      let doneBytes = 0;
      setProg(2, 'Packing uploaded files');
      await tar.c({ gzip: { level: 6 }, file: full + '.part', cwd: UPLOADS, portable: true, filter: (p, st) => { doneBytes += Number(st?.size) || 0; setProg(2 + (doneBytes / Math.max(scan.bytes, 1)) * 90, 'Packing uploaded files'); return true; } }, ['.']);
      setProg(94, 'Checking the archive');
      await verifyTar(full + '.part', scan.n);
      rows = scan.n;
    }
    await fs.promises.rename(full + '.part', full);
    setProg(98, 'Finishing');
    const size = (await fs.promises.stat(full)).size;
    await pool.query("UPDATE backup_log SET status = 'Done', size_bytes = ?, tables_n = ?, rows_n = ?, sig = ?, ms = ? WHERE id = ?", [size, tables, rows, scan?.sig || '', Date.now() - t0, logId]);
    await prune().catch(e => console.error('backup prune:', e.message));
    return (await list()).find(x => x.id === logId);
  } catch (e) {
    await fs.promises.rm(path.join(dir, file + '.part'), { force: true }).catch(() => {});
    if (logId) await pool.query("UPDATE backup_log SET status = 'Failed', error = ?, ms = ? WHERE id = ?", [String(e.message || e).slice(0, 300), Date.now() - t0, logId]).catch(() => {});
    console.error(`[backup] ${scope} ${kind} backup failed:`, e.message);
    throw e.status ? e : fail(500, 'The backup failed: ' + String(e.message || e).slice(0, 160));
  } finally {
    running = null;
    prog = null;
  }
}

export async function list() {
  const [rows] = await pool.query('SELECT id, scope, file, dir, kind, status, size_bytes, tables_n, rows_n, ms, error, by_name, created_at FROM backup_log ORDER BY created_at DESC, id DESC LIMIT 400');
  return rows.map(r => ({ id: r.id, scope: r.scope, file: r.file, kind: r.kind, status: r.status, size: Number(r.size_bytes), tables: r.tables_n, rows: Number(r.rows_n), ms: r.ms, error: r.error, by: r.by_name, at: r.created_at, exists: r.status === 'Done' && NAME.test(r.file) && fs.existsSync(path.join(dirOf(r), r.file)) }));
}

export async function status() {
  const items = await list();
  const per = {};
  for (const s of SCOPES) {
    const lastAuto = items.find(i => i.scope === s && i.kind === 'auto' && i.status === 'Done');
    const lastDone = items.find(i => i.scope === s && i.status === 'Done');
    const base = Math.max(lastAuto ? new Date(lastAuto.at).getTime() : 0, s === 'files' ? lastSkip.files : 0);
    const next = base ? new Date(base + INTERVAL_H * 3600e3) : new Date();
    per[s] = { last: lastDone?.at || null, lastKind: lastDone?.kind || null, lastSize: lastDone?.size || 0, nextAuto: next < new Date() ? new Date() : next, copies: items.filter(i => i.scope === s && i.exists).length, bytes: items.filter(i => i.scope === s && i.exists).reduce((t, i) => t + i.size, 0), unchangedAt: s === 'files' && lastSkip.files ? new Date(lastSkip.files) : null };
  }
  return { deleteCodeSet: await hasDeleteCode(), intervalHours: INTERVAL_H, keepDays: KEEP_DAYS, running, progress: prog ? { scope: prog.scope, kind: prog.kind, pct: prog.pct, phase: prog.phase, seconds: Math.round((Date.now() - prog.startedAt) / 1000) } : null, scopes: per, totalBytes: per.db.bytes + per.files.bytes, dir: curDir, defaultDir: DEFAULT_DIR, items };
}

export async function fileOf(id) {
  const [[r]] = await pool.query('SELECT file, dir, status FROM backup_log WHERE id = ?', [id]);
  if (!r || r.status !== 'Done' || !NAME.test(r.file)) throw fail(404, 'Backup not found');
  const full = path.join(dirOf(r), r.file);
  if (!fs.existsSync(full)) throw fail(404, 'The backup file is no longer on the server');
  return { full, name: r.file };
}

// ---------- the delete code ----------
// Deleting a backup cannot be undone, so it needs a code the Master Admin chose (kept only as a bcrypt hash in backup_config).
// Five wrong tries in ten minutes lock deleting for ten minutes.
const WRONG = { n: 0, since: 0, until: 0 };
async function storedCodeHash() {
  const [[r]] = await pool.query("SELECT v FROM backup_config WHERE k = 'delete_code'").then(x => (x[0].length ? x : [[null]]));
  return r?.v || '';
}
export const hasDeleteCode = async () => !!(await storedCodeHash());
async function checkDeleteCode(code) {
  const hash = await storedCodeHash();
  if (!hash) throw fail(409, 'Set a delete code first (Backups > Delete code). Without one nothing can be deleted.');
  if (Date.now() < WRONG.until) throw fail(429, `Too many wrong codes. Try again in ${Math.ceil((WRONG.until - Date.now()) / 60000)} minutes.`);
  if (await bcrypt.compare(String(code || ''), hash)) { WRONG.n = 0; return; }
  if (Date.now() - WRONG.since > 600000) { WRONG.n = 0; WRONG.since = Date.now(); }
  if (++WRONG.n >= 5) { WRONG.until = Date.now() + 600000; WRONG.n = 0; throw fail(429, 'Too many wrong codes. Deleting is locked for 10 minutes.'); }
  throw fail(403, 'That delete code is not right.');
}
/** Sets or changes the delete code. Changing an existing code needs the current one. */
export async function setDeleteCode(code, current) {
  const next = String(code || '');
  if (next.length < 6 || next.length > 60) throw fail(400, 'The delete code must be 6 to 60 characters.');
  if (await hasDeleteCode()) await checkDeleteCode(current);
  await pool.query("INSERT INTO backup_config (k, v) VALUES ('delete_code', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [await bcrypt.hash(next, 10)]);
}

export async function deleteBackup(id, code) {
  await checkDeleteCode(code);
  const [[r]] = await pool.query('SELECT file, dir, status FROM backup_log WHERE id = ?', [id]);
  if (!r) throw fail(404, 'Backup not found');
  if (r.status === 'Running') throw fail(409, 'This backup is still running');
  await removeFile(r.file, dirOf(r));
  await pool.query('DELETE FROM backup_log WHERE id = ?', [id]);
}

/** Every few minutes: is a copy older than the interval? Make one (database first, then the uploads). Once an hour: delete copies older than 7 days. */
export function startBackupSchedule() {
  let lastPrune = 0;
  const due = async scope => {
    const [[r]] = await pool.query("SELECT TIMESTAMPDIFF(MINUTE, MAX(created_at), NOW()) m FROM backup_log WHERE scope = ? AND kind = 'auto' AND status = 'Done'", [scope]);
    const sinceSkip = scope === 'files' && lastSkip.files ? (Date.now() - lastSkip.files) / 60000 : Infinity;
    return Math.min(r.m === null ? Infinity : r.m, sinceSkip) >= INTERVAL_H * 60;
  };
  const tick = async () => {
    try {
      if (running) return;
      for (const scope of SCOPES) {
        if (running || !(await due(scope))) continue;
        console.log(`[backup] automatic ${scope === 'db' ? 'database' : 'uploads'} backup (every ${INTERVAL_H} h)`);
        await runBackup(scope, 'auto').catch(e => console.error(`[backup] ${scope}:`, e.message));
      }
      if (Date.now() - lastPrune > 3600e3) { lastPrune = Date.now(); const n = await prune(); if (n) console.log(`[backup] removed ${n} copies older than ${KEEP_DAYS} days`); }
    } catch (e) { console.error('[backup] schedule:', e.message); }
  };
  setTimeout(tick, 90 * 1000).unref(); // shortly after start, so a restart never skips a due backup
  setInterval(tick, 5 * 60 * 1000).unref();
}
