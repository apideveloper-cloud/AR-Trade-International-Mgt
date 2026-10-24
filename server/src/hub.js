import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from './db.js';
import { guard } from './admin.js';
import { can } from './permissions.js';
import { COURIERS, DONE, FLOW, RETURN_REASONS, applyFlow, cancelOrder, getBranches, returnEligible, routeBranch } from './flow.js';
import { digits, fail, parseJson, wrap } from './util.js';

const hub = Router();
const pub = Router();
const isCod = o => /cod|cash/i.test(o.payment || '') && o.pay_status !== 'Paid';

async function loadItems(ids) {
  if (!ids.length) return new Map();
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [ids]);
  const m = new Map();
  items.forEach(i => { if (!m.has(i.order_id)) m.set(i.order_id, []); m.get(i.order_id).push(i); });
  return m;
}

const riderOut = r => ({ id: r.id, name: r.name, phone: r.phone, vehicle: r.vehicle, rating: Number(r.rating), branch: r.branch_id });

async function getOrderFor(req, id) {
  const [[o]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  if (!o) throw fail(404, 'Order not found');
  if (!can(req.staff, 'hub.dispatch') && o.rider_id !== req.staff.id) throw fail(403, 'This delivery is not assigned to you');
  return o;
}

// ---------- dispatch board ----------
hub.get('/board', guard('hub.view'), wrap(async (req, res) => {
  const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300');
  const items = await loadItems(orders.map(o => o.id));
  const branches = await getBranches();
  const [riders] = await pool.query('SELECT * FROM staff WHERE role = "Delivery rider" AND status = "Active" ORDER BY id');
  const rows = [];
  for (const o of orders) {
    const its = items.get(o.id) || [];
    const r = !DONE.includes(o.flow) ? await routeBranch(o, its, branches) : null;
    const held = o.hold ? 1 : 0;
    rows.push({
      id: o.id, date: o.created_at, name: o.company || o.customer_name, phone: o.customer_phone, address: o.address, total: o.total, payment: o.payment, payStatus: o.pay_status, cod: isCod(o),
      flow: o.flow, branch: o.branch_id || r?.pick.id || 'B1', fallback: !!r?.fallback, nearName: r?.near.name, pickName: r?.pick.name, held: !!held, hasRider: !!o.rider_id, rider: o.rider_id, courier: o.courier, courierTn: o.courier_tn,
      attempts: (parseJson(o.attempts) || []).length
    });
  }
  const [cod] = await pool.query('SELECT COALESCE(SUM(cod_collected),0) s FROM orders WHERE cod_collected > 0 AND cod_deposited_at IS NULL');
  const [[ret]] = await pool.query('SELECT COUNT(*) n FROM order_returns WHERE status = "Requested"');
  res.json({ orders: rows, riders: riders.map(riderOut), couriers: COURIERS, branches, codWithRiders: Number(cod[0].s), returnsPending: ret.n });
}));

hub.put('/orders/:id/flow', guard(['hub.dispatch','hub.deliver']), wrap(async (req, res) => {
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
    extra.out_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
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

hub.post('/orders/:id/fail', guard(['hub.dispatch','hub.deliver']), wrap(async (req, res) => {
  const o = await getOrderFor(req, req.params.id);
  if (o.flow !== 'Out for delivery') throw fail(400, 'Only orders that are out for delivery can fail');
  const reason = String(req.body.reason || '').trim();
  if (!reason) throw fail(400, 'Give a reason for the failed attempt');
  const attempts = [...(parseJson(o.attempts) || []), { reason, at: Date.now() }];
  await pool.query('UPDATE orders SET attempts = ? WHERE id = ?', [JSON.stringify(attempts), o.id]);
  await pool.query('INSERT INTO order_history (order_id,status,flow,note) VALUES (?,?,?,?)', [o.id, o.status, 'Attempt failed', reason.slice(0, 255)]);
  res.json({ attempts: attempts.length, flagged: attempts.length >= 3 });
}));

hub.post('/orders/:id/deliver', guard(['hub.dispatch','hub.deliver']), wrap(async (req, res) => {
  const o = await getOrderFor(req, req.params.id);
  if (o.flow !== 'Out for delivery') throw fail(400, 'This order is not out for delivery');
  const { method, otp, name, signature, cod } = req.body;
  const pod = { at: Date.now(), method };
  if (method === 'courier') {
    if (!can(req.staff, 'hub.dispatch') || !o.courier) throw fail(403, 'Only staff can close a courier delivery');
    pod.name = o.courier;
  } else if (method === 'otp') {
    if (String(otp || '').trim() !== String(o.otp)) throw fail(400, 'OTP does not match');
  } else if (method === 'sig') {
    if (!/^data:image\/png;base64,/.test(signature || '') || signature.length > 300000) throw fail(400, 'Ask the receiver to sign in the box.');
    pod.name = String(name || '').slice(0, 80); pod.signature = signature;
  } else throw fail(400, 'Choose OTP or signature');
  const needsCod = isCod(o);
  if (needsCod && !cod) throw fail(400, 'Tick cash collection for this COD order.');
  const note = method === 'courier' ? 'Confirmed by ' + o.courier : method === 'otp' ? 'OTP verified' : 'Signed by ' + (pod.name || 'customer');
  await applyFlow(o.id, 'Delivered', note, { pod: JSON.stringify(pod), ...(needsCod ? { cod_collected: o.total, pay_status: 'Paid' } : {}) });
  res.json({ ok: true });
}));

// ---------- rider app ----------
hub.get('/riders', guard(['hub.dispatch','hub.deliver']), wrap(async (req, res) => {
  const [riders] = await pool.query('SELECT * FROM staff WHERE role = "Delivery rider" AND status = "Active" ORDER BY id');
  const [jobs] = await pool.query('SELECT rider_id, COUNT(*) n FROM orders WHERE rider_id IS NOT NULL AND flow IN ("Packed","Out for delivery") GROUP BY rider_id');
  const [cod] = await pool.query('SELECT rider_id, SUM(cod_collected) s FROM orders WHERE cod_collected > 0 AND cod_deposited_at IS NULL GROUP BY rider_id');
  const mine = !can(req.staff, 'hub.dispatch') ? riders.filter(r => r.id === req.staff.id) : riders;
  res.json(mine.map(r => ({ ...riderOut(r), jobs: jobs.find(j => j.rider_id === r.id)?.n || 0, cash: Number(cod.find(c => c.rider_id === r.id)?.s || 0) })));
}));

hub.get('/riders/:id', guard(['hub.dispatch','hub.deliver']), wrap(async (req, res) => {
  const id = !can(req.staff, 'hub.dispatch') ? req.staff.id : Number(req.params.id);
  const [[r]] = await pool.query('SELECT * FROM staff WHERE id = ? AND role = "Delivery rider"', [id]);
  if (!r) throw fail(404, 'Rider not found');
  const [orders] = await pool.query('SELECT * FROM orders WHERE rider_id = ? ORDER BY created_at DESC', [id]);
  const items = await loadItems(orders.map(o => o.id));
  const branches = await getBranches();
  const jobs = orders.filter(o => ['Packed', 'Out for delivery'].includes(o.flow)).map(o => ({
    id: o.id, flow: o.flow, name: o.customer_name, phone: o.customer_phone, address: o.address, itemsN: (items.get(o.id) || []).reduce((a, i) => a + i.qty, 0),
    branchName: branches.find(b => b.id === o.branch_id)?.name || 'Shantinagar HQ', total: o.total, cod: isCod(o), otp: o.flow === 'Out for delivery' ? o.otp : null, attempts: parseJson(o.attempts) || []
  }));
  const doneToday = orders.filter(o => o.flow === 'Delivered' && parseJson(o.pod)?.at > Date.now() - 864e5).length;
  const [[cash]] = await pool.query('SELECT COALESCE(SUM(cod_collected),0) s FROM orders WHERE rider_id = ? AND cod_collected > 0 AND cod_deposited_at IS NULL', [id]);
  res.json({ rider: riderOut(r), jobs, stats: { assigned: jobs.length, doneToday, cash: Number(cash.s) } });
}));

// only the office confirms that a rider handed the cash in (a rider cannot clear their own balance)
hub.post('/riders/:id/deposit', guard('hub.cash'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('UPDATE orders SET cod_deposited_at = NOW() WHERE rider_id = ? AND cod_collected > 0 AND cod_deposited_at IS NULL', [id]);
  res.json({ ok: true });
}));

// ---------- returns ----------
hub.get('/returns', guard('hub.view'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT r.*, o.customer_name, o.total FROM order_returns r JOIN orders o ON o.id = r.order_id ORDER BY r.created_at DESC');
  res.json(rows.map(r => ({ id: r.order_id, name: r.customer_name, total: r.total, reason: r.reason, note: r.note, status: r.status, mode: r.mode, refund: r.refund, at: r.created_at })));
}));

hub.put('/returns/:orderId', guard('hub.dispatch'), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT r.*, o.total FROM order_returns r JOIN orders o ON o.id = r.order_id WHERE r.order_id = ?', [req.params.orderId]);
  if (!r) throw fail(404, 'Return not found');
  if (r.status !== 'Requested') throw fail(400, 'This return is already resolved');
  const { action } = req.body;
  if (action === 'reject') {
    await pool.query('UPDATE order_returns SET status = "Rejected", done_at = NOW() WHERE id = ?', [r.id]);
  } else if (action === 'refund' || action === 'replace') {
    const mode = action === 'refund' ? 'Refund' : 'Replacement';
    await pool.query('UPDATE order_returns SET status = "Approved", mode = ?, refund = ?, done_at = NOW() WHERE id = ?', [mode, action === 'refund' ? r.total : 0, r.id]);
    await applyFlow(r.order_id, 'Returned', `${mode} · ${r.reason}`);
  } else throw fail(400, 'Choose refund, replace or reject');
  res.json({ ok: true });
}));

