import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import sanitizeHtml from 'sanitize-html';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { digits, fail, parseJson, wrap, checkPassword } from './util.js';
import { applyFlow, FROM_STATUS } from './flow.js';

const router = Router();
const secret = () => process.env.JWT_SECRET || 'dev-secret';
const STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
const ROLES = ['Super admin', 'Admin', 'Delivery rider', 'Marketing manager', 'Content writer'];

const staffOut = s => ({ id: s.id, name: s.name, email: s.email, phone: s.phone, role: s.role, status: s.status, since: s.created_at });
const sign = s => jwt.sign({ sid: s.id, srole: s.role }, secret(), { expiresIn: '12h' });

/** Express middleware: requires a signed-in, active staff member; roles limits which staff roles may call the route. */
export const guard = roles => async (req, res, next) => {
  try {
    let t;
    try { t = jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), secret()); } catch { throw fail(401, 'Please sign in to the admin console'); }
    if (!t.sid) throw fail(401, 'Please sign in to the admin console');
    const [[s]] = await pool.query('SELECT * FROM staff WHERE id = ?', [t.sid]);
    if (!s || s.status !== 'Active') throw fail(401, 'Your account is not active');
    if (roles && !roles.includes(s.role)) throw fail(403, 'Your role cannot do this');
    req.staff = s;
    next();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
export const ADMINS = ['Super admin', 'Admin'];
const SALES = ['Super admin', 'Admin', 'Delivery rider'];
const MKT = ['Super admin', 'Admin', 'Marketing manager'];
const BLOG = ['Super admin', 'Admin', 'Content writer'];

const page = req => {
  const size = Math.min(100, Math.max(5, parseInt(req.query.size, 10) || 10));
  const p = Math.max(1, parseInt(req.query.page, 10) || 1);
  return { size, p, offset: (p - 1) * size };
};
const like = q => `%${String(q || '').trim()}%`;

// ---------- auth ----------
router.post('/login', wrap(async (req, res) => {
  const id = String(req.body.id || '').trim().toLowerCase();
  const [[s]] = await pool.query('SELECT * FROM staff WHERE email = ? OR (phone <> "" AND phone = ?)', [id, digits(id)]);
  if (!s || !(await bcrypt.compare(req.body.password || '', s.password_hash))) throw fail(401, 'Wrong mobile/email or password.');
  if (s.status === 'Pending') throw fail(403, 'Your account is waiting for an admin to approve it.');
  if (s.status !== 'Active') throw fail(403, 'This account is disabled.');
  res.json({ token: sign(s), staff: staffOut(s) });
}));

router.post('/register', wrap(async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !email || !password) throw fail(400, 'Name, work email and a password are required.');
  checkPassword(password);
  if (!/^01[3-9]\d{8}$/.test(digits(phone).slice(-11))) throw fail(400, 'Enter a valid 11-digit mobile number (01XXXXXXXXX).');
  if (!['Delivery rider', 'Marketing manager', 'Content writer'].includes(role)) throw fail(400, 'Choose Delivery rider, Marketing manager or Content writer.');
  const [ex] = await pool.query('SELECT id FROM staff WHERE email = ? OR phone = ?', [email.toLowerCase(), digits(phone).slice(-11)]);
  if (ex.length) throw fail(409, 'This email or mobile number is already registered.');
  await pool.query('INSERT INTO staff (name,email,phone,password_hash,role,status) VALUES (?,?,?,?,?,"Pending")',
    [name, email.toLowerCase(), digits(phone).slice(-11), await bcrypt.hash(password, 10), role]);
  res.json({ ok: true });
}));

router.get('/me', guard(), wrap(async (req, res) => { res.json({ staff: staffOut(req.staff) }); }));

