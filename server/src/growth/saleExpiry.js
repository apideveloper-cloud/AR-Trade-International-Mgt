// Sale expiry: when a sale end date has passed, the sale price is cleared (old price 0, end date empty) and the current price stays.
import { pool } from '../db.js';
import { noteCatalogChange } from './changeHooks.js';
import { dhakaToday } from './priceRules.js';

const run = async (sql, params) => { const [r] = await pool.query(sql, params); return r; };

/** @returns {Promise<number[]>} ids of the products whose sale ended. now / query / note can be injected for tests. */
export async function expireSales({ now = Date.now(), query = run, note = noteCatalogChange } = {}) {
  const today = dhakaToday(now);
  const rows = await query('SELECT id FROM products WHERE sale_ends IS NOT NULL AND sale_ends < ?', [today]);
  const ids = (rows || []).map(r => r.id);
  if (!ids.length) return [];
  await query('UPDATE products SET old_price = 0, sale_ends = NULL WHERE sale_ends IS NOT NULL AND sale_ends < ?', [today]);
  note({ productIds: ids, reason: 'sale_expired' });
  return ids;
}
