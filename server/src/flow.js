// Order flow shared by the admin console, the Delivery Hub and the customer tracking page
import { pool } from './db.js';
import { fail, tx } from './util.js';
import { noteCatalogChange } from './growth/changeHooks.js';
import { noteOrderDelivered } from './growth/reviewRequests.js';

export const FLOW = ['Placed', 'Verification', 'Confirmed', 'Packed', 'Out for delivery', 'Delivered'];
/** `orders.status` keeps the simple six-state value the admin console and account pages use. */
export const LEGACY = { Placed: 'Pending', Verification: 'Pending', Confirmed: 'Confirmed', Packed: 'Packed', 'Out for delivery': 'Shipped', Delivered: 'Delivered', Cancelled: 'Cancelled', Returned: 'Cancelled' };
export const FROM_STATUS = { Pending: 'Placed', Confirmed: 'Confirmed', Packed: 'Packed', Shipped: 'Out for delivery', Delivered: 'Delivered', Cancelled: 'Cancelled' };
/** Status moves the admin may not make: a cancelled order stays cancelled (its stock is already back), a delivered one cannot go back. Returns an error message, or '' when allowed. */
export function reopenError(from, to) {
  if (from === 'Cancelled' && to !== 'Cancelled') return 'A cancelled order cannot be reopened. Create a new order.';
  if (from === 'Delivered' && to !== 'Delivered') return 'A delivered order cannot be moved back';
  return '';
}
export const canReopen = (from, to) => !reopenError(from, to);
export const DONE = ['Delivered', 'Cancelled', 'Returned'];
export const COURIERS = [
  { id: 'Pathao', color: '#e11b22', eta: '1–2 days', fee: 120 },
  { id: 'RedX', color: '#d6232a', eta: '2–3 days', fee: 110 },
  { id: 'Steadfast', color: '#00a651', eta: '2–3 days', fee: 100 }
];
export const RETURN_REASONS = ['Damaged in transit', 'Wrong item delivered', 'Defective / leaking cartridge', 'Expired or old stock', 'Changed my mind'];

const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; };
/** Same demo stock model as the design: HQ holds real stock, other branches hold a stable pseudo share. */
const branchStock = (productId, branchId, stock) => (branchId === 'B1' ? stock : hash(productId + branchId) % (stock + 2));

export async function getBranches() {
  const [rows] = await pool.query('SELECT * FROM branches ORDER BY id');
  return rows.map(b => ({ id: b.id, name: b.name, area: b.area, keys: typeof b.area_keys === 'string' ? JSON.parse(b.area_keys) : b.area_keys || [] }));
}

/** Nearest branch to the address that has every item; falls back to the next branch with full stock, then HQ. */
export async function routeBranch(order, items, branches) {
  const list = branches || await getBranches();
  const addr = String(order.address || '').toLowerCase();
  const near = list.find(b => b.keys.some(k => addr.includes(k))) || list[0];
  const ids = items.map(i => i.product_id ?? i.id);
  const [prods] = ids.length ? await pool.query('SELECT id, stock FROM products WHERE id IN (?)', [ids]) : [[]];
  const stockOf = new Map(prods.map(p => [p.id, p.stock]));
  const ok = b => items.every(i => branchStock(i.product_id ?? i.id, b.id, stockOf.get(i.product_id ?? i.id) || 0) >= i.qty);
  const ordered = [near, ...list.filter(b => b !== near)];
  const pick = ordered.find(ok) || list[0];
  return { near, pick, fallback: pick !== near, stock: list.map(b => ({ b, ok: ok(b) })) };
}

/** Moves an order to `flow`, keeps the legacy status in sync and logs the change. */
export async function applyFlow(orderId, flow, note = '', extra = {}, by = '') {
  const sets = ['flow = ?', 'status = ?'];
  const vals = [flow, LEGACY[flow]];
  for (const [k, v] of Object.entries(extra)) { sets.push(`${k} = ?`); vals.push(v); }
  await pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, [...vals, orderId]);
  await pool.query('INSERT INTO order_history (order_id,status,flow,note,by_name) VALUES (?,?,?,?,?)', [orderId, LEGACY[flow], flow, String(note).slice(0, 255), String(by).slice(0, 120)]);
  if (flow === 'Delivered') noteOrderDelivered(orderId); // queues a review request (not awaited, never throws)
}

/** Cancels an open order and puts its stock back, once: a second call (or a closed order) fails instead of double-restocking.
 *  The status change, the restock and the history line are one transaction, so a failure half-way cannot leave a cancelled order whose stock is never returned. */
export async function cancelOrder(orderId, note = '', by = '') {
  const productIds = await tx(async conn => {
    const [r] = await conn.query("UPDATE orders SET flow = 'Cancelled', status = 'Cancelled' WHERE id = ? AND flow NOT IN ('Delivered','Cancelled','Returned')", [orderId]);
    if (!r.affectedRows) throw fail(400, 'This order is already closed');
    const [items] = await conn.query('SELECT product_id, qty, backorder FROM order_items WHERE order_id = ?', [orderId]);
    for (const i of items) await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [Math.max(0, i.qty - i.backorder), i.product_id]);
    await conn.query('INSERT INTO order_history (order_id,status,flow,note,by_name) VALUES (?,?,?,?,?)', [orderId, 'Cancelled', 'Cancelled', String(note).slice(0, 255), String(by).slice(0, 120)]);
    return items.map(i => i.product_id);
  });
  noteCatalogChange({ productIds, reason: 'order' });
}

export function returnEligible(order, reason) {
  if (order.flow !== 'Delivered') return { ok: false, why: 'Only delivered orders can be returned.' };
  const pod = typeof order.pod === 'string' ? JSON.parse(order.pod) : order.pod;
  const at = pod?.at ? new Date(pod.at) : new Date(order.created_at);
  if ((Date.now() - at) / 864e5 > 7) return { ok: false, why: 'Return window (7 days) has passed.' };
  if (reason === 'Changed my mind') return { ok: false, why: 'Opened toner, ink and consumables are non-returnable unless damaged, wrong, defective or expired.' };
  return { ok: true, why: 'Eligible — full refund or replacement after inspection.' };
}
