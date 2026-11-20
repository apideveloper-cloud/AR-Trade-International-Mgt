// Admin customers (orders and accounts merged by mobile number), customer passwords / reset links, and service requests.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { digits, fail, wrap, checkPassword } from '../util.js';
import { addRange, day, whereOf } from '../listing.js';
import { like, page } from '../adminHelpers.js';

const SERVICE_STATUSES = ['New', 'Scheduled', 'In progress', 'Completed'];

const inRange = (d, req) => { const a = day(req.query.from), b = day(req.query.to); const t = d ? new Date(d).getTime() : NaN; return (!a || t >= Date.parse(a + 'T00:00:00')) && (!b || t < Date.parse(b + 'T00:00:00') + 864e5); };

/** Marks every open password-reset link of a customer as used. */
const closeResets = userId => pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [userId]);

/** One row per customer, orders and accounts merged by the last 10 digits of the mobile number. Several order groups of one number (the same person typed the name two ways) add up
 *  instead of the last one winning, and accounts without a mobile (social sign-up) stay separate instead of all collapsing into one row. Returns a Map. */
export function mergeCustomers(orders, users) {
  const map = new Map();
  const at = d => (d ? new Date(d).getTime() : 0);
  for (const o of orders) {
    const k = digits(o.phone).slice(-10) || 'o:' + o.name;
    const c = map.get(k);
    if (!c) { map.set(k, { name: o.name, phone: o.phone, email: o.email, n: Number(o.n), ltv: Number(o.ltv), last: o.last }); continue; }
    if (at(o.last) > at(c.last)) { c.name = o.name; c.phone = o.phone; c.last = o.last; }
    c.n += Number(o.n); c.ltv += Number(o.ltv); c.email = c.email || o.email;
  }
  for (const u of users) {
    const k = digits(u.phone).slice(-10) || 'u:' + u.id;
    const c = map.get(k);
    if (!c) map.set(k, { name: u.name, phone: u.phone, email: u.email, userId: u.id, memberCode: u.member_code || '', n: 0, ltv: 0, last: null });
    else { if (!c.email) c.email = u.email; c.userId = u.id; c.memberCode = u.member_code || ''; }
  }
  return map;
}

export function mountCustomerRoutes(router, guard) {
  router.get('/customers', guard('customers.view'), wrap(async (req, res) => {
    const { size, p } = page(req);
    const [orders] = await pool.query('SELECT customer_name name, customer_phone phone, MAX(customer_email) email, COUNT(*) n, SUM(total) ltv, MAX(created_at) last FROM orders WHERE status <> "Cancelled" GROUP BY customer_phone, customer_name');
    const [users] = await pool.query('SELECT id, name, phone, email, member_code FROM users');
    const map = mergeCustomers(orders, users);
    const q = String(req.query.q || '').toLowerCase();
    const ranged = !!(day(req.query.from) || day(req.query.to));
    const list = [...map.values()].filter(c => (!q || `${c.name} ${c.phone} ${c.email} ${c.memberCode || ''}`.toLowerCase().includes(q)) && (!ranged || (c.last && inRange(c.last, req))));
    list.sort((a, b) => b.ltv - a.ltv);
    const everyone = [...map.values()], buyers = everyone.filter(c => c.n > 0);
    const revenue = buyers.reduce((t, c) => t + c.ltv, 0);
    const [[nu]] = await pool.query('SELECT COALESCE(SUM(created_at >= NOW() - INTERVAL 30 DAY), 0) n FROM users');
    const top = buyers.reduce((b, c) => (!b || c.ltv > b.ltv ? c : b), null);
    const summary = { total: everyone.length, accounts: users.length, buyers: buyers.length, repeat: buyers.filter(c => c.n >= 2).length, revenue, avg: buyers.length ? Math.round(revenue / buyers.length) : 0, newAccounts: Number(nu.n), top: top ? { name: top.name, ltv: top.ltv } : null };
    res.json({ total: list.length, summary, rows: list.slice((p - 1) * size, p * size) });
  }));

  // ---------- customer passwords: set directly, or create a one-time reset link and answer "forgot password" requests ----------
  router.put('/customers/:id/password', guard('customers.manage'), wrap(async (req, res) => {
    const pw = String(req.body.password || '');
    checkPassword(pw);
    const [r] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(pw, 10), req.params.id]);
    if (!r.affectedRows) throw fail(404, 'Customer account not found');
    await closeResets(req.params.id);
    res.json({ ok: true });
  }));
  router.post('/customers/:id/reset-link', guard('customers.manage'), wrap(async (req, res) => {
    const [[u]] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!u) throw fail(404, 'Customer account not found');
    await closeResets(u.id);
    const token = crypto.randomBytes(24).toString('hex');
    await pool.query('INSERT INTO password_resets (user_id, token, requested, expires_at) VALUES (?,?,0,DATE_ADD(NOW(), INTERVAL 1 DAY))', [u.id, token]);
    res.json({ path: '/reset/' + token, hours: 24 });
  }));
  router.get('/password-resets', guard('customers.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT r.id, r.user_id userId, u.name, u.phone, u.email, r.created_at created FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.requested = 1 AND r.used_at IS NULL AND r.expires_at > NOW() ORDER BY r.created_at DESC LIMIT 50');
    res.json(rows);
  }));
  router.delete('/password-resets/:id', guard('customers.manage'), wrap(async (req, res) => { await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

  // ---------- service requests ----------
  router.get('/services', guard('services.manage'), wrap(async (req, res) => {
    const { size, offset } = page(req);
    const cond = [], params = [];
    if (req.query.q) { cond.push('(id LIKE ? OR name LIKE ? OR phone LIKE ? OR model LIKE ?)'); params.push(...Array(4).fill(like(req.query.q))); }
    if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
    addRange(cond, params, 'created_at', req);
    const where = whereOf(cond);
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM service_requests ${where}`, params);
    const [rows] = await pool.query(`SELECT * FROM service_requests ${where} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
    res.json({ total: n, rows: rows.map(r => ({ id: r.id, type: r.type, name: r.name, phone: r.phone, model: r.model, issue: r.issue, date: r.preferred_date, status: r.status, created: r.created_at })) });
  }));
  router.put('/services/:id', guard('services.manage'), wrap(async (req, res) => {
    if (!SERVICE_STATUSES.includes(req.body.status)) throw fail(400, 'Unknown status');
    const [r] = await pool.query('UPDATE service_requests SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    if (!r.affectedRows) throw fail(404, 'Service request not found');
    res.json({ ok: true });
  }));
}
