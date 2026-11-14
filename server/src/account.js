import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { digits, fail, parseJson, wrap, checkPassword, readCustomer, sessionCookie, str, verifyPassword } from './util.js';
import { limit } from './middleware/security.js';
import { cancelOrder } from './flow.js';
import { normPhone } from './routes/auth.js';

const router = Router();

const NOTIF_DEFAULTS = {
  orders: { sms: true, email: true, push: true }, delivery: { sms: true, email: false, push: true },
  offers: { sms: false, email: true, push: false }, refill: { sms: true, email: true, push: false }, service: { sms: true, email: false, push: false }
};

/** Signed-in storefront customer (not staff). */
const customer = async (req, res, next) => {
  try {
    const u = await readCustomer(req);
    if (!u) throw fail(401, 'Please sign in');
    req.user = u;
    next();
  } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error' }); }
};
router.use(customer);

const profileOut = u => {
  const p = parseJson(u.profile) || {};
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, address: u.address, area: u.area, role: u.role, since: u.created_at,
    gender: p.gender || '', dob: p.dob || '', org: p.org || '', bin: p.bin || '', devices: p.devices || '', notifs: { ...NOTIF_DEFAULTS, ...(p.notifs || {}) } };
};

router.get('/profile', wrap(async (req, res) => { res.json(profileOut(req.user)); }));

router.put('/profile', wrap(async (req, res) => {
  const b = req.body;
  const cur = parseJson(req.user.profile) || {};
  const profile = { ...cur };
  for (const k of ['gender', 'dob', 'org', 'bin', 'devices']) if (k in b) profile[k] = String(b[k] || '').slice(0, 200);
  if (b.notifs && typeof b.notifs === 'object') { // only the known topics and channels, as true / false (the profile column is not a place for arbitrary data)
    const n = {};
    for (const t of Object.keys(NOTIF_DEFAULTS)) if (b.notifs[t] && typeof b.notifs[t] === 'object') n[t] = Object.fromEntries(Object.keys(NOTIF_DEFAULTS[t]).map(c => [c, !!b.notifs[t][c]]));
    profile.notifs = n;
  }
  const area = ['inside', 'suburb', 'outside'].includes(b.area) ? b.area : req.user.area;
  const email = (str(b.email).trim().toLowerCase().slice(0, 160)) || req.user.email;
  if (email !== req.user.email) {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
    const [ex] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, req.user.id]);
    if (ex.length) throw fail(409, 'That email is already used by another account');
  }
  const phone = digits(b.phone) ? normPhone(b.phone) : req.user.phone; // same stored form as sign-up and sign-in (01XXXXXXXXX); an empty box keeps the number, so a phone-only account cannot lock itself out
  if (phone && phone !== req.user.phone) {
    const [ex] = await pool.query('SELECT id FROM users WHERE phone = ? AND id <> ?', [phone, req.user.id]);
    if (ex.length) throw fail(409, 'That mobile number is already used by another account');
  }
  await pool.query('UPDATE users SET name = ?, email = ?, phone = ?, address = ?, area = ?, profile = ? WHERE id = ?',
    [str(b.name).trim().slice(0, 120) || req.user.name, email, phone, b.address != null ? str(b.address).slice(0, 500) : req.user.address, area, JSON.stringify(profile), req.user.id]);
  const [[u]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json(profileOut(u));
}));

