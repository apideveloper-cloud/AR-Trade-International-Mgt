// Database helpers shared by the inventory route modules.
import { fail, text } from '../util.js';
import { pageOf, wantsPage } from '../listing.js';
import { normalizeLines, checkLines } from './pure.js';

/** Changes one product's stock by delta (never below zero) and records the movement. */
export async function move(conn, { productId, delta, kind, ref, note, cost = null, by }) {
  const [[p]] = await conn.query('SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE', [productId]);
  if (!p) throw fail(400, 'A product on the list no longer exists');
  const next = p.stock + delta;
  if (next < 0) throw fail(409, `Only ${p.stock} of "${p.name}" in stock, so ${-delta} cannot be taken out`);
  await conn.query('UPDATE products SET stock = ? WHERE id = ?', [next, p.id]);
  await conn.query('INSERT INTO stock_moves (product_id, kind, qty, unit_cost, balance, ref, note, staff_name) VALUES (?,?,?,?,?,?,?,?)', [p.id, kind, delta, cost, next, ref || '', text(note, 300), by]);
  return p;
}

/** Validates posted lines: [{ productId, qty, unitCost }] -> clean list with product names. */
export async function cleanLines(conn, raw, { needCost = true } = {}) {
  const lines = normalizeLines(raw);
  checkLines(lines, needCost);
  const [rows] = await conn.query('SELECT id, name FROM products WHERE id IN (?)', [lines.map(l => l.productId)]);
  return lines.map(l => { const p = rows.find(r => r.id === l.productId); if (!p) throw fail(400, 'A product on the list no longer exists'); return { ...l, name: p.name }; });
}

/** Loads the vendor chosen in a form, or throws 400. */
export async function vendorOf(conn, id) {
  const [[v]] = await conn.query('SELECT id, name FROM field_vendors WHERE id = ?', [parseInt(id, 10)]);
  if (!v) throw fail(400, 'Choose a vendor first');
  return v;
}

/** Adds "col = vendor" to a filter when ?vendor= is a valid id. */
export function addVendorFilter(cond, args, col, req) {
  const vendor = parseInt(req.query.vendor, 10);
  if (vendor) { cond.push(`${col} = ?`); args.push(vendor); }
}

/** Page window for a list: the requested page, or a fixed cap when the caller did not ask for pages. */
export function pagingFor(req, fallbackSize) {
  const paged = wantsPage(req);
  return { paged, ...(paged ? pageOf(req) : { size: fallbackSize, offset: 0 }) };
}