// ---------- dashboard ----------
router.get('/dashboard', guard(ADMINS), wrap(async (req, res) => {
  const [[w]] = await pool.query('SELECT COUNT(*) n, COALESCE(SUM(total),0) rev FROM orders WHERE status <> "Cancelled" AND created_at >= NOW() - INTERVAL 7 DAY');
  const [[a]] = await pool.query('SELECT COUNT(*) n, COALESCE(AVG(total),0) avg FROM orders WHERE status <> "Cancelled"');
  const [[p]] = await pool.query('SELECT COUNT(*) n FROM orders WHERE status = "Pending"');
  const [[sv]] = await pool.query('SELECT SUM(status <> "Completed") open, SUM(status = "New") fresh FROM service_requests');
  const [days] = await pool.query(`SELECT DATE(created_at) d, SUM(total) v FROM orders WHERE status <> 'Cancelled' AND created_at >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(created_at)`);
  const chart = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
    const key = d.toLocaleDateString('en-CA');
    const hit = days.find(x => new Date(x.d).toLocaleDateString('en-CA') === key);
    return { label: d.toLocaleDateString('en-GB', { weekday: 'short' }), value: hit ? Number(hit.v) : 0 };
  });
  const [low] = await pool.query('SELECT id,name,img,stock FROM products WHERE price > 0 AND stock <= 5 AND active = 1 ORDER BY stock LIMIT 6');
  const [recent] = await pool.query('SELECT id,customer_name,total,status,created_at FROM orders ORDER BY created_at DESC LIMIT 6');
  res.json({
    kpis: { weekRevenue: Number(w.rev), weekOrders: w.n, pending: p.n, avgOrder: Math.round(a.avg), openServices: Number(sv.open || 0), newServices: Number(sv.fresh || 0) },
    chart, lowStock: low, recent: recent.map(o => ({ id: o.id, customer: o.customer_name, total: o.total, status: o.status, at: o.created_at }))
  });
}));

// ---------- orders ----------
async function loadOrders(where, params, extra = '') {
  const [rows] = await pool.query(`SELECT * FROM orders ${where} ORDER BY created_at DESC ${extra}`, params);
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [ids]);
  const [hist] = await pool.query('SELECT * FROM order_history WHERE order_id IN (?) ORDER BY id', [ids]);
  return rows.map(r => ({
    id: r.id, date: r.created_at, status: r.status, payment: r.payment, gateway: r.gateway, payStatus: r.pay_status, area: r.area, address: r.address,
    note: r.note, slot: r.slot, partial: r.partial, hold: !!r.hold, holdNote: r.hold_note, vatInvoice: !!r.vat_invoice, company: r.company, bin: r.bin, express: !!r.express,
    customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email },
    subtotal: r.subtotal, discount: r.discount + r.member_discount, delivery: r.delivery, total: r.total, vat: r.vat,
    items: items.filter(i => i.order_id === r.id).map(i => ({ id: i.product_id, name: i.name, img: i.img, price: i.price, qty: i.qty, backorder: i.backorder })),
    history: hist.filter(h => h.order_id === r.id).map(h => ({ s: h.status, at: h.at }))
  }));
}

router.get('/orders', guard(SALES), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
  if (STATUSES.includes(req.query.status)) { cond.push('status = ?'); params.push(req.query.status); }
  if (req.query.pay) { cond.push('payment LIKE ?'); params.push(like(req.query.pay)); }
  if (req.staff.role === 'Delivery rider') { cond.push('(status IN ("Packed","Shipped") OR rider_id = ?)'); params.push(req.staff.id); } // riders: the pick-up queue plus their own deliveries
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM orders ${where}`, params);
  const [counts] = await pool.query('SELECT status, COUNT(*) c FROM orders GROUP BY status');
  res.json({ total: n, counts: Object.fromEntries(counts.map(c => [c.status, c.c])), rows: await loadOrders(where, params, `LIMIT ${size} OFFSET ${offset}`) });
}));

router.get('/orders/:id', guard(SALES), wrap(async (req, res) => {
  const rider = req.staff.role === 'Delivery rider';
  const [o] = await loadOrders('WHERE id = ?' + (rider ? ' AND (status IN ("Packed","Shipped") OR rider_id = ?)' : ''), rider ? [req.params.id, req.staff.id] : [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  res.json(o);
}));

router.put('/orders/:id/status', guard(SALES), wrap(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw fail(400, 'Unknown status');
  if (req.staff.role === 'Delivery rider' && !['Shipped', 'Delivered'].includes(status)) throw fail(403, 'Riders can only mark orders shipped or delivered');
  const [[o]] = await pool.query('SELECT status, rider_id FROM orders WHERE id = ?', [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  if (req.staff.role === 'Delivery rider' && !['Packed', 'Shipped'].includes(o.status) && o.rider_id !== req.staff.id) throw fail(404, 'Order not found');
  if (o.status !== status) {
    await applyFlow(req.params.id, FROM_STATUS[status], 'Updated in admin console');
    if (status === 'Delivered') await pool.query('UPDATE orders SET pay_status = IF(payment = "Cash on delivery", "Paid", pay_status) WHERE id = ?', [req.params.id]);
  }
  res.json((await loadOrders('WHERE id = ?', [req.params.id]))[0]);
}));

router.delete('/orders/:id', guard(ADMINS), wrap(async (req, res) => {
  await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- products & categories ----------
const prodOut = r => ({
  id: r.id, cat: r.category_id, brand: r.brand, name: r.name, old: r.old_price, price: r.price, img: r.img, stock: r.stock, popular: !!r.popular,
  isNew: !!r.is_new, featured: !!r.featured, active: !!r.active, tech: r.tech, color: r.color, yield: r.yield_info, part: r.part, compat: r.compat, spec: r.spec,
  description: r.description || '', gallery: parseJson(r.gallery) || [], source: r.source_url || '', edited: !!r.edited
});
const PROD_COLS = { cat: 'category_id', brand: 'brand', name: 'name', old: 'old_price', price: 'price', img: 'img', stock: 'stock', popular: 'popular', isNew: 'is_new', featured: 'featured', active: 'active', tech: 'tech', color: 'color', yield: 'yield_info', part: 'part', compat: 'compat', spec: 'spec' };
const BOOL = new Set(['popular', 'isNew', 'featured', 'active']);
const INT = new Set(['old', 'price', 'stock']);

router.get('/products', guard(ADMINS), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(name LIKE ? OR brand LIKE ? OR part LIKE ? OR id = ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q), Number(req.query.q) || 0); }
  if (req.query.cat && req.query.cat !== 'all') { cond.push('category_id = ?'); params.push(req.query.cat); }
  if (req.query.stock === 'low') cond.push('price > 0 AND stock <= 5');
  if (req.query.live === '0') cond.push('active = 0');
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM products ${where}`, params);
  const [rows] = await pool.query(`SELECT * FROM products ${where} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`, params);
  res.json({ total: n, rows: rows.map(prodOut) });
}));

