// Price history: a MySQL trigger records every change of price, old price or sale end date of a product, whoever made it
// (admin, import, SQL). Stock is not recorded: it changes with every order.
import { pool } from '../db.js';
import { localYmd } from './priceRules.js';

export const TRIGGER_NAME = 'trg_products_price_history';
export const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS product_price_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  price_old INT NULL, price_new INT NULL, old_old INT NULL, old_new INT NULL, sale_ends_old DATE NULL, sale_ends_new DATE NULL,
  KEY idx_pph_product (product_id, at))`;
export const CREATE_TRIGGER_SQL = `CREATE TRIGGER ${TRIGGER_NAME} AFTER UPDATE ON products FOR EACH ROW
BEGIN
  IF NOT (OLD.price <=> NEW.price) OR NOT (OLD.old_price <=> NEW.old_price) OR NOT (OLD.sale_ends <=> NEW.sale_ends) THEN
    INSERT INTO product_price_history (product_id, price_old, price_new, old_old, old_new, sale_ends_old, sale_ends_new)
    VALUES (NEW.id, OLD.price, NEW.price, OLD.old_price, NEW.old_price, OLD.sale_ends, NEW.sale_ends);
  END IF;
END`;

let health = { trigger: null, error: '' };
let warned = false;
export const priceHistoryHealth = () => ({ ...health });

/** Creates the table and (only when missing) the trigger. Never throws: a failure is remembered for priceHistoryHealth(). */
export async function ensurePriceHistory(db = pool) {
  try {
    await db.query(CREATE_TABLE_SQL);
    const [r] = await db.query('SELECT 1 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ? LIMIT 1', [TRIGGER_NAME]);
    if (!r.length) await db.query(CREATE_TRIGGER_SQL);
    health = { trigger: true, error: '' };
  } catch (e) {
    health = { trigger: false, error: String(e.message || e).slice(0, 300) };
    if (!warned) { warned = true; console.warn('Price history trigger was not created (history is not recording):', health.error); }
  }
  return priceHistoryHealth();
}

const ymd = d => (d == null ? null : d instanceof Date ? localYmd(d) : String(d).slice(0, 10));
/** Newest first. `by` = the staff member whose Product audit row is within 15 seconds of the change (best effort, else null). */
export async function historyOf(productId, limit = 50, db = pool) {
  const n = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const [rows] = await db.query('SELECT id, at, price_old, price_new, old_old, old_new, sale_ends_old, sale_ends_new FROM product_price_history WHERE product_id = ? ORDER BY at DESC, id DESC LIMIT ?', [productId, n]);
  let audit = [];
  if (rows.length) {
    try {
      [audit] = await db.query("SELECT at, staff_name FROM audit_log WHERE ((entity = 'Product' AND entity_id = ?) OR (? <> '' AND entity = 'Growth' AND path LIKE '%/growth/prices/%' AND path NOT LIKE '%/history')) AND method IN ('PUT','POST','PATCH') AND ok = 1 AND at >= ? AND at <= ? ORDER BY at",
        [String(productId), String(productId), new Date(new Date(rows[rows.length - 1].at).getTime() - 15000), new Date(new Date(rows[0].at).getTime() + 15000)]);
    } catch { audit = []; }
  }
  return rows.map(r => {
    const t = new Date(r.at).getTime();
    let best = null, gap = 15001;
    for (const a of audit) { const g = Math.abs(new Date(a.at).getTime() - t); if (g <= 15000 && g < gap) { gap = g; best = a.staff_name; } }
    return { at: r.at, priceOld: r.price_old, priceNew: r.price_new, oldOld: r.old_old, oldNew: r.old_new, saleEndsOld: ymd(r.sale_ends_old), saleEndsNew: ymd(r.sale_ends_new), by: best || null };
  });
}