// ---------- addresses ----------
const addrOut = a => ({ id: a.id, label: a.label, district: a.district, thana: a.thana, area: a.area, line: a.line, lat: a.lat == null ? null : Number(a.lat), lng: a.lng == null ? null : Number(a.lng), isDefault: !!a.is_default });
router.get('/addresses', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id', [req.user.id]);
  res.json(rows.map(addrOut));
}));
router.post('/addresses', wrap(async (req, res) => {
  const b = req.body;
  if (!b.line || !b.thana || !b.area) throw fail(400, 'Thana, area and house/road are required');
  for (const k of ['label', 'district', 'thana', 'area', 'line']) if (b[k] != null) b[k] = String(b[k]).trim().slice(0, k === 'line' ? 200 : 80);
  for (const k of ['lat', 'lng']) b[k] = b[k] != null && b[k] !== '' && Number.isFinite(Number(b[k])) && Math.abs(Number(b[k])) <= 180 ? Number(b[k]) : null;
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM user_addresses WHERE user_id = ?', [req.user.id]);
  if (n >= 20) throw fail(400, 'You can save up to 20 addresses');
  const def = b.isDefault || n === 0;
  if (def) await pool.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
  await pool.query('INSERT INTO user_addresses (user_id,label,district,thana,area,line,lat,lng,is_default) VALUES (?,?,?,?,?,?,?,?,?)',
    [req.user.id, b.label || 'Home', b.district || 'Dhaka', b.thana, b.area, b.line, b.lat ?? null, b.lng ?? null, +!!def]);
  if (def) await pool.query('UPDATE users SET address = ? WHERE id = ?', [`${b.line}, ${b.area}, ${b.thana}, ${b.district || 'Dhaka'}`, req.user.id]);
  res.json({ ok: true });
}));
router.put('/addresses/:id/default', wrap(async (req, res) => {
  const [[a]] = await pool.query('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!a) throw fail(404, 'Address not found');
  await pool.query('UPDATE user_addresses SET is_default = (id = ?) WHERE user_id = ?', [a.id, req.user.id]);
  await pool.query('UPDATE users SET address = ? WHERE id = ?', [`${a.line}, ${a.area}, ${a.thana}, ${a.district}`, req.user.id]);
  res.json({ ok: true });
}));
router.delete('/addresses/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  const [[first]] = await pool.query('SELECT id FROM user_addresses WHERE user_id = ? ORDER BY id LIMIT 1', [req.user.id]);
  if (first) await pool.query('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM user_addresses WHERE user_id = ? AND is_default = 1) d)', [first.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- family & team ----------
router.get('/family', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM user_family WHERE user_id = ? ORDER BY id', [req.user.id]);
  res.json(rows.map(f => ({ id: f.id, name: f.name, relation: f.relation, phone: f.phone, address: f.address })));
}));
router.post('/family', wrap(async (req, res) => {
  const b = req.body;
  if (!b.name) throw fail(400, 'Name is required');
  for (const k of ['name', 'relation', 'address']) if (b[k] != null) b[k] = String(b[k]).trim().slice(0, k === 'address' ? 300 : 120);
  const [[{ fn }]] = await pool.query('SELECT COUNT(*) fn FROM user_family WHERE user_id = ?', [req.user.id]);
  if (fn >= 30) throw fail(400, 'Too many family members saved');
  if (b.phone && !/^01\d{9}$/.test(digits(b.phone))) throw fail(400, 'Enter a valid mobile number (01XXXXXXXXX)');
  await pool.query('INSERT INTO user_family (user_id,name,relation,phone,address) VALUES (?,?,?,?,?)', [req.user.id, b.name, b.relation || '', digits(b.phone), b.address || '']);
  res.json({ ok: true });
}));
router.delete('/family/:id', wrap(async (req, res) => { await pool.query('DELETE FROM user_family WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]); res.json({ ok: true }); }));

// ---------- refill reminders ----------
const remOut = r => ({ id: r.id, productId: r.product_id, qty: r.qty, every: r.every_days, next: r.next_at, active: !!r.active, name: r.name, img: r.img, price: r.price });
router.get('/reminders', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT r.*, p.name, p.img, p.price FROM user_reminders r JOIN products p ON p.id = r.product_id WHERE r.user_id = ? ORDER BY r.next_at', [req.user.id]);
  res.json(rows.map(remOut));
}));
router.post('/reminders', wrap(async (req, res) => {
  const { productId, qty, every } = req.body;
  const days = [15, 30, 45, 60, 90].includes(+every) ? +every : 30;
  const [[p]] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
  if (!p) throw fail(404, 'Product not found');
  await pool.query('INSERT INTO user_reminders (user_id,product_id,qty,every_days,next_at) VALUES (?,?,?,?,DATE_ADD(CURDATE(), INTERVAL ? DAY))', [req.user.id, p.id, Math.min(999, Math.max(1, Math.round(+qty) || 1)), days, days]);
  res.json({ ok: true });
}));
router.put('/reminders/:id', wrap(async (req, res) => {
  const { every, active } = req.body;
  if (every != null) {
    if (![15, 30, 45, 60, 90].includes(+every)) throw fail(400, 'Pick 15, 30, 45, 60 or 90 days');
    await pool.query('UPDATE user_reminders SET every_days = ?, next_at = DATE_ADD(CURDATE(), INTERVAL ? DAY) WHERE id = ? AND user_id = ?', [+every, +every, req.params.id, req.user.id]);
  }
  if (active != null) await pool.query('UPDATE user_reminders SET active = ? WHERE id = ? AND user_id = ?', [+!!active, req.params.id, req.user.id]);
  res.json({ ok: true });
}));
router.delete('/reminders/:id', wrap(async (req, res) => { await pool.query('DELETE FROM user_reminders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]); res.json({ ok: true }); }));

// ---------- orders & services ----------
router.post('/orders/:id/cancel', wrap(async (req, res) => {
  const [[o]] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!o) throw fail(404, 'Order not found');
  if (!['Pending', 'Confirmed'].includes(o.status)) throw fail(400, 'This order is already being packed and can no longer be cancelled online. Please call us.');
  await cancelOrder(o.id, 'Cancelled by customer');
  res.json({ ok: true });
}));

router.get('/services', wrap(async (req, res) => {
  const phone = digits(req.user.phone).slice(-10);
  if (!phone) return res.json([]);
  const [rows] = await pool.query('SELECT * FROM service_requests WHERE RIGHT(REGEXP_REPLACE(phone, "[^0-9]", ""), 10) = ? ORDER BY created_at DESC', [phone]);
  res.json(rows.map(r => ({ id: r.id, type: r.type, model: r.model, issue: r.issue, date: r.preferred_date, status: r.status, created: r.created_at })));
}));

// ---------- privacy ----------
router.get('/export', wrap(async (req, res) => {
  const u = req.user;
  const [orders] = await pool.query('SELECT * FROM orders WHERE user_id = ?', [u.id]);
  const [addresses] = await pool.query('SELECT * FROM user_addresses WHERE user_id = ?', [u.id]);
  const [family] = await pool.query('SELECT * FROM user_family WHERE user_id = ?', [u.id]);
  const [reminders] = await pool.query('SELECT * FROM user_reminders WHERE user_id = ?', [u.id]);
  res.json({ exportedAt: new Date().toISOString(), profile: profileOut(u), addresses, family, reminders, orders });
}));

router.delete('/me', wrap(async (req, res) => {
  if (req.body.confirm !== 'DELETE') throw fail(400, 'Type DELETE to confirm');
  const id = req.user.id;
  await pool.query('DELETE FROM user_addresses WHERE user_id = ?', [id]);
  await pool.query('DELETE FROM user_family WHERE user_id = ?', [id]);
  await pool.query('DELETE FROM user_reminders WHERE user_id = ?', [id]);
  await pool.query('UPDATE orders SET user_id = NULL WHERE user_id = ?', [id]); // invoices are kept for legal reasons
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
  res.json({ ok: true });
}));

router.put('/password', limit('pwchange', 10, 30 * 60000), wrap(async (req, res) => {
  const { current, next } = req.body;
  if (!(await verifyPassword(current, req.user.password_hash))) throw fail(400, 'Current password is wrong');
  checkPassword(next);
  const hash = await bcrypt.hash(next, 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.append('Set-Cookie', sessionCookie(req, { ...req.user, password_hash: hash })); // every other device is signed out; this one stays in
  res.json({ ok: true });
}));

export default router;
