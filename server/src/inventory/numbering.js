// Numbered IDs that restart every year: vendor profile IDs (VEN-YY-00001) and vendor invoice numbers (VSI-YY-00001).
import { pool } from '../db.js';
import { formatSeq, yearYY } from './pure.js';

const ensureCounters = () => pool.query('CREATE TABLE IF NOT EXISTS counters (name VARCHAR(30) PRIMARY KEY, v BIGINT NOT NULL)');

/** Next vendor profile ID: VEN-YY-00001. The number restarts at 00001 every year (YY = the year the vendor was added). */
export async function nextVendorCode(yy) {
  const prefix = `VEN-${yy}-`;
  await ensureCounters();
  await pool.query('INSERT IGNORE INTO counters (name, v) SELECT ?, COALESCE(MAX(CAST(SUBSTRING(code, ?) AS UNSIGNED)), 0) FROM field_vendors WHERE code LIKE ?', ['ven_' + yy, prefix.length + 1, prefix + '%']);
  const [r] = await pool.query('UPDATE counters SET v = LAST_INSERT_ID(v + 1) WHERE name = ?', ['ven_' + yy]);
  return formatSeq(prefix, r.insertId);
}

/** The vendor invoice number of a purchase: VSI-YY-00001, restarting every year (YY = the purchase year). `peek` shows the next one without using it. */
export async function nextInvoiceNo(yy, peek = false) {
  const prefix = `VSI-${yy}-`;
  const [[m]] = await pool.query('SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no, ?) AS UNSIGNED)), 0) n FROM stock_receipts WHERE invoice_no LIKE ?', [prefix.length + 1, prefix + '%']);
  await ensureCounters();
  if (peek) {
    const [[c]] = await pool.query('SELECT v FROM counters WHERE name = ?', ['vsi_' + yy]).then(r => (r[0].length ? r : [[{ v: 0 }]]));
    return formatSeq(prefix, Math.max(Number(m.n), Number(c.v)) + 1);
  }
  await pool.query('INSERT IGNORE INTO counters (name, v) VALUES (?, ?)', ['vsi_' + yy, Number(m.n)]);
  await pool.query('UPDATE counters SET v = GREATEST(v, ?) WHERE name = ?', [Number(m.n), 'vsi_' + yy]);
  const [r] = await pool.query('UPDATE counters SET v = LAST_INSERT_ID(v + 1) WHERE name = ?', ['vsi_' + yy]);
  return formatSeq(prefix, r.insertId);
}

/** Gives an ID to every vendor that has none (older ones, and those added by the field app), oldest first. */
export async function fillVendorCodes() {
  const [rows] = await pool.query("SELECT id, created_at FROM field_vendors WHERE code IS NULL OR code = '' ORDER BY created_at, id");
  for (const r of rows) await pool.query('UPDATE field_vendors SET code = ? WHERE id = ?', [await nextVendorCode(yearYY(r.created_at)), r.id]);
}
