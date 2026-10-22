import express from 'express';
import compression from 'compression';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { digits, fail, parseJson, wrap, checkPassword, readCookie } from './util.js';
import adminRouter from './admin.js';
import { mailContact, mailReady } from './mailer.js';
import { mountSeo } from './seo.js';
import accountRouter from './account.js';
import fieldRouter from './field.js';
import { hubRouter, liveRouter } from './hub.js';
import { mktRouter, onSubscribed, prefsRouter } from './mkt.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24)) {
  console.error('Refusing to start: set a long random JWT_SECRET in server/.env (e.g. openssl rand -hex 32).');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET || 'dev-secret';
const UPLOADS = path.resolve(here, '../uploads/cv');
fs.mkdirSync(UPLOADS, { recursive: true });

app.set('trust proxy', 1); // behind Nginx: req.ip is the real client
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

/** Rate limiter kept in MySQL (per IP + route group), so limits survive restarts. If the database hiccups it lets the request through. */
pool.query('CREATE TABLE IF NOT EXISTS rate_hits (k VARCHAR(120) PRIMARY KEY, n INT NOT NULL, reset_at BIGINT NOT NULL)').catch(() => {});
setInterval(() => pool.query('DELETE FROM rate_hits WHERE reset_at < ?', [Date.now()]).catch(() => {}), 10 * 60000).unref();
const limit = (name, max, windowMs) => async (req, res, next) => {
  try {
    const key = (name + '|' + req.ip).slice(0, 120), now = Date.now();
    await pool.query('INSERT INTO rate_hits (k, n, reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE n = IF(reset_at < ?, 1, n + 1), reset_at = IF(reset_at < ?, ?, reset_at)', [key, now + windowMs, now, now, now + windowMs]);
    const [[h]] = await pool.query('SELECT n, reset_at FROM rate_hits WHERE k = ?', [key]);
    if (h.n > max) { res.setHeader('Retry-After', Math.ceil((h.reset_at - now) / 1000)); return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' }); }
  } catch { /* fail open */ }
  next();
};
app.use(compression()); // the catalogue JSON is large; gzip keeps first load fast
if (process.env.NODE_ENV !== 'production') app.use(cors()); // production serves the app and API from one origin
app.use('/api/admin', express.json({ limit: '10mb' })); // image uploads (base64) are staff-only
app.use(express.json({ limit: '3mb' })); // everything else: small bodies (CV uploads are capped at 2 MB)
// blog images live in the project (server/uploads/blog) and are served through /api so the Vite dev proxy covers them too
app.use('/api/media', express.static(path.resolve(here, '../uploads/blog'), { maxAge: '7d', fallthrough: false })); // old blog image links
// every imported / uploaded image lives under server/uploads/<products|blog|services|clients|company>/<category>/
app.use('/api/uploads', (req, res, next) => (/^\/(cv|vouchers)(\/|$)/i.test(req.path) ? res.status(404).end() : next())); // private folders are never served
app.use('/api/uploads', express.static(path.resolve(here, '../uploads'), { maxAge: '7d', fallthrough: false, index: false, dotfiles: 'deny' }));

const AREAS = ['inside', 'suburb', 'outside'];
const PARTIAL = ['split', 'together', 'drop'];

const productOut = r => ({
  id: r.id, cat: r.category_id, brand: r.brand, name: r.name, old: r.old_price, price: r.price, img: r.img, stock: r.stock,
  popular: !!r.popular, isNew: !!r.is_new, featured: !!r.featured, tech: r.tech, color: r.color, yield: r.yield_info,
  part: r.part, compat: r.compat, spec: r.spec, extra: parseJson(r.extra) || []
});
const seoOut = r => ({ metaTitle: r.meta_title || '', metaDesc: r.meta_desc || '', metaKeywords: r.meta_keywords || '' });
const userOut = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, address: u.address, area: u.area, role: u.role });
const sign = u => jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '30d' });
/** The customer session lives in an HttpOnly cookie, so page scripts (and any XSS) can never read the token. */
const COOKIE = 'ar_session';
const setSession = (req, res, u) => res.append('Set-Cookie', `${COOKIE}=${sign(u)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${req.secure ? '; Secure' : ''}`);
const sendAuth = (req, res, u, extra = {}) => { setSession(req, res, u); res.json({ user: userOut(u), ...extra }); };

