import { pool } from '../db.js';
import { can } from '../permissions.js';
import { fail } from '../util.js';
import { groupItems } from './helpers.js';

/** The items of many orders, grouped by order id. */
export async function loadItems(ids) {
  if (!ids.length) return new Map();
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [ids]);
  return groupItems(items);
}

/** One order for the signed-in person: dispatchers may open any, a rider only their own. */
export async function getOrderFor(req, id) {
  const [[o]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  if (!o) throw fail(404, 'Order not found');
  if (!can(req.staff, 'hub.dispatch') && o.rider_id !== req.staff.id) throw fail(403, 'This delivery is not assigned to you');
  return o;
}
