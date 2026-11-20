// Product columns for the YouTube video tools (Phase 6). ensureVideoColumns() is called from migrate.js; idempotent.
import { pool } from '../db.js';

export const VIDEO_COLUMNS = [
  ['video_url', "VARCHAR(200) NOT NULL DEFAULT ''"],
  ['video_title', "VARCHAR(120) NOT NULL DEFAULT ''"],
  ['video_date', 'DATE NULL']
];

/** Adds the missing products columns, one ALTER each. db: anything with query(sql) (default: the pool). Returns the names added. */
export async function ensureVideoColumns(db = pool) {
  const [cols] = await db.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'");
  if (!cols.length) return [];
  const have = new Set(cols.map(r => r.c));
  const added = [];
  for (const [c, def] of VIDEO_COLUMNS) {
    if (have.has(c)) continue;
    await db.query(`ALTER TABLE products ADD COLUMN ${c} ${def}`);
    console.log('Added products.' + c);
    added.push(c);
  }
  return added;
}