function auth(required) {
  return (req, res, next) => {
    try { req.user = jwt.verify(readCookie(req, COOKIE) || (req.headers.authorization || '').replace(/^Bearer /, ''), SECRET); } catch { req.user = null; }
    if (required && !req.user) return res.status(401).json({ error: 'Please sign in' });
    next();
  };
}

async function getSettings() {
  const [rows] = await pool.query('SELECT k, v FROM settings');
  const o = {};
  rows.forEach(r => { o[r.k] = parseJson(r.v); });
  return o;
}

// ---------- catalog ----------
// best sellers: ranked by units on non-cancelled orders; products with no sales yet fall back to the "popular"/"featured" flags
app.get('/api/bestsellers', wrap(async (req, res) => {
  const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 6));
  const [rows] = await pool.query(`SELECT p.*, COALESCE(s.q, 0) AS sold FROM products p
    LEFT JOIN (SELECT i.product_id, SUM(i.qty) q FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'Cancelled' GROUP BY i.product_id) s ON s.product_id = p.id
    WHERE p.active = 1 ORDER BY sold DESC, p.popular DESC, p.featured DESC, p.id DESC LIMIT ?`, [limit]);
  res.json({ products: rows.map(r => ({ ...productOut(r), sold: Number(r.sold) })) });
}));

// one product with its full description and image gallery (the catalogue list in /api/bootstrap stays light)
app.get('/api/products/:id', wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT * FROM products WHERE id = ? AND active = 1', [parseInt(req.params.id, 10) || 0]);
  if (!r) throw fail(404, 'Product not found');
  const [imgs] = await pool.query('SELECT path, alt FROM product_images WHERE product_id = ? ORDER BY position', [r.id]);
  const [specs] = await pool.query('SELECT name, value FROM product_specs WHERE product_id = ? ORDER BY position', [r.id]);
  res.json({ ...productOut(r), description: r.description || '', short: r.short_desc || '', sku: r.sku || '', tags: parseJson(r.tags) || [], specs, ...seoOut(r),
    gallery: imgs.length ? imgs.map(x => x.path) : (parseJson(r.gallery) || []), source: r.source_url || '' });
}));

// servicing details, corporate clients and company pages managed from the admin console
const pageOut = r => ({ id: r.id, slug: r.slug, group: r.grp, title: r.title, excerpt: r.excerpt, cover: r.cover, images: parseJson(r.images) || [], body: r.body });
app.get('/api/pages', wrap(async (req, res) => {
  const g = ['servicing', 'clients', 'company'].includes(req.query.group) ? req.query.group : null;
  const [rows] = await pool.query(`SELECT * FROM site_pages WHERE status = 'Published' ${g ? 'AND grp = ?' : ''} ORDER BY grp, sort_order, id`, g ? [g] : []);
  res.json({ pages: rows.map(pageOut) });
}));
app.get('/api/pages/:slug', wrap(async (req, res) => {
  const [[r]] = await pool.query("SELECT * FROM site_pages WHERE slug = ? AND status = 'Published'", [req.params.slug]);
  if (!r) throw fail(404, 'Page not found');
  res.json(pageOut(r));
}));

app.get('/api/bootstrap', wrap(async (req, res) => {
  const [cats] = await pool.query('SELECT id, title AS t, description AS d FROM categories WHERE hidden = 0 ORDER BY sort_order');
  const [prods] = await pool.query('SELECT * FROM products WHERE active = 1 ORDER BY id DESC');
  const s = await getSettings();
  res.json({ cats, products: prods.map(productOut), site: s.site, content: s.content });
}));