function productPatch(body) {
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(PROD_COLS)) {
    if (!(k in body)) continue;
    let v = body[k];
    if (BOOL.has(k)) v = +!!v; else if (INT.has(k)) v = Math.max(0, parseInt(v, 10) || 0); else v = v == null ? '' : String(v);
    if (k === 'img' && !v) v = null;
    sets.push(`${col} = ?`); vals.push(v);
  }
  if ('description' in body) { sets.push('description = ?'); vals.push(sanitizeHtml(String(body.description || ''), SAN)); }
  if ('gallery' in body) { sets.push('gallery = ?'); vals.push(JSON.stringify((Array.isArray(body.gallery) ? body.gallery : []).map(String).filter(u => /^(https?:\/\/|\/api\/uploads\/)/.test(u)).slice(0, 12))); }
  if (sets.length) sets.push('edited = 1');
  return { sets, vals };
}

router.put('/products/:id', guard(ADMINS), wrap(async (req, res) => {
  const { sets, vals } = productPatch(req.body);
  if (!sets.length) throw fail(400, 'Nothing to update');
  const [r] = await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
  if (!r.affectedRows) throw fail(404, 'Product not found');
  const [[p]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json(prodOut(p));
}));

router.post('/products', guard(ADMINS), wrap(async (req, res) => {
  const b = req.body;
  if (!b.name || !b.cat || !b.brand) throw fail(400, 'Name, brand and category are required');
  const [[{ m }]] = await pool.query('SELECT COALESCE(MAX(id), 29999) m FROM products WHERE id >= 30000');
  const id = Math.max(30000, m + 1);
  await pool.query('INSERT INTO products (id,category_id,brand,name,old_price,price,img,stock,is_new,active,tech,color,yield_info,part,compat,spec,description,gallery,edited) VALUES (?,?,?,?,?,?,?,?,1,1,?,?,?,?,?,?,?,?,1)',
    [id, b.cat, b.brand, b.name, parseInt(b.old, 10) || 0, parseInt(b.price, 10) || 0, b.img || null, parseInt(b.stock, 10) || 0, b.tech || '', b.color || '', b.yield || '', b.part || '', b.compat || '', b.spec || '', sanitizeHtml(String(b.description || ''), SAN), JSON.stringify(Array.isArray(b.gallery) ? b.gallery.map(String).slice(0, 12) : (b.img ? [b.img] : []))]);
  const [[p]] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  res.json(prodOut(p));
}));

router.delete('/products/:id', guard(ADMINS), wrap(async (req, res) => {
  await pool.query('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.get('/categories', guard(ADMINS), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT c.id, c.title, c.description, c.hidden, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) n FROM categories c ORDER BY c.sort_order');
  res.json(rows.map(r => ({ id: r.id, title: r.title, description: r.description, hidden: !!r.hidden, count: r.n })));
}));
router.put('/categories/:id', guard(ADMINS), wrap(async (req, res) => {
  await pool.query('UPDATE categories SET hidden = ? WHERE id = ?', [+!!req.body.hidden, req.params.id]);
  res.json({ ok: true });
}));

// ---------- customers, services, inbox ----------
router.get('/customers', guard(ADMINS), wrap(async (req, res) => {
  const { size, p } = page(req);
  const [orders] = await pool.query('SELECT customer_name name, customer_phone phone, MAX(customer_email) email, COUNT(*) n, SUM(total) ltv, MAX(created_at) last FROM orders WHERE status <> "Cancelled" GROUP BY customer_phone, customer_name');
  const [users] = await pool.query('SELECT id, name, phone, email FROM users');
  const map = new Map(orders.map(o => [digits(o.phone).slice(-10), { name: o.name, phone: o.phone, email: o.email, n: o.n, ltv: Number(o.ltv), last: o.last }]));
  users.forEach(u => { const k = digits(u.phone).slice(-10); if (!map.has(k)) map.set(k, { name: u.name, phone: u.phone, email: u.email, userId: u.id, n: 0, ltv: 0, last: null }); else { const c = map.get(k); if (!c.email) c.email = u.email; c.userId = u.id; } });
  const q = String(req.query.q || '').toLowerCase();
  let list = [...map.values()].filter(c => !q || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q));
  list.sort((a, b) => b.ltv - a.ltv);
  res.json({ total: list.length, rows: list.slice((p - 1) * size, p * size) });
}));