// ---------- branches & couriers ----------
hub.get('/branches', guard('hub.view'), wrap(async (req, res) => {
  const branches = await getBranches();
  const [riders] = await pool.query('SELECT branch_id, COUNT(*) n FROM staff WHERE role = "Delivery rider" AND status = "Active" GROUP BY branch_id');
  const [active] = await pool.query('SELECT * FROM orders WHERE flow NOT IN ("Delivered","Cancelled","Returned") ORDER BY created_at DESC');
  const items = await loadItems(active.map(o => o.id));
  const routing = [];
  const counts = {};
  for (const o of active) {
    const r = await routeBranch(o, items.get(o.id) || [], branches);
    const b = o.branch_id || r.pick.id;
    counts[b] = (counts[b] || 0) + 1;
    if (routing.length < 12) routing.push({ id: o.id, address: o.address, pick: r.pick.name, fallback: r.fallback, stock: r.stock.map(x => ({ name: x.b.name.split(' ')[0], ok: x.ok, nearest: x.b === r.near })) });
  }
  const [used] = await pool.query('SELECT courier, COUNT(*) n FROM orders WHERE courier IS NOT NULL GROUP BY courier');
  res.json({
    branches: branches.map(b => ({ id: b.id, name: b.name, area: b.area, riders: riders.find(r => r.branch_id === b.id)?.n || 0, active: counts[b.id] || 0 })),
    routing, couriers: COURIERS.map(c => ({ ...c, used: used.find(u => u.courier === c.id)?.n || 0 }))
  });
}));