// ---------- auth ----------
app.post('/api/auth/register', limit('register', 10, 3600000), wrap(async (req, res) => {
  const { name, email, phone, password, address, area } = req.body;
  if (!name || !email || !password) throw fail(400, 'Name, email and a password are required');
  checkPassword(password);
  if (!/^01\d{9}$/.test(digits(phone))) throw fail(400, 'Enter a valid mobile number (01XXXXXXXXX)');
  const [ex] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email.toLowerCase(), digits(phone)]);
  if (ex.length) throw fail(409, 'An account with this email or mobile already exists');
  const hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query('INSERT INTO users (name,email,phone,password_hash,address,area) VALUES (?,?,?,?,?,?)',
    [name, email.toLowerCase(), digits(phone), hash, address || '', AREAS.includes(area) ? area : 'inside']);
  const [[u]] = await pool.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
  sendAuth(req, res, u);
}));

// Forgot password: there is no mail provider, so a request is queued for staff, who send the customer a one-time link
// (e.g. on WhatsApp) from Admin > Customers. Answers are identical whether or not the account exists.
app.post('/api/auth/forgot', limit('forgot', 6, 1800000), wrap(async (req, res) => {
  const id = String(req.body.id || '').trim().toLowerCase();
  if (id.length < 5) throw fail(400, 'Enter your mobile number or email');
  const [[u]] = await pool.query('SELECT id FROM users WHERE email = ? OR (phone <> "" AND phone = ?)', [id, digits(id).slice(-11)]);
  if (u) {
    await pool.query('DELETE FROM password_resets WHERE user_id = ? AND requested = 1 AND used_at IS NULL', [u.id]);
    await pool.query('INSERT INTO password_resets (user_id, token, requested, expires_at) VALUES (?,?,1,DATE_ADD(NOW(), INTERVAL 3 DAY))', [u.id, crypto.randomBytes(24).toString('hex')]);
  }
  res.json({ ok: true });
}));
app.get('/api/auth/reset/:token', wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT u.name FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token = ? AND r.used_at IS NULL AND r.expires_at > NOW() AND r.requested = 0', [req.params.token]);
  if (!r) throw fail(404, 'This reset link is invalid or has expired');
  res.json({ name: r.name });
}));
app.post('/api/auth/reset', limit('reset', 10, 1800000), wrap(async (req, res) => {
  const pw = String(req.body.password || '');
  checkPassword(pw);
  const [[r]] = await pool.query('SELECT id, user_id FROM password_resets WHERE token = ? AND used_at IS NULL AND expires_at > NOW() AND requested = 0', [String(req.body.token || '')]);
  if (!r) throw fail(400, 'This reset link is invalid or has expired');
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(pw, 10), r.user_id]);
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ?', [r.user_id]);
  const [[u]] = await pool.query('SELECT * FROM users WHERE id = ?', [r.user_id]);
  sendAuth(req, res, u);
}));