// ---------- customer passwords: set directly, or create a one-time reset link and answer "forgot password" requests ----------
router.put('/customers/:id/password', guard(ADMINS), wrap(async (req, res) => {
  const pw = String(req.body.password || '');
  checkPassword(pw);
  const [r] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(pw, 10), req.params.id]);
  if (!r.affectedRows) throw fail(404, 'Customer account not found');
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [req.params.id]);
  res.json({ ok: true });
}));
router.post('/customers/:id/reset-link', guard(ADMINS), wrap(async (req, res) => {
  const [[u]] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!u) throw fail(404, 'Customer account not found');
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [u.id]);
  const token = crypto.randomBytes(24).toString('hex');
  await pool.query('INSERT INTO password_resets (user_id, token, requested, expires_at) VALUES (?,?,0,DATE_ADD(NOW(), INTERVAL 1 DAY))', [u.id, token]);
  res.json({ path: '/reset/' + token, hours: 24 });
}));
router.get('/password-resets', guard(ADMINS), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT r.id, r.user_id userId, u.name, u.phone, u.email, r.created_at created FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.requested = 1 AND r.used_at IS NULL AND r.expires_at > NOW() ORDER BY r.created_at DESC LIMIT 50');
  res.json(rows);
}));
router.delete('/password-resets/:id', guard(ADMINS), wrap(async (req, res) => { await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

router.get('/services', guard(ADMINS), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(id LIKE ? OR name LIKE ? OR phone LIKE ? OR model LIKE ?)'); params.push(...Array(4).fill(like(req.query.q))); }
  if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM service_requests ${where}`, params);
  const [rows] = await pool.query(`SELECT * FROM service_requests ${where} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
  res.json({ total: n, rows: rows.map(r => ({ id: r.id, type: r.type, name: r.name, phone: r.phone, model: r.model, issue: r.issue, date: r.preferred_date, status: r.status, created: r.created_at })) });
}));
router.put('/services/:id', guard(ADMINS), wrap(async (req, res) => {
  if (!['New', 'Scheduled', 'In progress', 'Completed'].includes(req.body.status)) throw fail(400, 'Unknown status');
  await pool.query('UPDATE service_requests SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ ok: true });
}));

// ---------- blog: managed by Admin and the Content writer role ----------
const SAN = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'a', 'img', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'figure', 'figcaption'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'loading'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, at) => ({ tagName: 'a', attribs: { ...at, target: '_blank', rel: 'noopener' } }),
    img: (tag, at) => ({ tagName: 'img', attribs: { src: at.src || '', alt: at.alt || '', loading: 'lazy' } }),
    div: 'p', b: 'strong', i: 'em'
  }
};
const slugify = s => String(s || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 120);
const textOf = html => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
const blogRow = r => ({ id: r.id, slug: r.slug, title: r.title, category: r.category, cover: r.cover, excerpt: r.excerpt, body: r.body, date: r.published, status: r.status, author: r.author, authorId: r.author_id, updated: r.updated_at });
const IMG_TYPES = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], gif: [0x47, 0x49, 0x46], webp: [0x52, 0x49, 0x46, 0x46] };

