// Product columns for the Merchant Center tools (Phase 4). ensureMerchantColumns() is called from migrate.js; idempotent.
import { pool } from '../db.js';

export const MERCHANT_COLUMNS = [
  ['merchant_exclude', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['item_group_id', "VARCHAR(50) NOT NULL DEFAULT ''"],
  ['google_category', "VARCHAR(250) NOT NULL DEFAULT ''"]
];

/** Adds the missing products columns, one ALTER each. db: anything with query(sql) (default: the pool). Returns the names added. */
export async function ensureMerchantColumns(db = pool) {
  const [cols] = await db.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'");
  if (!cols.length) return [];
  const have = new Set(cols.map(r => r.c));
  const added = [];
  for (const [c, def] of MERCHANT_COLUMNS) {
    if (have.has(c)) continue;
    await db.query(`ALTER TABLE products ADD COLUMN ${c} ${def}`);
    console.log('Added products.' + c);
    added.push(c);
  }
  return added;
}
