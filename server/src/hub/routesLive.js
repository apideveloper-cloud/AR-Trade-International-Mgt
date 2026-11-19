// Customer live tracking and return requests (public: order id + mobile number).
import { pool } from '../db.js';
import { COURIERS, RETURN_REASONS, getBranches, returnEligible } from '../flow.js';
import { fail, parseJson, wrap } from '../util.js';
import { liveProgress, phoneMatches } from './helpers.js';

const NOT_FOUND = 'No order found with that ID and mobile number.';

/** Adds the public tracking routes to the live router. */
export function registerLiveRoutes(pub) {
  pub.get('/live', wrap(async (req, res) => {
    const id = String(req.query.id || '').trim().toUpperCase();
    const [[o]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!phoneMatches(o, req.query.phone)) throw fail(404, NOT_FOUND);
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    const [hist] = await pool.query("SELECT * FROM order_history WHERE order_id = ? AND kind = 'status' ORDER BY id", [o.id]);
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
      live: out && !!rider ? liveProgress(mins) : null,
      otp: out ? o.otp : null,
      pod: pod ? { at: pod.at, method: pod.method, name: pod.name, cash: o.cod_collected } : null,
      ret: ret ? { status: ret.status, reason: ret.reason, mode: ret.mode } : null,
      returnReasons: RETURN_REASONS
    });
  }));

  pub.post('/return', wrap(async (req, res) => {
    const { id, phone, reason, note } = req.body;
    const [[o]] = await pool.query('SELECT * FROM orders WHERE id = ?', [String(id || '').toUpperCase()]);
    if (!phoneMatches(o, phone)) throw fail(404, NOT_FOUND);
    if (!RETURN_REASONS.includes(reason)) throw fail(400, 'Choose a reason');
    const el = returnEligible(o, reason);
    if (!el.ok) throw fail(400, el.why);
    const [[ex]] = await pool.query('SELECT id FROM order_returns WHERE order_id = ?', [o.id]);
    if (ex) throw fail(409, 'A return was already requested for this order');
    await pool.query('INSERT INTO order_returns (order_id,reason,note) VALUES (?,?,?)', [o.id, reason, String(note || '').slice(0, 500)]);
    res.json({ ok: true });
  }));
}
