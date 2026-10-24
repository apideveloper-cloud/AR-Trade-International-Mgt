// Small, safe schema upgrades that run on every server start (each one only acts when something is missing).
import { pool } from './db.js';

const STAFF_COLS = [['nid', 'VARCHAR(20)'], ['present_address', 'VARCHAR(300)'], ['contact_address', 'VARCHAR(300)'], ['ref_name', 'VARCHAR(120)'], ['ref_phone', 'VARCHAR(20)']];

export async function ensureSchema() {
  const [sc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff'");
  if (sc.length) {
    const have = new Set(sc.map(r => r.c));
    for (const [c, def] of STAFF_COLS) if (!have.has(c)) { await pool.query(`ALTER TABLE staff ADD COLUMN ${c} ${def} NOT NULL DEFAULT ''`); console.log('Added staff.' + c); }
  }
  const [cols] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories'");
  if (cols.length && !cols.some(r => r.c === 'img')) {
    await pool.query('ALTER TABLE categories ADD COLUMN img VARCHAR(500) NULL');
    console.log('Added categories.img (category pictures)');
  }
  // contact-form messages are worked through in the admin Inbox: a status, a private note and who handled it
  const [mc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages'");
  if (mc.length) {
    const have = new Set(mc.map(r => r.c));
    for (const [c, def] of [['status', "VARCHAR(12) NOT NULL DEFAULT 'New'"], ['note', "VARCHAR(1000) NOT NULL DEFAULT ''"], ['handled_by', "VARCHAR(120) NOT NULL DEFAULT ''"], ['handled_at', 'TIMESTAMP NULL']]) {
      if (!have.has(c)) { await pool.query(`ALTER TABLE messages ADD COLUMN ${c} ${def}`); console.log('Added messages.' + c); }
    }
  }
}
