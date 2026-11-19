// Hub routes that change one order: flow step, rider, courier, cancel, failed attempt and proof of delivery.
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { can } from '../permissions.js';
import { COURIERS, DONE, FLOW, applyFlow, cancelOrder, routeBranch } from '../flow.js';
import { fail, parseJson, wrap } from '../util.js';
import { addAttempt, deliveryNote, isCod } from './helpers.js';
import { getOrderFor } from './store.js';

/** Adds the order-changing routes to the hub router. */
export function registerOrderRoutes(hub) {
  hub.put('/orders/:id/flow', guard(['hub.dispatch', 'hub.deliver']), wrap(async (req, res) => {
    const o = await getOrderFor(req, req.params.id);
    const { flow, note } = req.body;
    if (!FLOW.includes(flow) || flow === 'Delivered') throw fail(400, 'Use the delivery proof to close an order');
    if (!can(req.staff, 'hub.dispatch') && flow !== 'Out for delivery') throw fail(403, 'Riders can only start their own trip');
    if (DONE.includes(o.flow)) throw fail(400, 'This order is already closed');
    const extra = {};
    if (flow === 'Packed' && !o.branch_id) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
      extra.branch_id = (await routeBranch(o, items)).pick.id;
    }
    if (flow === 'Out for delivery') {
      if (!o.rider_id && !o.courier) throw fail(400, 'Assign a rider or courier first');
      extra.out_at = new Date(); // a Date is written and read back in the same (driver) time zone; the old UTC text was shifted by the server's offset
      extra.otp = o.otp || String(1000 + crypto.randomInt(9000));
    }
    await applyFlow(o.id, flow, note || '', extra);
    res.json({ ok: true });
  }));

  hub.put('/orders/:id/rider', guard('hub.dispatch'), wrap(async (req, res) => {
    const riderId = req.body.riderId ? Number(req.body.riderId) : null;
    if (riderId) {
      const [[r]] = await pool.query('SELECT id FROM staff WHERE id = ? AND role = "Delivery rider" AND status = "Active"', [riderId]);
      if (!r) throw fail(400, 'Unknown rider');
    }
    await pool.query('UPDATE orders SET rider_id = ?, courier = IF(? IS NULL, courier, NULL), courier_tn = IF(? IS NULL, courier_tn, NULL) WHERE id = ?', [riderId, riderId, riderId, req.params.id]);
    res.json({ ok: true });
  }));

  hub.put('/orders/:id/courier', guard('hub.dispatch'), wrap(async (req, res) => {
    const c = COURIERS.find(x => x.id === req.body.courier);
    if (!c && req.body.courier) throw fail(400, 'Unknown courier');
    const tn = c ? c.id.slice(0, 2).toUpperCase() + (100000 + crypto.randomInt(900000)) : null;
    await pool.query('UPDATE orders SET courier = ?, courier_tn = ?, rider_id = IF(? IS NULL, rider_id, NULL) WHERE id = ?', [c ? c.id : null, tn, c ? c.id : null, req.params.id]);
    res.json({ ok: true });
  }));

  hub.post('/orders/:id/cancel', guard('hub.dispatch'), wrap(async (req, res) => {
    const [[o]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!o) throw fail(404, 'Order not found');
    if (DONE.includes(o.flow)) throw fail(400, 'This order is already closed');
    await cancelOrder(o.id, req.body.note || 'Cancelled by staff');
    res.json({ ok: true });
  }));

  hub.post('/orders/:id/fail', guard(['hub.dispatch', 'hub.deliver']), wrap(async (req, res) => {
    const o = await getOrderFor(req, req.params.id);
    if (o.flow !== 'Out for delivery') throw fail(400, 'Only orders that are out for delivery can fail');
    const reason = String(req.body.reason || '').trim();
    if (!reason) throw fail(400, 'Give a reason for the failed attempt');
    const { attempts, flagged } = addAttempt(parseJson(o.attempts), reason);
    await pool.query('UPDATE orders SET attempts = ? WHERE id = ?', [JSON.stringify(attempts), o.id]);
    await pool.query('INSERT INTO order_history (order_id,status,flow,note) VALUES (?,?,?,?)', [o.id, o.status, 'Attempt failed', reason.slice(0, 255)]);
    res.json({ attempts: attempts.length, flagged });
  }));

  hub.post('/orders/:id/deliver', guard(['hub.dispatch', 'hub.deliver']), wrap(async (req, res) => {
    const o = await getOrderFor(req, req.params.id);
    if (o.flow !== 'Out for delivery') throw fail(400, 'This order is not out for delivery');
    const { method, otp, name, signature, cod } = req.body;
    const pod = { at: Date.now(), method };
    if (method === 'courier') {
      if (!can(req.staff, 'hub.dispatch') || !o.courier) throw fail(403, 'Only staff can close a courier delivery');
      pod.name = o.courier;
    } else if (method === 'otp') {
      if (!o.otp || String(otp || '').trim() !== String(o.otp)) throw fail(400, 'OTP does not match');
    } else if (method === 'sig') {
      if (!/^data:image\/png;base64,/.test(signature || '') || signature.length > 300000) throw fail(400, 'Ask the receiver to sign in the box.');
      pod.name = String(name || '').slice(0, 80); pod.signature = signature;
    } else throw fail(400, 'Choose OTP or signature');
    const needsCod = isCod(o);
    if (needsCod && !cod) throw fail(400, 'Tick cash collection for this COD order.');
    await applyFlow(o.id, 'Delivered', deliveryNote(method, o, pod), { pod: JSON.stringify(pod), ...(needsCod ? { cod_collected: o.total, pay_status: 'Paid' } : {}) });
    res.json({ ok: true });
  }));
}