// ---------- customer live tracking (public) ----------
pub.get('/live', wrap(async (req, res) => {
  const id = String(req.query.id || '').trim().toUpperCase();
  const [[o]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  if (!o || !digits(req.query.phone) || digits(o.customer_phone).slice(-10) !== digits(req.query.phone).slice(-10)) throw fail(404, 'No order found with that ID and mobile number.');
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
  const [hist] = await pool.query('SELECT * FROM order_history WHERE order_id = ? ORDER BY id', [o.id]);
  const branches = await getBranches();
  const [[rider]] = o.rider_id ? await pool.query('SELECT * FROM staff WHERE id = ?', [o.rider_id]) : [[null]];
  const [[ret]] = await pool.query('SELECT * FROM order_returns WHERE order_id = ?', [o.id]);
  const out = o.flow === 'Out for delivery';
  const mins = o.out_at ? (Date.now() - new Date(o.out_at)) / 6e4 : 0;
  const pod = parseJson(o.pod);
  res.json({
    id: o.id, flow: o.flow, date: o.created_at, payment: o.payment, total: o.total, delivery: o.delivery, discount: o.discount + o.member_discount, subtotal: o.subtotal, address: o.address,
    items: items.map(i => ({ id: i.product_id, name: i.name, img: i.img, price: i.price, qty: i.qty })),
    history: hist.map(h => ({ s: h.flow || (h.status === 'Pending' ? 'Placed' : h.status), note: h.note, at: h.at })),
    branchName: branches.find(b => b.id === o.branch_id)?.name || 'Shantinagar HQ',
    rider: rider ? { name: rider.name, phone: rider.phone, vehicle: rider.vehicle, rating: Number(rider.rating) } : null,
    courier: o.courier ? { ...COURIERS.find(c => c.id === o.courier), tn: o.courier_tn } : null,
    live: out && !!rider ? { pct: Math.min(94, 8 + mins / 35 * 100), etaMin: Math.max(3, Math.round(35 - mins)), sinceMin: Math.max(1, Math.round(mins)) } : null,
    otp: out ? o.otp : null,
    pod: pod ? { at: pod.at, method: pod.method, name: pod.name, cash: o.cod_collected } : null,
    ret: ret ? { status: ret.status, reason: ret.reason, mode: ret.mode } : null,
    returnReasons: RETURN_REASONS
  });
}));

pub.post('/return', wrap(async (req, res) => {
  const { id, phone, reason, note } = req.body;
  const [[o]] = await pool.query('SELECT * FROM orders WHERE id = ?', [String(id || '').toUpperCase()]);
  if (!o || digits(o.customer_phone).slice(-10) !== digits(phone).slice(-10)) throw fail(404, 'No order found with that ID and mobile number.');
  if (!RETURN_REASONS.includes(reason)) throw fail(400, 'Choose a reason');
  const el = returnEligible(o, reason);
  if (!el.ok) throw fail(400, el.why);
  const [[ex]] = await pool.query('SELECT id FROM order_returns WHERE order_id = ?', [o.id]);
  if (ex) throw fail(409, 'A return was already requested for this order');
  await pool.query('INSERT INTO order_returns (order_id,reason,note) VALUES (?,?,?)', [o.id, reason, String(note || '').slice(0, 500)]);
  res.json({ ok: true });
}));

export { hub as hubRouter, pub as liveRouter };