// ---------- social sign-in / registration (Google, Facebook) ----------
// Needs credentials in server/.env: GOOGLE_CLIENT_ID, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET. Without them the buttons report "not set up".
const SOCIAL = () => ({ google: process.env.GOOGLE_CLIENT_ID || null, facebook: process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET ? process.env.FACEBOOK_APP_ID : null });
app.post('/api/auth/logout', (req, res) => { res.append('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`); res.json({ ok: true }); });
app.get('/api/auth/social/config', (req, res) => res.json(SOCIAL()));
const getJ = async url => { const r = await fetch(url); const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(401, 'Could not verify your sign-in. Please try again.'); return j; };
app.post('/api/auth/social', limit('social', 20, 600000), wrap(async (req, res) => {
  const { provider, token } = req.body;
  const cfg = SOCIAL();
  if (!['google', 'facebook'].includes(provider) || !cfg[provider]) throw fail(400, (provider === 'facebook' ? 'Facebook' : 'Google') + ' sign-in is not set up yet.');
  if (!token) throw fail(400, 'Missing sign-in token');
  let email, name, ok = false;
  if (provider === 'google') {
    const j = await getJ('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    ok = j.aud === cfg.google && (j.email_verified === 'true' || j.email_verified === true);
    email = j.email; name = j.name;
  } else {
    const app = process.env.FACEBOOK_APP_ID + '|' + process.env.FACEBOOK_APP_SECRET;
    const d = await getJ(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(app)}`);
    ok = !!(d.data && d.data.is_valid && String(d.data.app_id) === String(cfg.facebook));
    if (ok) { const me = await getJ(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`); email = me.email; name = me.name; }
  }
  if (!ok) throw fail(401, 'Could not verify your sign-in. Please try again.');
  if (!email) throw fail(400, 'Your ' + provider + ' account did not share an email address. Please register with your email instead.');
  email = String(email).toLowerCase().slice(0, 160);
  let [[u]] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!u) {
    const locked = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 8);
    const [r] = await pool.query('INSERT INTO users (name,email,phone,password_hash,profile) VALUES (?,?,?,?,?)', [String(name || email.split('@')[0]).slice(0, 120), email, '', locked, JSON.stringify({ signup: provider })]);
    [[u]] = await pool.query('SELECT * FROM users WHERE id = ?', [r.insertId]);
  }
  sendAuth(req, res, u, { created: !u.phone });
}));

app.post('/api/auth/login', limit('login', 12, 600000), wrap(async (req, res) => {
  const id = String(req.body.id || req.body.email || '').trim().toLowerCase();
  const [[u]] = await pool.query('SELECT * FROM users WHERE email = ? OR (phone <> "" AND phone = ?)', [id, digits(id)]);
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash))) throw fail(401, 'Wrong mobile/email or password.');
  sendAuth(req, res, u);
}));

app.get('/api/auth/me', auth(true), wrap(async (req, res) => {
  const [[u]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!u) throw fail(401, 'Please sign in');
  res.json({ user: userOut(u) });
}));

app.put('/api/auth/me', auth(true), wrap(async (req, res) => {
  const { name, phone, address, area } = req.body;
  await pool.query('UPDATE users SET name = COALESCE(?,name), phone = COALESCE(?,phone), address = COALESCE(?,address), area = ? WHERE id = ?',
    [name ?? null, phone != null ? digits(phone) : null, address ?? null, AREAS.includes(area) ? area : 'inside', req.user.id]);
  const [[u]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: userOut(u) });
}));