router.get('/blog', guard(BLOG), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(title LIKE ? OR category LIKE ? OR author LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
  if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM blog_posts ${where}`, params);
  const [rows] = await pool.query(`SELECT id, slug, title, category, cover, excerpt, author, author_id, status, DATE_FORMAT(published, "%Y-%m-%d") AS published, updated_at FROM blog_posts ${where} ORDER BY published DESC, id DESC LIMIT ${size} OFFSET ${offset}`, params);
  const [cats] = await pool.query('SELECT DISTINCT category FROM blog_posts ORDER BY category');
  res.json({ total: n, rows: rows.map(blogRow), categories: cats.map(c => c.category) });
}));
router.get('/blog/:id', guard(BLOG), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT *, DATE_FORMAT(published, "%Y-%m-%d") AS published FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!r) throw fail(404, 'Article not found');
  res.json(blogRow(r));
}));
const savePost = async (req, id) => {
  const b = req.body;
  const title = String(b.title || '').trim();
  if (title.length < 3) throw fail(400, 'Please enter a title');
  const body = sanitizeHtml(String(b.body || ''), SAN);
  if (textOf(body).length < 20) throw fail(400, 'The article text is too short');
  const category = String(b.category || 'Articles').trim().slice(0, 60) || 'Articles';
  const status = b.status === 'Draft' ? 'Draft' : 'Published';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : new Date().toISOString().slice(0, 10);
  const excerpt = (String(b.excerpt || '').trim() || textOf(body)).slice(0, 190);
  const cover = String(b.cover || '').trim().slice(0, 500);
  if (cover && !/^(https?:\/\/|\/api\/(media|uploads)\/)/.test(cover)) throw fail(400, 'Cover must be an uploaded image or an http(s) link');
  let slug = slugify(b.slug || title) || 'post-' + Date.now();
  const [dup] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? AND id <> ?', [slug, id || 0]);
  if (dup.length) { if (b.slug) throw fail(409, 'This web address is already used by another article'); slug += '-' + Date.now().toString(36).slice(-4); }
  return { title, body, category, status, date, excerpt, cover, slug };
};
router.post('/blog', guard(BLOG), wrap(async (req, res) => {
  const p = await savePost(req, 0);
  const [r] = await pool.query('INSERT INTO blog_posts (slug, title, category, cover, excerpt, body, published, status, author, author_id, edited, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,NOW())',
    [p.slug, p.title, p.category, p.cover, p.excerpt, p.body, p.date, p.status, req.staff.name, req.staff.id]);
  res.json({ id: r.insertId, slug: p.slug });
}));
router.put('/blog/:id', guard(BLOG), wrap(async (req, res) => {
  const [[cur]] = await pool.query('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!cur) throw fail(404, 'Article not found');
  const p = await savePost(req, cur.id);
  await pool.query('UPDATE blog_posts SET slug=?, title=?, category=?, cover=?, excerpt=?, body=?, published=?, status=?, edited=1, updated_at=NOW() WHERE id=?',
    [p.slug, p.title, p.category, p.cover, p.excerpt, p.body, p.date, p.status, cur.id]);
  res.json({ ok: true, slug: p.slug });
}));
router.delete('/blog/:id', guard(BLOG), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT author_id FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!r) throw fail(404, 'Article not found');
  if (req.staff.role === 'Content writer' && r.author_id !== req.staff.id) throw fail(403, 'Writers can delete only their own articles');
  await pool.query('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
// images for products / blog / servicing / clients / company pages are stored under server/uploads/<folder>/ (folder = section/category)
const FOLDER = /^(products|blog|services|clients|company)(\/[a-z0-9][a-z0-9-]{0,58}){0,2}$/;
router.post('/upload-image', guard([...ADMINS, 'Content writer']), wrap(async (req, res) => {
  const folder = String(req.body.folder || 'blog/general').toLowerCase();
  if (!FOLDER.test(folder)) throw fail(400, 'Unknown upload folder');
  if (req.staff.role === 'Content writer' && !/^(blog|services|clients|company)(\/|$)/.test(folder)) throw fail(403, 'Your role cannot upload product images');
  const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/.exec(String(req.body.data || ''));
  if (!m) throw fail(400, 'Choose a PNG, JPG, GIF or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) throw fail(400, 'Image is larger than 6 MB');
  const kind = m[1] === 'jpeg' ? 'jpg' : m[1];
  const sig = IMG_TYPES[kind];
  if (!sig || !sig.every((x, k) => buf[k] === x)) throw fail(400, 'That file is not a valid image');
  const base = slugify(String(req.body.name || 'image').replace(/\.[a-z0-9]+$/i, '')).slice(0, 40) || 'image';
  const file = `${base}-${Date.now().toString(36)}.${kind}`;
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), buf);
  res.json({ url: `/api/uploads/${folder}/${file}` });
}));

// ---------- site pages: servicing details, corporate clients, company profile ----------
const PAGES = [...ADMINS, 'Content writer'];
const pageRow = r => ({ id: r.id, slug: r.slug, group: r.grp, title: r.title, excerpt: r.excerpt, body: r.body, cover: r.cover, images: parseJson(r.images) || [], status: r.status, order: r.sort_order, edited: !!r.edited, updated: r.updated_at });
router.get('/pages', guard(PAGES), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM site_pages ORDER BY FIELD(grp, "servicing", "clients", "company"), sort_order, id');
  res.json(rows.map(pageRow));
}));
router.get('/pages/:id', guard(PAGES), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT * FROM site_pages WHERE id = ?', [req.params.id]);
  if (!r) throw fail(404, 'Page not found');
  res.json(pageRow(r));
}));
const savePage = (b) => {
  const title = String(b.title || '').trim();
  if (title.length < 3) throw fail(400, 'Please enter a title');
  const body = sanitizeHtml(String(b.body || ''), SAN);
  const cover = String(b.cover || '').trim().slice(0, 500);
  if (cover && !/^(https?:\/\/|\/api\/uploads\/)/.test(cover)) throw fail(400, 'Cover must be an uploaded image or an http(s) link');
  return { title, body, cover, excerpt: (String(b.excerpt || '').trim() || textOf(body)).slice(0, 190), status: b.status === 'Draft' ? 'Draft' : 'Published', order: parseInt(b.order, 10) || 0 };
};
router.put('/pages/:id', guard(PAGES), wrap(async (req, res) => {
  const p = savePage(req.body);
  const imgs = [...p.body.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
  const [r] = await pool.query('UPDATE site_pages SET title=?, excerpt=?, body=?, cover=?, images=?, status=?, sort_order=?, edited=1, updated_at=NOW() WHERE id=?',
    [p.title, p.excerpt, p.body, p.cover, JSON.stringify(imgs), p.status, p.order, req.params.id]);
  if (!r.affectedRows) throw fail(404, 'Page not found');
  res.json({ ok: true });
}));
router.post('/pages', guard(PAGES), wrap(async (req, res) => {
  const grp = ['servicing', 'clients', 'company'].includes(req.body.group) ? req.body.group : 'servicing';
  const p = savePage(req.body);
  let slug = slugify(req.body.slug || p.title) || 'page-' + Date.now();
  const [dup] = await pool.query('SELECT id FROM site_pages WHERE slug = ?', [slug]);
  if (dup.length) slug += '-' + Date.now().toString(36).slice(-4);
  const imgs = [...p.body.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
  const [r] = await pool.query('INSERT INTO site_pages (slug, grp, title, excerpt, body, cover, images, sort_order, status, edited, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,NOW())',
    [slug, grp, p.title, p.excerpt, p.body, p.cover, JSON.stringify(imgs), p.order, p.status]);
  res.json({ id: r.insertId, slug });
}));
router.delete('/pages/:id', guard(ADMINS), wrap(async (req, res) => { await pool.query('DELETE FROM site_pages WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

// ---------- product reviews moderation ----------
router.get('/reviews', guard(MKT), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(r.name LIKE ? OR r.body LIKE ? OR p.name LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
  if (req.query.status) { cond.push('r.status = ?'); params.push(req.query.status); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const from = 'FROM reviews r LEFT JOIN products p ON p.id = r.product_id';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n ${from} ${where}`, params);
  const [rows] = await pool.query(`SELECT r.*, p.name AS product ${from} ${where} ORDER BY (r.status = 'Pending') DESC, r.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
  const [[{ pending }]] = await pool.query('SELECT COUNT(*) pending FROM reviews WHERE status = "Pending"');
  res.json({ total: n, pending, rows: rows.map(r => ({ id: r.id, productId: r.product_id, product: r.product || ('#' + r.product_id), name: r.name, rating: r.rating, title: r.title, body: r.body, verified: !!r.verified, status: r.status, created: r.created_at, reviewed: r.reviewed_at })) });
}));
router.put('/reviews/:id', guard(MKT), wrap(async (req, res) => {
  if (!['Pending', 'Approved', 'Rejected'].includes(req.body.status)) throw fail(400, 'Unknown status');
  await pool.query('UPDATE reviews SET status = ?, reviewed_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ ok: true });
}));
router.delete('/reviews/:id', guard(MKT), wrap(async (req, res) => { await pool.query('DELETE FROM reviews WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

router.get('/messages', guard(MKT), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200');
  res.json({ chat: rows.filter(m => m.subject === 'Live chat').map(m => ({ id: m.id, text: m.body, at: m.created_at })), contact: rows.filter(m => m.subject !== 'Live chat').map(m => ({ id: m.id, name: m.name, contact: m.contact, company: m.company, body: m.body, at: m.created_at })) });
}));
router.delete('/messages/:id', guard(MKT), wrap(async (req, res) => { await pool.query('DELETE FROM messages WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

// ---------- marketing: subscribers, consent log, campaigns ----------
router.get('/subscribers', guard(MKT), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const q = req.query.q ? 'WHERE email LIKE ?' : '';
  const params = req.query.q ? [like(req.query.q)] : [];
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM subscribers ${q}`, params);
  const [rows] = await pool.query(`SELECT email, created_at FROM subscribers ${q} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
  res.json({ total: n, rows });
}));
router.post('/subscribers', guard(MKT), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
  await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [email]);
  res.json({ ok: true });
}));
router.delete('/subscribers/:email', guard(MKT), wrap(async (req, res) => {
  await pool.query('DELETE FROM subscribers WHERE email = ?', [req.params.email]);
  await pool.query('UPDATE consents SET status = "Unsubscribed" WHERE email = ? AND status <> "Unsubscribed"', [req.params.email]);
  res.json({ ok: true });
}));
router.get('/consents', guard(MKT), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(email LIKE ? OR source LIKE ?)'); params.push(like(req.query.q), like(req.query.q)); }
  if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM consents ${where}`, params);
  const [rows] = await pool.query(`SELECT * FROM consents ${where} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
  res.json({ total: n, rows: rows.map(c => ({ id: c.id, email: c.email, source: c.source, token: c.token, status: c.status, ip: c.ip, at: c.created_at, confirmedAt: c.confirmed_at })) });
}));
router.put('/consents/:id/confirm', guard(MKT), wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM consents WHERE id = ?', [req.params.id]);
  if (!c) throw fail(404, 'Not found');
  await pool.query('UPDATE consents SET status = "Confirmed", confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = ?', [c.id]);
  await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [c.email]);
  (await import('./mkt.js')).onSubscribed(c.email).catch(() => {});
  res.json({ ok: true });
}));

// ---------- careers ----------
router.get('/jobs', guard(ADMINS), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) apps FROM jobs j ORDER BY j.deadline DESC');
  res.json(rows.map(j => ({ id: j.id, title: j.title, dept: j.dept, type: j.type, loc: j.loc, exp: j.exp, salary: j.salary, vacancies: j.vacancies, deadline: j.deadline, open: !!j.open, about: j.about, resp: parseJson(j.resp) || [], req: parseJson(j.req) || [], perks: parseJson(j.perks) || [], apps: j.apps })));
}));
router.post('/jobs', guard(ADMINS), wrap(async (req, res) => {
  const j = req.body;
  if (!j.title || !j.dept) throw fail(400, 'Title and department are required');
  const id = j.id || 'J-' + (Math.floor(Date.now() / 1000) % 100000);
  const lines = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => s.trim()).filter(Boolean);
  await pool.query(
    `REPLACE INTO jobs (id,title,dept,type,loc,exp,salary,vacancies,deadline,open,about,resp,req,perks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, j.title, j.dept, j.type || 'Full-time', j.loc || '', j.exp || '', j.salary || '', parseInt(j.vacancies, 10) || 1,
      (j.deadline ? new Date(j.deadline) : new Date(Date.now() + 30 * 864e5)).toISOString().slice(0, 19).replace('T', ' '), +(j.open !== false), j.about || '',
      JSON.stringify(lines(j.resp)), JSON.stringify(lines(j.req)), JSON.stringify(lines(j.perks))]);
  res.json({ id });
}));
router.delete('/jobs/:id', guard(ADMINS), wrap(async (req, res) => {
  await pool.query('DELETE FROM applications WHERE job_id = ?', [req.params.id]);
  await pool.query('DELETE FROM jobs WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
router.get('/applications', guard(ADMINS), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT a.*, j.title job_title FROM applications a JOIN jobs j ON j.id = a.job_id ORDER BY a.created_at DESC');
  res.json(rows.map(a => ({ id: a.id, job: a.job_id, jobTitle: a.job_title, name: a.name, phone: a.phone, email: a.email, exp: a.exp, salary: a.salary, link: a.link, note: a.note, cv: a.cv_name, stage: a.stage, at: a.created_at })));
}));
router.put('/applications/:id', guard(ADMINS), wrap(async (req, res) => {
  if (!['New', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'].includes(req.body.stage)) throw fail(400, 'Unknown stage');
  await pool.query('UPDATE applications SET stage = ? WHERE id = ?', [req.body.stage, req.params.id]);
  res.json({ ok: true });
}));

// ---------- team ----------
router.get('/staff', guard(ADMINS), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM staff ORDER BY FIELD(status,"Pending","Active","Disabled"), created_at');
  res.json(rows.map(staffOut));
}));
router.put('/staff/:id', guard(ADMINS), wrap(async (req, res) => {
  const { role, status } = req.body;
  const [[t]] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
  if (!t) throw fail(404, 'Not found');
  if (t.id === req.staff.id) throw fail(400, 'You cannot change your own access');
  if (t.role === 'Super admin' && req.staff.role !== 'Super admin') throw fail(403, 'Only a Super admin can change a Super admin');
  if (role) { if (!ROLES.includes(role)) throw fail(400, 'Unknown role'); await pool.query('UPDATE staff SET role = ? WHERE id = ?', [role, t.id]); }
  if (status) { if (!['Active', 'Pending', 'Disabled'].includes(status)) throw fail(400, 'Unknown status'); await pool.query('UPDATE staff SET status = ? WHERE id = ?', [status, t.id]); }
  res.json({ ok: true });
}));

// ---------- settings ----------
router.get('/settings', guard(ADMINS), wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "site"');
  res.json(parseJson(row.v));
}));
router.put('/settings', guard(ADMINS), wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "site"');
  const cur = parseJson(row.v);
  const b = req.body, num = v => Math.max(0, parseInt(v, 10) || 0);
  const next = {
    ...cur,
    promo: b.promo ?? cur.promo, showPromo: b.showPromo ?? cur.showPromo, heroTitle: b.heroTitle ?? cur.heroTitle, heroSub: b.heroSub ?? cur.heroSub,
    offerTitle: b.offerTitle ?? cur.offerTitle, offerSub: b.offerSub ?? cur.offerSub,
    insideFee: 'insideFee' in b ? num(b.insideFee) : cur.insideFee, outsideFee: 'outsideFee' in b ? num(b.outsideFee) : cur.outsideFee,
    suburbFee: 'suburbFee' in b ? num(b.suburbFee) : cur.suburbFee, freeOver: 'freeOver' in b ? num(b.freeOver) : cur.freeOver,
    coupon: b.coupon ? String(b.coupon).toUpperCase() : cur.coupon, couponPct: 'couponPct' in b ? Math.min(90, num(b.couponPct)) : cur.couponPct,
    phone: b.phone ?? cur.phone, whatsapp: b.whatsapp ?? cur.whatsapp, email: b.email ?? cur.email, address: b.address ?? cur.address,
    payments: b.payments ?? cur.payments, svcPrices: b.svcPrices ?? cur.svcPrices,
    // home page category rows: products per category (1-20) and an on/off switch
    homeRailLimit: 'homeRailLimit' in b ? Math.min(20, Math.max(1, num(b.homeRailLimit))) : (cur.homeRailLimit ?? 20),
    homeRails: 'homeRails' in b ? !!b.homeRails : (cur.homeRails ?? true),
    // popups: only one is ever open at a time; the admin chooses which ones may show and when
    popupMode: ['one', 'sequential', 'promo', 'newsletter', 'off'].includes(b.popupMode) ? b.popupMode : (cur.popupMode ?? 'one'),
    promoDelay: 'promoDelay' in b ? Math.min(120, num(b.promoDelay)) : (cur.promoDelay ?? 1),
    nlDelay: 'nlDelay' in b ? Math.min(600, Math.max(1, num(b.nlDelay))) : (cur.nlDelay ?? 30),
    nlExit: 'nlExit' in b ? !!b.nlExit : (cur.nlExit ?? true)
  };
  await pool.query('UPDATE settings SET v = ? WHERE k = "site"', [JSON.stringify(next)]);
  res.json(next);
}));

export default router;