// ---------- pricing (mirrors the design's AR.totals) ----------
async function priceOrder(items, { area, coupon, userId, express, partial }) {
  const s = (await getSettings()).site;
  if (!Array.isArray(items) || items.length > 100) throw fail(400, 'Your cart is empty or too large');
  const ids = items.map(i => parseInt(i?.id, 10)).filter(Number.isInteger);
  const [rows] = ids.length ? await pool.query('SELECT * FROM products WHERE active = 1 AND id IN (?)', [ids]) : [[]];
  const byId = new Map(rows.map(r => [r.id, r]));
  const mode = PARTIAL.includes(partial) ? partial : 'split';

  const lines = items.map(it => {
    const p = byId.get(parseInt(it?.id, 10));
    const qty = Math.max(1, Math.min(999, parseInt(it.qty, 10) || 1));
    if (!p) throw fail(400, 'A product in your cart is no longer available');
    if (!p.price) throw fail(400, `${p.name} needs a quotation — please contact us`);
    const avail = Math.max(0, Math.min(qty, p.stock));
    return { p, qty, avail, short: qty - avail, held: p.price >= 100000, chargeQty: mode === 'drop' ? avail : qty };
  });
  const subtotal = lines.reduce((a, l) => a + l.p.price * l.chargeQty, 0);
  const saved = lines.reduce((a, l) => a + Math.max(0, (l.p.old_price || l.p.price) - l.p.price) * l.chargeQty, 0);

  const cu = String(coupon || '').trim().toUpperCase();
  const welcome = cu === 'WELCOME10';
  const okCoupon = !!cu && (cu === String(s.coupon).toUpperCase() || welcome);
  const discount = okCoupon ? Math.round(subtotal * (welcome ? 10 : s.couponPct) / 100) : 0;
  const memberPct = userId ? s.memberPct : 0;
  const member = Math.round((subtotal - discount) * memberPct / 100);

  const zone = AREAS.includes(area) ? area : 'inside';
  const base = zone === 'outside' ? s.outsideFee : zone === 'suburb' ? s.suburbFee : s.insideFee;
  const freeElig = zone !== 'outside' && subtotal >= s.freeOver;
  const expressFee = express && zone === 'inside' ? s.expressFee : 0;
  const delivery = subtotal ? (freeElig ? 0 : base) + expressFee : 0;
  const total = Math.max(0, subtotal - discount - member + delivery);
  const vat = Math.round(total * s.vatPct / (100 + s.vatPct));

  return {
    lines, subtotal, saved, discount, member, memberPct, delivery, express: expressFee, base, freeOver: s.freeOver, freeElig,
    freeLeft: zone === 'outside' ? 0 : Math.max(0, s.freeOver - subtotal), zone, total, vat, vatPct: s.vatPct,
    okCoupon, coupon: okCoupon ? cu : '', heldN: lines.filter(l => l.held).length, shortN: lines.filter(l => l.short > 0).length,
    count: lines.reduce((a, l) => a + l.qty, 0), partial: mode,
    short: lines.filter(l => l.short > 0).map(l => ({ id: l.p.id, name: l.p.name, avail: l.avail, qty: l.qty }))
  };
}

const quoteOut = t => ({
  subtotal: t.subtotal, saved: t.saved, discount: t.discount, member: t.member, memberPct: t.memberPct, delivery: t.delivery, express: t.express,
  freeOver: t.freeOver, freeElig: t.freeElig, freeLeft: t.freeLeft, zone: t.zone, total: t.total, vat: t.vat, vatPct: t.vatPct,
  okCoupon: t.okCoupon, heldN: t.heldN, count: t.count, short: t.short
});

app.post('/api/quote', auth(false), wrap(async (req, res) => {
  const t = await priceOrder(req.body.items || [], { ...req.body, userId: req.user?.id });
  res.json(quoteOut(t));
}));

// ---------- orders ----------
async function hydrateOrders(rows) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [ids]);
  const [hist] = await pool.query('SELECT * FROM order_history WHERE order_id IN (?) ORDER BY id', [ids]);
  return rows.map(r => ({
    id: r.id, date: r.created_at, status: r.status, payment: r.payment, gateway: r.gateway, payStatus: r.pay_status, area: r.area,
    address: r.address, note: r.note, slot: r.slot, partial: r.partial, hold: !!r.hold, holdNote: r.hold_note, vatInvoice: !!r.vat_invoice,
    company: r.company, bin: r.bin, express: !!r.express,
    customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email },
    subtotal: r.subtotal, discount: r.discount + r.member_discount, delivery: r.delivery, total: r.total, vat: r.vat,
    items: items.filter(i => i.order_id === r.id).map(i => ({ id: i.product_id, name: i.name, img: i.img, price: i.price, qty: i.qty, backorder: i.backorder })),
    history: hist.filter(h => h.order_id === r.id).map(h => ({ s: h.status, at: h.at }))
  }));
}

app.post('/api/orders', auth(false), wrap(async (req, res) => {
  const { items, customer = {}, address, area, payment, gateway, paid, note, coupon, express, partial, slot, vatInvoice, company, bin } = req.body;
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Your cart is empty');
  if (!customer.name || !customer.phone || !address) throw fail(400, 'Name, phone and delivery address are required');
  const t = await priceOrder(items, { area, coupon, userId: req.user?.id, express, partial });
  const live = t.lines.filter(l => l.chargeQty > 0);
  if (!live.length) throw fail(400, 'None of the items in your cart are in stock right now');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[{ n }]] = await conn.query('SELECT COUNT(*) n FROM orders');
    const id = 'AR-' + (10500 + n + 1);
    const hold = t.heldN > 0;
    await conn.query(
      `INSERT INTO orders (id,user_id,customer_name,customer_phone,customer_email,company,bin,address,area,subtotal,discount,member_discount,delivery,express,total,vat,
         payment,gateway,pay_status,partial,slot,vat_invoice,hold,hold_note,note,coupon) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.user?.id || null, customer.name, customer.phone, customer.email || '', vatInvoice ? (company || '') : '', vatInvoice ? (bin || '') : '', address, t.zone,
        t.subtotal, t.discount, t.member, t.delivery, +!!t.express, t.total, t.vat, payment || 'Cash on delivery', gateway || '', paid ? 'Paid' : 'Unpaid',
        t.partial, slot || '', +!!vatInvoice, +hold, hold ? 'High-value / special-order items held until our team approves them' : '', note || '', t.coupon]);
    for (const l of live) {
      if (l.avail) {
        const [u] = await conn.query('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [l.avail, l.p.id, l.avail]);
        if (!u.affectedRows) throw fail(409, `"${l.p.name}" just went out of stock — please review your cart`);
      }
      const backorder = t.partial === 'drop' ? 0 : l.short;
      await conn.query('INSERT INTO order_items (order_id,product_id,name,img,price,qty,backorder) VALUES (?,?,?,?,?,?,?)', [id, l.p.id, l.p.name, l.p.img, l.p.price, l.chargeQty, backorder]);
    }
    await conn.query('INSERT INTO order_history (order_id,status) VALUES (?,?)', [id, 'Pending']);
    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    res.json((await hydrateOrders(rows))[0]);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}));

app.get('/api/orders', auth(true), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(await hydrateOrders(rows));
}));

app.get('/api/orders/track', limit('track', 30, 600000), wrap(async (req, res) => {
  const id = String(req.query.id || '').trim().toUpperCase();
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  const o = rows[0];
  if (!o || !digits(req.query.phone) || digits(o.customer_phone).slice(-10) !== digits(req.query.phone).slice(-10)) {
    throw fail(404, 'No order found with that ID and mobile number.');
  }
  res.json((await hydrateOrders([o]))[0]);
}));

// ---------- services, contact ----------
app.post('/api/services', limit('svcreq', 8, 1800000), wrap(async (req, res) => {
  const { type, name, phone, model, issue, date, mkt, mktEmail } = req.body;
  if (!type || !name || !phone) throw fail(400, 'Service type, name and phone are required');
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM service_requests');
  const id = 'SV-' + (2092 + n);
  await pool.query('INSERT INTO service_requests (id,type,name,phone,model,issue,preferred_date) VALUES (?,?,?,?,?,?,?)',
    [id, type, name, phone, model || '', issue || '', date || null]);
  if (mkt && mktEmail) await optIn(mktEmail, 'Service booking · ' + id, req.ip);
  res.json({ id });
}));

app.post('/api/contact', limit('contact', 8, 1800000), wrap(async (req, res) => {
  const { name, contact, company, msg, subject } = req.body;
  if (!name || !msg) throw fail(400, 'Name and message are required');
  if (String(name).length > 120 || String(contact || '').length > 160 || String(company || '').length > 160 || String(subject || '').length > 160 || String(msg).length > 5000) throw fail(400, 'One of the fields is too long');
  await pool.query('INSERT INTO messages (name,contact,company,subject,body) VALUES (?,?,?,?,?)', [name, contact || '', company || '', subject || '', msg]);
  // the message is already saved for the admin inbox; the email is a best-effort notification
  if (mailReady()) {
    const shop = (await getSettings()).site?.email;
    mailContact({ name, contact, company, msg, subject }, shop).catch(e => console.error('contact mail failed:', e.message));
  }
  res.json({ ok: true });
}));

app.post('/api/chat', limit('chat', 40, 600000), wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 1000);
  if (text) await pool.query('INSERT INTO messages (name,subject,body) VALUES (?,?,?)', ['Live chat visitor', 'Live chat', text]);
  res.json({ ok: true });
}));

// ---------- email opt-in (double opt-in, as in the design) ----------
async function optIn(emailRaw, source, ip) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
  const [[ex]] = await pool.query('SELECT token, status FROM consents WHERE email = ? AND status <> "Unsubscribed" ORDER BY id DESC LIMIT 1', [email]);
  if (ex?.status === 'Confirmed') return { email, token: ex.token, status: 'Confirmed' };
  const token = 'OPT-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  await pool.query('INSERT INTO consents (email,source,token,ip) VALUES (?,?,?,?)', [email, source || '', token, ip || '']);
  return { email, token, status: 'Pending' };
}

app.post('/api/optin', limit('optin', 8, 1800000), wrap(async (req, res) => { res.json(await optIn(req.body.email, req.body.source, req.ip)); }));

app.post('/api/optin/confirm', wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM consents WHERE token = ?', [req.body.token]);
  if (!c) throw fail(404, 'This confirmation link is not valid');
  await pool.query('UPDATE consents SET status = "Confirmed", confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = ?', [c.id]);
  await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [c.email]);
  await onSubscribed(c.email);
  res.json({ ok: true, email: c.email, token: c.token });
}));

// ---------- product reviews (published only after an admin approves them) ----------
app.get('/api/products/:id/reviews', auth(false), wrap(async (req, res) => {
  const pid = parseInt(req.params.id, 10);
  const [rows] = await pool.query('SELECT id, name, rating, title, body, verified, created_at FROM reviews WHERE product_id = ? AND status = "Approved" ORDER BY created_at DESC LIMIT 100', [pid]);
  const dist = [0, 0, 0, 0, 0];
  rows.forEach(r => { dist[r.rating - 1]++; });
  const avg = rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0;
  let mine = null;
  if (req.user) {
    const [[m]] = await pool.query('SELECT status FROM reviews WHERE product_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1', [pid, req.user.id]);
    mine = m ? m.status : null;
  }
  res.json({ count: rows.length, avg: Math.round(avg * 10) / 10, dist, mine, reviews: rows.map(r => ({ id: r.id, name: r.name, rating: r.rating, title: r.title, body: r.body, verified: !!r.verified, at: r.created_at })) });
}));

app.post('/api/products/:id/reviews', auth(true), wrap(async (req, res) => {
  const pid = parseInt(req.params.id, 10);
  const [[prod]] = await pool.query('SELECT id FROM products WHERE id = ?', [pid]);
  if (!prod) throw fail(404, 'Product not found');
  const rating = parseInt(req.body.rating, 10);
  const body = String(req.body.body || '').trim();
  const title = String(req.body.title || '').trim().slice(0, 120);
  if (!(rating >= 1 && rating <= 5)) throw fail(400, 'Please choose a star rating');
  if (body.length < 10) throw fail(400, 'Please write at least 10 characters');
  if (body.length > 1500) throw fail(400, 'Review is too long (1500 characters max)');
  const [[dup]] = await pool.query('SELECT id FROM reviews WHERE product_id = ? AND user_id = ? AND status <> "Rejected"', [pid, req.user.id]);
  if (dup) throw fail(409, 'You have already reviewed this product');
  const [[u]] = await pool.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
  const [[bought]] = await pool.query('SELECT COUNT(*) n FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.user_id = ? AND i.product_id = ? AND o.status = "Delivered"', [req.user.id, pid]);
  await pool.query('INSERT INTO reviews (product_id, user_id, name, rating, title, body, verified) VALUES (?,?,?,?,?,?,?)', [pid, req.user.id, (u && u.name) || 'Customer', rating, title, body, bought.n > 0 ? 1 : 0]);
  res.json({ ok: true, status: 'Pending' });
}));

// ---------- blog ----------
const blogOut = r => ({ slug: r.slug, title: r.title, category: r.category, cover: r.cover, excerpt: r.excerpt, date: r.published, author: r.author });
app.get('/api/blog', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT slug, title, category, cover, excerpt, author, DATE_FORMAT(published, "%Y-%m-%d") AS published FROM blog_posts WHERE status = "Published" ORDER BY published DESC, id DESC');
  res.json({ posts: rows.map(blogOut) });
}));
app.get('/api/blog/:slug', wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT *, DATE_FORMAT(published, "%Y-%m-%d") AS published FROM blog_posts WHERE slug = ? AND status = "Published"', [req.params.slug]);
  if (!r) throw fail(404, 'Article not found');
  const [rel] = await pool.query('SELECT slug, title, category, cover, excerpt, author, DATE_FORMAT(published, "%Y-%m-%d") AS published FROM blog_posts WHERE status = "Published" AND slug <> ? ORDER BY (category = ?) DESC, published DESC LIMIT 3', [r.slug, r.category]);
  res.json({ post: { ...blogOut(r), body: r.body, source: r.source_url }, related: rel.map(blogOut) });
}));

// ---------- careers ----------
const jobOut = j => ({
  id: j.id, title: j.title, dept: j.dept, type: j.type, loc: j.loc, exp: j.exp, salary: j.salary, vacancies: j.vacancies,
  deadline: j.deadline, open: !!j.open && new Date(j.deadline) > new Date(), about: j.about,
  resp: parseJson(j.resp) || [], req: parseJson(j.req) || [], perks: parseJson(j.perks) || []
});

app.get('/api/jobs', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM jobs ORDER BY deadline');
  res.json(rows.map(jobOut));
}));

app.post('/api/jobs/:id/apply', limit('apply', 5, 3600000), wrap(async (req, res) => {
  const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
  if (!job || !jobOut(job).open) throw fail(400, 'This role is no longer accepting applications.');
  const { name, phone, email, exp, salary, link, note, cvName, cvData } = req.body;
  if (!name || !/^01[3-9]\d{8}$/.test(digits(phone).slice(-11))) throw fail(400, 'Enter a valid Bangladeshi mobile number.');
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(cvData || '');
  if (!m) throw fail(400, 'Please attach your CV (PDF or Word).');
  const ext = { 'application/pdf': '.pdf', 'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx' }[m[1]];
  if (!ext) throw fail(400, 'CV must be a PDF or Word file.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1048576) throw fail(400, 'CV must be under 2 MB.');
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM applications');
  const id = 'APP-' + (2004 + n);
  const file = `${id}${ext}`;
  fs.writeFileSync(path.join(UPLOADS, file), buf);
  await pool.query('INSERT INTO applications (id,job_id,name,phone,email,exp,salary,link,note,cv_name,cv_file) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [id, job.id, name, digits(phone), email || '', exp || '', salary || '', link || '', note || '', String(cvName || file).slice(0, 255), file]);
  res.json({ id });
}));

app.use(['/api/admin/login', '/api/admin/register'], limit('stafflogin', 15, 10 * 60000));
app.use('/api/field/login', limit('fieldlogin', 15, 10 * 60000));
app.use('/api/admin', adminRouter);
app.use('/api/account', accountRouter);
app.use('/api/field', fieldRouter);
app.use('/api/hub', hubRouter);
app.use('/api/live', liveRouter);
app.use('/api/mkt', mktRouter);
app.use('/api/prefs', prefsRouter);

// ---------- production: serve the built client ----------
const dist = path.resolve(here, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false }));
  mountSeo(app, dist); // robots.txt, sitemap.xml and the HTML shell with per-page meta tags
}

// last resort: body-parser / routing errors as JSON, never an HTML stack trace
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status === 400 ? 'Invalid request' : status === 413 ? 'Request is too large' : status >= 500 ? 'Server error' : err.message });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`AR Trade API on http://localhost:${port}`));
