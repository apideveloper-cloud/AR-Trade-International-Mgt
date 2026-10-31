import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import sanitizeHtml from 'sanitize-html';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { digits, fail, parseJson, wrap, checkPassword, secret, isLocalImg, localImg } from './util.js';
import { applyFlow, cancelOrder, FROM_STATUS } from './flow.js';
import { buildInvoicePdf, invoiceNo } from './invoice.js';
import { buildOverview, buildProductReport } from './overview.js';
import { runBackup, status as backupStatus, fileOf as backupFile, deleteBackup, setDir as setBackupDir } from './backup.js';
import { mailReady, mailSetupHint, sendMail } from './mailer.js';
import { addRange, day } from './listing.js';
import { can, permsOf, matrix, saveRole, DEFAULTS, MASTER, MASTER_ONLY, ROLE_DEFS, ROLE_NAMES, REGISTRABLE } from './permissions.js';

const router = Router();
const CV_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/cv');
const STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

const staffOut = s => ({ id: s.id, name: s.name, email: s.email, phone: s.phone, role: s.role, status: s.status, since: s.created_at });
/** The signed-in user as the console needs it: includes the permissions their role holds right now. */
const meOut = s => ({ ...staffOut(s), perms: [...permsOf(s.role)] });
const sign = (s, remember = false) => jwt.sign({ sid: s.id, srole: s.role }, secret(), { expiresIn: remember ? '7d' : '12h' }); // "Remember me" keeps the session for 7 days

/** Express middleware: requires a signed-in, active staff member. `need` is a permission (or a list: any one is enough) from the role matrix. */
export const guard = need => async (req, res, next) => {
  try {
    let t;
    try { t = jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), secret()); } catch { throw fail(401, 'Please sign in to the admin console'); }
    if (!t.sid) throw fail(401, 'Please sign in to the admin console');
    const [[s]] = await pool.query('SELECT * FROM staff WHERE id = ?', [t.sid]);
    if (!s || s.status !== 'Active') throw fail(401, 'Your account is not active');
    if (need && !can(s, need)) throw fail(403, 'Your role cannot do this');
    req.staff = s;
    next();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};

const page = req => {
  const size = Math.min(100, Math.max(5, parseInt(req.query.size, 10) || 10));
  const p = Math.max(1, parseInt(req.query.page, 10) || 1);
  return { size, p, offset: (p - 1) * size };
};
const like = q => `%${String(q || '').trim()}%`;
const inRange = (d, req) => { const a = day(req.query.from), b = day(req.query.to); const t = d ? new Date(d).getTime() : NaN; return (!a || t >= Date.parse(a + 'T00:00:00')) && (!b || t < Date.parse(b + 'T00:00:00') + 864e5); };

// ---------- auth ----------
router.post('/login', wrap(async (req, res) => {
  const id = String(req.body.id || '').trim().toLowerCase();
  const [[s]] = await pool.query('SELECT * FROM staff WHERE email = ? OR (phone <> "" AND phone = ?)', [id, digits(id)]);
  if (!s || !(await bcrypt.compare(req.body.password || '', s.password_hash))) throw fail(401, 'Wrong mobile/email or password.');
  // the role picked on the sign-in page has to be this account's role (checked only once the password is right, so it reveals nothing to a guesser)
  const want = String(req.body.role || '').trim();
  if (want && want !== s.role) throw fail(403, `This account is not ${/^[AEIOU]/i.test(want) ? 'an' : 'a'} ${want}. It is registered as ${s.role}. Pick ${s.role} and sign in again.`);
  if (s.status === 'Pending') throw fail(403, 'Your account is waiting for an admin to approve it.');
  if (s.status !== 'Active') throw fail(403, 'This account is disabled.');
  res.json({ token: sign(s, req.body.remember === true), staff: meOut(s) });
}));

router.post('/register', wrap(async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !email || !password) throw fail(400, 'Name, work email and a password are required.');
  checkPassword(password);
  if (!/^01[3-9]\d{8}$/.test(digits(phone).slice(-11))) throw fail(400, 'Enter a valid 11-digit mobile number (01XXXXXXXXX).');
  if (!REGISTRABLE.includes(role)) throw fail(400, 'Choose one of the listed roles.');
  const [ex] = await pool.query('SELECT id FROM staff WHERE email = ? OR phone = ?', [email.toLowerCase(), digits(phone).slice(-11)]);
  if (ex.length) throw fail(409, 'This email or mobile number is already registered.');
  await pool.query('INSERT INTO staff (name,email,phone,password_hash,role,status) VALUES (?,?,?,?,?,"Pending")',
    [name, email.toLowerCase(), digits(phone).slice(-11), await bcrypt.hash(password, 10), role]);
  res.json({ ok: true });
}));

router.get('/me', guard(), wrap(async (req, res) => { res.json({ staff: meOut(req.staff) }); }));

// ---------- header notifications: what needs attention, limited to what the person's role may open ----------
router.get('/alerts', guard(), wrap(async (req, res) => {
  const s = req.staff;
  const n = async sql => (await pool.query(sql))[0][0].n;
  const items = [];
  const add = async (perm, key, sql, label, page) => { if (can(s, perm)) { const c = Number(await n(sql)); if (c > 0) items.push({ key, n: c, label, page }); } };
  if (s.role !== 'Delivery rider') await add('orders.view', 'orders', "SELECT COUNT(*) n FROM orders WHERE status = 'Pending'", 'pending orders to confirm', 'orders');
  await add('services.manage', 'services', "SELECT COUNT(*) n FROM service_requests WHERE status = 'New'", 'new service requests', 'services');
  await add('reviews.moderate', 'reviews', "SELECT COUNT(*) n FROM reviews WHERE status = 'Pending'", 'reviews waiting for approval', 'reviews');
  await add('messages.manage', 'inbox', 'SELECT COUNT(*) n FROM messages WHERE created_at >= NOW() - INTERVAL 2 DAY', 'messages in the last 2 days', 'inbox');
  await add('careers.manage', 'careers', "SELECT COUNT(*) n FROM applications WHERE stage = 'New'", 'new job applications', 'careers');
  await add('team.manage', 'team', "SELECT COUNT(*) n FROM staff WHERE status = 'Pending'", 'staff accounts to approve', 'team');
  await add('hub.view', 'returns', "SELECT COUNT(*) n FROM order_returns WHERE status = 'Requested'", 'return requests', 'deliveries');
  res.json({ items, total: items.reduce((a, i) => a + i.n, 0) });
}));

// ---------- dashboard ----------
// role-aware dashboard: figures, charts, a 7-day forecast and the auto-generated guide (?asOf=YYYY-MM-DD shows the picture as of another day)
router.get('/overview', guard('dashboard.view'), wrap(async (req, res) => { res.json(await buildOverview(pool, req.staff, req.query.asOf, req.query.range)); }));

router.get('/dashboard', guard('dashboard.view'), wrap(async (req, res) => {
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
  const [st] = await pool.query('SELECT status, COUNT(*) n FROM orders GROUP BY status');
  const [recent] = await pool.query('SELECT id,customer_name,total,status,created_at FROM orders ORDER BY created_at DESC LIMIT 6');
  res.json({
    kpis: { weekRevenue: Number(w.rev), weekOrders: w.n, pending: p.n, avgOrder: Math.round(a.avg), openServices: Number(sv.open || 0), newServices: Number(sv.fresh || 0) },
    chart, statuses: Object.fromEntries(st.map(x => [x.status, x.n])), lowStock: low, recent: recent.map(o => ({ id: o.id, customer: o.customer_name, total: o.total, status: o.status, at: o.created_at }))
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
    note: r.note, slot: r.slot, partial: r.partial, hold: !!r.hold, holdNote: r.hold_note, vatInvoice: !!r.vat_invoice, company: r.company, bin: r.bin, express: !!r.express, source: r.source || 'Customer', placedBy: r.placed_by || '',
    customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email },
    subtotal: r.subtotal, discount: r.discount + r.member_discount, delivery: r.delivery, total: r.total, vat: r.vat,
    items: items.filter(i => i.order_id === r.id).map(i => ({ id: i.product_id, name: i.name, img: i.img, price: i.price, qty: i.qty, backorder: i.backorder })),
    history: hist.filter(h => h.order_id === r.id).map(h => ({ s: h.status, at: h.at, kind: h.kind, note: h.note, by: h.by_name }))
  }));
}

router.get('/orders', guard('orders.view'), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
  const wanted = String(req.query.status || '').split(',').filter(x => STATUSES.includes(x));
  if (wanted.length === 1) { cond.push('status = ?'); params.push(wanted[0]); } else if (wanted.length > 1) { cond.push(`status IN (${wanted.map(() => '?').join(',')})`); params.push(...wanted); }
  if (req.query.pay) { cond.push('payment LIKE ?'); params.push(like(req.query.pay)); }
  if (['Customer', 'Call center', 'Admin', 'Seller'].includes(req.query.source)) { cond.push('source = ?'); params.push(req.query.source); }
  if (['inside', 'suburb', 'outside'].includes(req.query.area)) { cond.push('area = ?'); params.push(req.query.area); }
  // advanced search: by customer, by product, by date, by amount
  const w = v => String(v || '').trim().slice(0, 80);
  if (w(req.query.customer)) { const c = like(w(req.query.customer)); cond.push('(customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ? OR company LIKE ?)'); params.push(c, c, c, c); }
  if (w(req.query.product)) { cond.push('EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = orders.id AND oi.name LIKE ?)'); params.push(like(w(req.query.product))); }
  const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(Date.parse(v + 'T00:00:00Z')) ? String(v) : null);
  if (day(req.query.from)) { cond.push('created_at >= ?'); params.push(day(req.query.from) + ' 00:00:00'); }
  if (day(req.query.to)) { cond.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(day(req.query.to)); }
  const money = v => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null);
  if (money(req.query.min) !== null) { cond.push('total >= ?'); params.push(money(req.query.min)); }
  if (money(req.query.max) !== null) { cond.push('total <= ?'); params.push(money(req.query.max)); }
  if (req.staff.role === 'Delivery rider') { cond.push('(status IN ("Packed","Shipped") OR rider_id = ?)'); params.push(req.staff.id); } // riders: the pick-up queue plus their own deliveries
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM orders ${where}`, params);
  const [counts] = await pool.query('SELECT status, COUNT(*) c FROM orders GROUP BY status');
  let summary; // money figures only for roles that may see the dashboard (not riders)
  if (req.query.summary === '1' && can(req.staff, 'dashboard.view')) {
    const [[a]] = await pool.query(`SELECT COUNT(*) total, SUM(status = 'Cancelled') cancelled,
      COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN total END), 0) revenue,
      SUM(DATE(created_at) = CURDATE()) today,
      COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status <> 'Cancelled' THEN total END), 0) todayRevenue,
      COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled', 'Delivered') THEN total END), 0) openValue,
      SUM(status NOT IN ('Cancelled', 'Delivered')) open,
      COALESCE(SUM(CASE WHEN status <> 'Cancelled' AND pay_status = 'Unpaid' THEN total END), 0) unpaid FROM orders`);
    const live = a.total - a.cancelled;
    summary = { total: Number(a.total), cancelled: Number(a.cancelled), revenue: Number(a.revenue), avg: live ? Math.round(Number(a.revenue) / live) : 0, today: Number(a.today), todayRevenue: Number(a.todayRevenue), open: Number(a.open), openValue: Number(a.openValue), unpaid: Number(a.unpaid) };
  }
  let queue; // Deliveries page: cash still to collect on orders that are packed or on the road
  if (req.query.queue === '1') {
    const [[qd]] = await pool.query("SELECT COALESCE(SUM(CASE WHEN pay_status <> 'Paid' THEN total END), 0) cod, COALESCE(SUM(pay_status <> 'Paid'), 0) codCount FROM orders WHERE status IN ('Packed','Shipped')");
    queue = { cod: Number(qd.cod), codCount: Number(qd.codCount) };
  }
  res.json({ total: n, counts: Object.fromEntries(counts.map(c => [c.status, c.c])), summary, queue, rows: await loadOrders(where, params, `LIMIT ${size} OFFSET ${offset}`) });
}));

router.get('/orders/:id', guard('orders.view'), wrap(async (req, res) => {
  const rider = req.staff.role === 'Delivery rider';
  const [o] = await loadOrders('WHERE id = ?' + (rider ? ' AND (status IN ("Packed","Shipped") OR rider_id = ?)' : ''), rider ? [req.params.id, req.staff.id] : [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  res.json(o);
}));

/** Staff comment on an order: kept on the order's timeline, never shown to the customer. */
router.post('/orders/:id/comments', guard('orders.view'), wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 255);
  if (!text) throw fail(400, 'Write the comment first');
  const rider = req.staff.role === 'Delivery rider';
  const [[o]] = await pool.query('SELECT status, rider_id FROM orders WHERE id = ?', [req.params.id]);
  if (!o || (rider && !(o.rider_id === req.staff.id || (!o.rider_id && ['Packed', 'Shipped'].includes(o.status))))) throw fail(404, 'Order not found');
  await pool.query("INSERT INTO order_history (order_id,status,flow,note,by_name,kind) VALUES (?,?,?,?,?,'comment')", [req.params.id, o.status, null, text, req.staff.name]);
  res.json((await loadOrders('WHERE id = ?', [req.params.id]))[0]);
}));

router.put('/orders/:id/status', guard('orders.status'), wrap(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw fail(400, 'Unknown status');
  const remarks = String(req.body.remarks || '').trim().slice(0, 255);
  if (remarks.length < 3) throw fail(400, 'Write the remarks for this status change (at least 3 characters)');
  const rider = req.staff.role === 'Delivery rider';
  // riders only start their own trip here; closing a delivery needs the OTP / signature and cash tick in the Delivery Hub
  if (rider && status !== 'Shipped') throw fail(403, 'Riders start the trip here; close the delivery with the OTP or signature in the Delivery Hub');
  const [[o]] = await pool.query('SELECT status, rider_id FROM orders WHERE id = ?', [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  if (rider && !(o.rider_id === req.staff.id || (!o.rider_id && o.status === 'Packed'))) throw fail(404, 'Order not found');
  if (o.status === 'Delivered' && status !== 'Delivered') throw fail(400, 'A delivered order cannot be moved back');
  if (o.status !== status) {
    if (status === 'Cancelled') await cancelOrder(req.params.id, remarks, req.staff.name); // also puts the stock back
    else {
      const extra = {};
      if (status === 'Shipped') { // same trip details the Delivery Hub creates, so the OTP proof works
        const cur = (await pool.query('SELECT otp FROM orders WHERE id = ?', [req.params.id]))[0][0];
        extra.out_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
        extra.otp = cur.otp || String(1000 + crypto.randomInt(9000));
        if (rider) extra.rider_id = req.staff.id;
      }
      await applyFlow(req.params.id, FROM_STATUS[status], remarks, extra, req.staff.name);
      if (status === 'Delivered') await pool.query('UPDATE orders SET pay_status = IF(payment = "Cash on delivery", "Paid", pay_status) WHERE id = ?', [req.params.id]);
    }
  }
  res.json((await loadOrders('WHERE id = ?', [req.params.id]))[0]);
}));

// ---------- order / invoice PDF: view or download it, or email it to the customer ----------
const siteInfo = async () => parseJson((await pool.query('SELECT v FROM settings WHERE k = "site"'))[0][0]?.v) || {};
async function invoiceOrder(req) {
  if (req.staff.role === 'Delivery rider') throw fail(403, 'Riders cannot open invoices');
  const [o] = await loadOrders('WHERE id = ?', [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  return o;
}
router.get('/orders/:id/invoice.pdf', guard('orders.view'), wrap(async (req, res) => {
  const o = await invoiceOrder(req);
  const pdf = await buildInvoicePdf(o, await siteInfo());
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${invoiceNo(o.id)}.pdf"`, 'Cache-Control': 'no-store' }).send(pdf);
}));
router.post('/orders/:id/invoice/email', guard('orders.status'), wrap(async (req, res) => {
  const o = await invoiceOrder(req);
  const to = String(req.body.to || o.customer.email || '').trim().toLowerCase();
  if (!/^[^\s,;<>"()]+@[^\s,;<>"()]+\.[^\s,;<>"()]+$/.test(to) || to.length > 160) throw fail(400, 'Enter one valid email address for the customer');
  if (!mailReady('sales')) throw fail(409, 'Email sending is not set up yet. ' + mailSetupHint('sales'));
  const site = await siteInfo();
  const inv = invoiceNo(o.id);
  const money = n => '৳ ' + Math.round(Number(n) || 0).toLocaleString('en-US');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const note = String(req.body.message || '').trim().slice(0, 1000);
  const paid = o.payStatus === 'Paid';
  const pdf = await buildInvoicePdf(o, site);
  await sendMail({ channel: 'sales',
    to, replyTo: site.email || undefined, subject: `Your invoice ${inv} from AR Trade International`,
    text: `Hello ${o.customer.name},\n\n${note ? note + '\n\n' : ''}Thank you for your order ${o.id}. Your invoice ${inv} is attached as a PDF.\n\nOrder total: ${money(o.total)} (${paid ? 'paid' : 'payment due'})\nStatus: ${o.status}\n\nAR Trade International\n${[site.phone, site.email].filter(Boolean).join(' · ')}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#0b1631"><p>Hello ${esc(o.customer.name)},</p>${note ? `<p style="white-space:pre-wrap">${esc(note)}</p>` : ''}<p>Thank you for your order <b>${esc(o.id)}</b>. Your invoice <b>${inv}</b> is attached as a PDF.</p><table cellpadding="6" style="background:#f4f7fc;border-radius:8px"><tr><td>Order total</td><td><b>${money(o.total)}</b> (${paid ? 'paid' : 'payment due'})</td></tr><tr><td>Status</td><td>${esc(o.status)}</td></tr></table><p style="color:#6b7388;font-size:13px">AR Trade International<br>${esc([site.phone, site.email].filter(Boolean).join(' · '))}</p></div>`,
    attachments: [{ filename: inv + '.pdf', content: pdf, contentType: 'application/pdf' }]
  });
  await pool.query('INSERT INTO order_history (order_id,status,flow,note) VALUES (?,?,?,?)', [o.id, o.status === 'Pending' ? 'Pending' : o.status, 'Invoice emailed', `Invoice ${inv} emailed to ${to} by ${req.staff.name}`.slice(0, 255)]);
  res.json({ ok: true, to });
}));

router.delete('/orders/:id', guard('orders.delete'), wrap(async (req, res) => {
  const [[o]] = await pool.query('SELECT status FROM orders WHERE id = ?', [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  if (o.status !== 'Cancelled') throw fail(400, 'Only cancelled orders can be deleted. Cancel it first so the stock goes back.');
  await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- products & categories ----------
const prodOut = r => ({
  id: r.id, cat: r.category_id, brand: r.brand, name: r.name, old: r.old_price, price: r.price, img: r.img, stock: r.stock, popular: !!r.popular,
  isNew: !!r.is_new, featured: !!r.featured, active: !!r.active, tech: r.tech, color: r.color, yield: r.yield_info, part: r.part, compat: r.compat, spec: r.spec,
  description: r.description || '', gallery: parseJson(r.gallery) || [], source: r.source_url || '', edited: !!r.edited,
  metaTitle: r.meta_title || '', metaDesc: r.meta_desc || '', metaKeywords: r.meta_keywords || ''
});
const PROD_COLS = { metaTitle: 'meta_title', metaDesc: 'meta_desc', metaKeywords: 'meta_keywords', cat: 'category_id', brand: 'brand', name: 'name', old: 'old_price', price: 'price', img: 'img', stock: 'stock', popular: 'popular', isNew: 'is_new', featured: 'featured', active: 'active', tech: 'tech', color: 'color', yield: 'yield_info', part: 'part', compat: 'compat', spec: 'spec' };
const BOOL = new Set(['popular', 'isNew', 'featured', 'active']);
const INT = new Set(['old', 'price', 'stock']);

router.get('/products', guard('products.view'), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(name LIKE ? OR brand LIKE ? OR part LIKE ? OR id = ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q), Number(req.query.q) || 0); }
  if (req.query.cat && req.query.cat !== 'all') { cond.push('category_id = ?'); params.push(req.query.cat); }
  if (req.query.stock === 'low') cond.push('price > 0 AND stock <= 5');
  if (req.query.live === '0') cond.push('active = 0');
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM products ${where}`, params);
  const [rows] = await pool.query(`SELECT * FROM products ${where} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`, params);
  const [[a]] = await pool.query(`SELECT COUNT(*) total, SUM(active = 1) live, SUM(active = 0) hidden,
    SUM(active = 1 AND price > 0 AND stock <= 0) outOfStock, SUM(active = 1 AND price > 0 AND stock BETWEEN 1 AND 5) low,
    SUM(active = 1 AND price = 0) quote, SUM(active = 1 AND (img IS NULL OR img = '')) noImage,
    COALESCE(SUM(CASE WHEN active = 1 THEN price * stock END), 0) stockValue FROM products`);
  const [[cc]] = await pool.query('SELECT COUNT(*) n FROM categories WHERE hidden = 0');
  const summary = { total: Number(a.total), live: Number(a.live), hidden: Number(a.hidden), outOfStock: Number(a.outOfStock), low: Number(a.low), quote: Number(a.quote), noImage: Number(a.noImage), stockValue: Number(a.stockValue), categories: cc.n };
  res.json({ total: n, summary, rows: rows.map(prodOut) });
}));

function productPatch(body) {
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(PROD_COLS)) {
    if (!(k in body)) continue;
    let v = body[k];
    if (BOOL.has(k)) v = +!!v; else if (INT.has(k)) v = Math.max(0, parseInt(v, 10) || 0); else v = v == null ? '' : String(v);
    if (k === 'metaTitle') v = v.slice(0, 160); if (k === 'metaDesc') v = v.slice(0, 320); if (k === 'metaKeywords') v = v.slice(0, 500);
    if (k === 'img') v = localImg(v) || null;
    sets.push(`${col} = ?`); vals.push(v);
  }
  if ('description' in body) { sets.push('description = ?'); vals.push(sanitizeHtml(String(body.description || ''), SAN)); }
  if ('gallery' in body) { sets.push('gallery = ?'); vals.push(JSON.stringify((Array.isArray(body.gallery) ? body.gallery : []).map(u => String(u).trim()).filter(isLocalImg).slice(0, 12))); }
  if (sets.length) sets.push('edited = 1');
  return { sets, vals };
}

router.put('/products/:id', guard('products.manage'), wrap(async (req, res) => {
  const { sets, vals } = productPatch(req.body);
  if (!sets.length) throw fail(400, 'Nothing to update');
  const [r] = await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
  if (!r.affectedRows) throw fail(404, 'Product not found');
  const [[p]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json(prodOut(p));
}));

router.get('/products/:id/report', guard(['products.view', 'dashboard.view']), wrap(async (req, res) => { res.json(await buildProductReport(pool, req.params.id, req.query.asOf, Number(req.query.range) || 30)); }));
router.get('/products/:id/full', guard('products.view'), wrap(async (req, res) => {
  const [[p]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!p) throw fail(404, 'Product not found');
  const [specs] = await pool.query('SELECT name, value FROM product_specs WHERE product_id = ? ORDER BY position', [p.id]);
  res.json({ ...prodOut(p), specs, short: p.short_desc || '', sku: p.sku || '' });
}));
router.put('/products/:id/specs', guard('products.manage'), wrap(async (req, res) => {
  const rows = (Array.isArray(req.body.specs) ? req.body.specs : []).map(s => [String(s.name || '').trim().slice(0, 80), String(s.value || '').trim().slice(0, 500)]).filter(s => s[0] && s[1]).slice(0, 40);
  await pool.query('DELETE FROM product_specs WHERE product_id = ?', [req.params.id]);
  for (const [i, [n, v]] of rows.entries()) await pool.query('INSERT INTO product_specs (product_id, position, name, value) VALUES (?,?,?,?)', [req.params.id, i, n, v]);
  await pool.query('UPDATE products SET edited = 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true, count: rows.length });
}));
router.post('/products', guard('products.manage'), wrap(async (req, res) => {
  const b = req.body;
  if (!b.name || !b.cat || !b.brand) throw fail(400, 'Name, brand and category are required');
  const [[{ m }]] = await pool.query('SELECT COALESCE(MAX(id), 29999) m FROM products WHERE id >= 30000');
  const id = Math.max(30000, m + 1);
  await pool.query('INSERT INTO products (id,category_id,brand,name,old_price,price,img,stock,is_new,active,tech,color,yield_info,part,compat,spec,description,gallery,edited) VALUES (?,?,?,?,?,?,?,?,1,1,?,?,?,?,?,?,?,?,1)',
    [id, b.cat, b.brand, b.name, parseInt(b.old, 10) || 0, parseInt(b.price, 10) || 0, localImg(b.img) || null, parseInt(b.stock, 10) || 0, b.tech || '', b.color || '', b.yield || '', b.part || '', b.compat || '', b.spec || '', sanitizeHtml(String(b.description || ''), SAN), JSON.stringify(Array.isArray(b.gallery) ? b.gallery.map(String).slice(0, 12) : (b.img ? [b.img] : []))]);
  const [[p]] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  res.json(prodOut(p));
}));

router.delete('/products/:id', guard('products.manage'), wrap(async (req, res) => {
  await pool.query('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

router.get('/categories', guard('products.view'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT c.id, c.title, c.description, c.hidden, c.img, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) n, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) total FROM categories c ORDER BY c.sort_order');
  res.json(rows.map(r => ({ id: r.id, title: r.title, description: r.description, hidden: !!r.hidden, img: r.img || '', count: r.n, total: r.total })));
}));
/** New product category. The id is made from the name (it becomes the shop address /shop/<id>) and made unique. */
router.post('/categories', guard('categories.manage'), wrap(async (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 120);
  if (title.length < 2) throw fail(400, 'Give the category a name (at least 2 characters)');
  const [[dupe]] = await pool.query('SELECT id FROM categories WHERE LOWER(title) = LOWER(?)', [title]);
  if (dupe) throw fail(409, 'A category with this name already exists');
  // keep Bangla vowel signs and joiners (they are marks, not letters), otherwise a name like ক্যামেরা falls apart in the address
  const base = (title.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'category');
  let id = ['all', 'new', 'search'].includes(base) ? base + '-category' : base;
  for (let i = 2; (await pool.query('SELECT 1 FROM categories WHERE id = ?', [id]))[0].length; i++) id = base + '-' + i;
  const img = req.body.image ? localImg(req.body.image, 'The picture must be uploaded here') : null;
  const [[m]] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) m FROM categories');
  await pool.query('INSERT INTO categories (id, title, description, sort_order, hidden, img) VALUES (?,?,?,?,?,?)', [id, title, String(req.body.description || '').trim().slice(0, 255), m.m + 1, +!!req.body.hidden, img || null]);
  res.json({ id });
}));
/** Only a category with no products at all can be deleted. */
router.delete('/categories/:id', guard('categories.manage'), wrap(async (req, res) => {
  const [[n]] = await pool.query('SELECT COUNT(*) n FROM products WHERE category_id = ?', [req.params.id]);
  if (n.n) throw fail(409, `This category still has ${n.n} product${n.n === 1 ? '' : 's'}. Move or delete them first, or just hide the category.`);
  const [r] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw fail(404, 'Category not found');
  res.json({ ok: true });
}));
router.put('/categories/:id', guard('categories.manage'), wrap(async (req, res) => {
  const sets = [], vals = [];
  if ('title' in req.body) {
    const title = String(req.body.title || '').trim().slice(0, 120);
    if (title.length < 2) throw fail(400, 'Give the category a name (at least 2 characters)');
    const [[dupe]] = await pool.query('SELECT id FROM categories WHERE LOWER(title) = LOWER(?) AND id <> ?', [title, req.params.id]);
    if (dupe) throw fail(409, 'Another category already has this name');
    sets.push('title = ?'); vals.push(title);
  }
  if ('description' in req.body) { sets.push('description = ?'); vals.push(String(req.body.description || '').trim().slice(0, 255)); }
  if ('hidden' in req.body) { sets.push('hidden = ?'); vals.push(+!!req.body.hidden); }
  if ('image' in req.body) { // the picture shown on the storefront category tile; empty = go back to the automatic one
    const u = localImg(req.body.image, 'The picture must be uploaded here');
    sets.push('img = ?'); vals.push(u || null);
  }
  if (!sets.length) throw fail(400, 'Nothing to update');
  const [r] = await pool.query(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
  if (!r.affectedRows) throw fail(404, 'Category not found');
  res.json({ ok: true });
}));

// ---------- customers, services, inbox ----------
router.get('/customers', guard('customers.view'), wrap(async (req, res) => {
  const { size, p } = page(req);
  const [orders] = await pool.query('SELECT customer_name name, customer_phone phone, MAX(customer_email) email, COUNT(*) n, SUM(total) ltv, MAX(created_at) last FROM orders WHERE status <> "Cancelled" GROUP BY customer_phone, customer_name');
  const [users] = await pool.query('SELECT id, name, phone, email FROM users');
  const map = new Map(orders.map(o => [digits(o.phone).slice(-10), { name: o.name, phone: o.phone, email: o.email, n: o.n, ltv: Number(o.ltv), last: o.last }]));
  users.forEach(u => { const k = digits(u.phone).slice(-10); if (!map.has(k)) map.set(k, { name: u.name, phone: u.phone, email: u.email, userId: u.id, n: 0, ltv: 0, last: null }); else { const c = map.get(k); if (!c.email) c.email = u.email; c.userId = u.id; } });
  const q = String(req.query.q || '').toLowerCase();
  const ranged = !!(day(req.query.from) || day(req.query.to));
  let list = [...map.values()].filter(c => (!q || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)) && (!ranged || (c.last && inRange(c.last, req))));
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
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [req.params.id]);
  res.json({ ok: true });
}));
router.post('/customers/:id/reset-link', guard('customers.manage'), wrap(async (req, res) => {
  const [[u]] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
  if (!u) throw fail(404, 'Customer account not found');
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [u.id]);
  const token = crypto.randomBytes(24).toString('hex');
  await pool.query('INSERT INTO password_resets (user_id, token, requested, expires_at) VALUES (?,?,0,DATE_ADD(NOW(), INTERVAL 1 DAY))', [u.id, token]);
  res.json({ path: '/reset/' + token, hours: 24 });
}));
router.get('/password-resets', guard('customers.manage'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT r.id, r.user_id userId, u.name, u.phone, u.email, r.created_at created FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.requested = 1 AND r.used_at IS NULL AND r.expires_at > NOW() ORDER BY r.created_at DESC LIMIT 50');
  res.json(rows);
}));
router.delete('/password-resets/:id', guard('customers.manage'), wrap(async (req, res) => { await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

router.get('/services', guard('services.manage'), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(id LIKE ? OR name LIKE ? OR phone LIKE ? OR model LIKE ?)'); params.push(...Array(4).fill(like(req.query.q))); }
  if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
  addRange(cond, params, 'created_at', req);
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM service_requests ${where}`, params);
  const [rows] = await pool.query(`SELECT * FROM service_requests ${where} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
  res.json({ total: n, rows: rows.map(r => ({ id: r.id, type: r.type, name: r.name, phone: r.phone, model: r.model, issue: r.issue, date: r.preferred_date, status: r.status, created: r.created_at })) });
}));
router.put('/services/:id', guard('services.manage'), wrap(async (req, res) => {
  if (!['New', 'Scheduled', 'In progress', 'Completed'].includes(req.body.status)) throw fail(400, 'Unknown status');
  await pool.query('UPDATE service_requests SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ ok: true });
}));

// ---------- blog: managed by Admin and the Content writer role ----------
const SAN = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'a', 'img', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'figure', 'figcaption'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'loading'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: [] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, at) => ({ tagName: 'a', attribs: { ...at, target: '_blank', rel: 'noopener' } }),
    img: (tag, at) => ({ tagName: 'img', attribs: { src: isLocalImg(at.src) ? at.src : '', alt: at.alt || '', loading: 'lazy' } }),
    div: 'p', b: 'strong', i: 'em'
  }
};
const slugify = s => String(s || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 120);
const textOf = html => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
/** The SEO fields a blog article or a site page carries. */
const seoIn = b => ({ metaTitle: String(b.metaTitle || '').trim().slice(0, 160), metaDesc: String(b.metaDesc || '').replace(/\s+/g, ' ').trim().slice(0, 320), metaKeywords: String(b.metaKeywords || '').replace(/\s+/g, ' ').trim().slice(0, 500), noindex: b.noindex ? 1 : 0 });
const seoOut = r => ({ metaTitle: r.meta_title || '', metaDesc: r.meta_desc || '', metaKeywords: r.meta_keywords || '', noindex: !!r.noindex });
const blogRow = r => ({ id: r.id, slug: r.slug, title: r.title, category: r.category, cover: r.cover, excerpt: r.excerpt, body: r.body, date: r.published, status: r.status, author: r.author, authorId: r.author_id, updated: r.updated_at, ...seoOut(r) });
const IMG_TYPES = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], gif: [0x47, 0x49, 0x46], webp: [0x52, 0x49, 0x46, 0x46] };

router.get('/blog', guard('blog.manage'), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(title LIKE ? OR category LIKE ? OR author LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
  if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
  addRange(cond, params, 'published', req);
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM blog_posts ${where}`, params);
  const [rows] = await pool.query(`SELECT id, slug, title, category, cover, excerpt, author, author_id, status, DATE_FORMAT(published, "%Y-%m-%d") AS published, updated_at FROM blog_posts ${where} ORDER BY published DESC, id DESC LIMIT ${size} OFFSET ${offset}`, params);
  const [cats] = await pool.query('SELECT DISTINCT category FROM blog_posts ORDER BY category');
  res.json({ total: n, rows: rows.map(blogRow), categories: cats.map(c => c.category) });
}));
router.get('/blog/:id', guard('blog.manage'), wrap(async (req, res) => {
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
  const cover = localImg(b.cover, 'The cover must be an uploaded image');
  let slug = slugify(b.slug || title) || 'post-' + Date.now();
  const [dup] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? AND id <> ?', [slug, id || 0]);
  if (dup.length) { if (b.slug) throw fail(409, 'This web address is already used by another article'); slug += '-' + Date.now().toString(36).slice(-4); }
  return { title, body, category, status, date, excerpt, cover, slug, ...seoIn(b) };
};
router.post('/blog', guard('blog.manage'), wrap(async (req, res) => {
  const p = await savePost(req, 0);
  const [r] = await pool.query('INSERT INTO blog_posts (slug, title, category, cover, excerpt, body, published, status, author, author_id, meta_title, meta_desc, meta_keywords, noindex, edited, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,NOW())',
    [p.slug, p.title, p.category, p.cover, p.excerpt, p.body, p.date, p.status, req.staff.name, req.staff.id, p.metaTitle, p.metaDesc, p.metaKeywords, p.noindex]);
  res.json({ id: r.insertId, slug: p.slug });
}));
router.put('/blog/:id', guard('blog.manage'), wrap(async (req, res) => {
  const [[cur]] = await pool.query('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!cur) throw fail(404, 'Article not found');
  const p = await savePost(req, cur.id);
  await pool.query('UPDATE blog_posts SET slug=?, title=?, category=?, cover=?, excerpt=?, body=?, published=?, status=?, meta_title=?, meta_desc=?, meta_keywords=?, noindex=?, edited=1, updated_at=NOW() WHERE id=?',
    [p.slug, p.title, p.category, p.cover, p.excerpt, p.body, p.date, p.status, p.metaTitle, p.metaDesc, p.metaKeywords, p.noindex, cur.id]);
  res.json({ ok: true, slug: p.slug });
}));
router.delete('/blog/:id', guard('blog.manage'), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT author_id FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!r) throw fail(404, 'Article not found');
  if (req.staff.role === 'Content writer' && r.author_id !== req.staff.id) throw fail(403, 'Writers can delete only their own articles');
  await pool.query('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
// images for products / blog / servicing / clients / company pages are stored under server/uploads/<folder>/ (folder = section/category)
const FOLDER = /^(products|blog|services|clients|company|site)(\/[a-z0-9][a-z0-9-]{0,58}){0,2}$/;
router.post('/upload-image', guard('media.upload'), wrap(async (req, res) => {
  const folder = String(req.body.folder || 'blog/general').toLowerCase();
  if (!FOLDER.test(folder)) throw fail(400, 'Unknown upload folder');
  if (!can(req.staff, 'products.manage') && !/^(blog|services|clients|company|site)(\/|$)/.test(folder)) throw fail(403, 'Your role cannot upload product images');
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
const pageRow = r => ({ id: r.id, slug: r.slug, group: r.grp, title: r.title, excerpt: r.excerpt, body: r.body, cover: r.cover, images: parseJson(r.images) || [], status: r.status, order: r.sort_order, edited: !!r.edited, updated: r.updated_at, ...seoOut(r) });
router.get('/pages', guard('pages.manage'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM site_pages ORDER BY FIELD(grp, "servicing", "clients", "company"), sort_order, id');
  res.json(rows.map(pageRow));
}));
router.get('/pages/:id', guard('pages.manage'), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT * FROM site_pages WHERE id = ?', [req.params.id]);
  if (!r) throw fail(404, 'Page not found');
  res.json(pageRow(r));
}));
const savePage = (b) => {
  const title = String(b.title || '').trim();
  if (title.length < 3) throw fail(400, 'Please enter a title');
  const body = sanitizeHtml(String(b.body || ''), SAN);
  const cover = localImg(b.cover, 'The cover must be an uploaded image');
  return { title, body, cover, excerpt: (String(b.excerpt || '').trim() || textOf(body)).slice(0, 190), status: b.status === 'Draft' ? 'Draft' : 'Published', order: parseInt(b.order, 10) || 0, ...seoIn(b) };
};
router.put('/pages/:id', guard('pages.manage'), wrap(async (req, res) => {
  const p = savePage(req.body);
  const imgs = [...p.body.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
  const [r] = await pool.query('UPDATE site_pages SET title=?, excerpt=?, body=?, cover=?, images=?, status=?, sort_order=?, meta_title=?, meta_desc=?, meta_keywords=?, noindex=?, edited=1, updated_at=NOW() WHERE id=?',
    [p.title, p.excerpt, p.body, p.cover, JSON.stringify(imgs), p.status, p.order, p.metaTitle, p.metaDesc, p.metaKeywords, p.noindex, req.params.id]);
  if (!r.affectedRows) throw fail(404, 'Page not found');
  res.json({ ok: true });
}));
router.post('/pages', guard('pages.manage'), wrap(async (req, res) => {
  const grp = ['servicing', 'clients', 'company'].includes(req.body.group) ? req.body.group : 'servicing';
  const p = savePage(req.body);
  let slug = slugify(req.body.slug || p.title) || 'page-' + Date.now();
  const [dup] = await pool.query('SELECT id FROM site_pages WHERE slug = ?', [slug]);
  if (dup.length) slug += '-' + Date.now().toString(36).slice(-4);
  const imgs = [...p.body.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
  const [r] = await pool.query('INSERT INTO site_pages (slug, grp, title, excerpt, body, cover, images, sort_order, status, meta_title, meta_desc, meta_keywords, noindex, edited, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,NOW())',
    [slug, grp, p.title, p.excerpt, p.body, p.cover, JSON.stringify(imgs), p.order, p.status, p.metaTitle, p.metaDesc, p.metaKeywords, p.noindex]);
  res.json({ id: r.insertId, slug });
}));
router.delete('/pages/:id', guard('pages.delete'), wrap(async (req, res) => { await pool.query('DELETE FROM site_pages WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

// ---------- storefront content (home slides, brand + client logos, FAQs, policies, labels…) ----------
const text = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const url = v => { const u = text(v, 500); if (u && !/^(\/api\/uploads\/|https?:\/\/|\/|#\/|\.\/)/.test(u)) throw fail(400, 'Links must start with / , #/ or https://'); return u; };
const img = v => localImg(text(v, 500), 'Images must be uploaded here');
const list = (v, max = 60) => { if (!Array.isArray(v)) throw fail(400, 'Expected a list'); return v.slice(0, max); };
const CONTENT = {
  slides: v => list(v, 12).map(s => (s.type === 'image'
    ? { on: s.on !== false, type: 'image', alt: text(s.alt, 160), img: img(s.img), href: url(s.href) || '#/shop/all', ratio: Number(s.ratio) || 2.68 }
    : { on: s.on !== false, type: 'design', tag: text(s.tag, 120), title: text(s.title, 200), sub: text(s.sub, 400), c1: text(s.c1, 60), h1: url(s.h1), c2: text(s.c2, 60), h2: url(s.h2), pic: img(s.pic), badgeT: text(s.badgeT, 30), badgeV: text(s.badgeV, 30) })),
  brands: v => list(v, 40).filter(b => text(b.n)).map(b => ({ n: text(b.n, 60), src: img(b.src) })),
  clients: v => list(v, 80).map(c => img(typeof c === 'string' ? c : c.src)).filter(Boolean),
  faqs: v => list(v, 40).filter(f => text(f.q)).map(f => ({ q: text(f.q, 300), a: text(f.a, 2000) })),
  perks: v => list(v, 8).map(p => ({ ic: text(p.ic, 8), t: text(p.t, 80), d: text(p.d, 160), dot: text(p.dot, 60) || 'oklch(0.72 0.13 220)' })),
  whys: v => list(v, 12).map(w => ({ t: text(w.t, 80), d: text(w.d, 400) })),
  stats: v => list(v, 8).map(x => ({ v: text(x.v, 20), t: text(x.t, 80) })),
  words: v => list(v, 20).map(w => text(w, 120)).filter(Boolean),
  social: v => Object.fromEntries(['facebook', 'instagram', 'linkedin', 'youtube', 'x'].map(k => [k, url(v && v[k])])),
  labels: v => Object.fromEntries(Object.entries(v || {}).slice(0, 40).map(([k, x]) => [text(k, 40), text(x, 160)])),
  policies: v => list(v, 8).map(p => ({ k: slugify(p.k || p.t) || 'policy', t: text(p.t, 120), secs: list(p.secs || [], 30).map(x => ({ h: text(x.h, 160), p: text(x.p, 3000) })) })),
  sections: v => Object.fromEntries(Object.entries(v || {}).slice(0, 20).map(([k, x]) => [text(k, 30), !!x])),
  slideSecs: v => Math.min(30, Math.max(2, Number(v) || 5.5)),
  about: v => Object.fromEntries(['heading', 'intro', 'mdMessage', 'mdName', 'mdTitle', 'vision', 'mission'].map(k => [k, text(v && v[k], 2000)])),
  footer: v => Object.fromEntries(['tagline', 'hours', 'mobileBanking', 'email2'].map(k => [k, text(v && v[k], 300)])),
  menus: v => Object.fromEntries(['hot', 'services', 'blog', 'about'].map(k => [k, list((v || {})[k] || [], 20).filter(i => text(i.t)).map(i => {
    const l = url(i.href || i.to);
    return /^https?:\/\//.test(l) ? { t: text(i.t, 80), href: l, mark: '↗' } : { t: text(i.t, 80), to: l || '/' };
  })]))
};
router.get('/content', guard('pages.manage'), wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "content"');
  const c = parseJson(row.v);
  res.json(Object.fromEntries(Object.keys(CONTENT).map(k => [k, c[k]])));
}));
router.put('/content/:section', guard('pages.manage'), wrap(async (req, res) => {
  const fn = CONTENT[req.params.section];
  if (!fn) throw fail(404, 'Unknown content section');
  const value = fn(req.body.value);
  const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "content"');
  const c = parseJson(row.v);
  c[req.params.section] = value;
  await pool.query('UPDATE settings SET v = ? WHERE k = "content"', [JSON.stringify(c)]);
  res.json({ ok: true, value });
}));

// ---------- product reviews moderation ----------
router.get('/reviews', guard('reviews.moderate'), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(r.name LIKE ? OR r.body LIKE ? OR p.name LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
  if (req.query.status) { cond.push('r.status = ?'); params.push(req.query.status); }
  addRange(cond, params, 'r.created_at', req);
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const from = 'FROM reviews r LEFT JOIN products p ON p.id = r.product_id';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n ${from} ${where}`, params);
  const [rows] = await pool.query(`SELECT r.*, p.name AS product ${from} ${where} ORDER BY (r.status = 'Pending') DESC, r.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
  const [[{ pending }]] = await pool.query('SELECT COUNT(*) pending FROM reviews WHERE status = "Pending"');
  res.json({ total: n, pending, rows: rows.map(r => ({ id: r.id, productId: r.product_id, product: r.product || ('#' + r.product_id), name: r.name, rating: r.rating, title: r.title, body: r.body, verified: !!r.verified, status: r.status, created: r.created_at, reviewed: r.reviewed_at })) });
}));
router.put('/reviews/:id', guard('reviews.moderate'), wrap(async (req, res) => {
  if (!['Pending', 'Approved', 'Rejected'].includes(req.body.status)) throw fail(400, 'Unknown status');
  await pool.query('UPDATE reviews SET status = ?, reviewed_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ ok: true });
}));
router.delete('/reviews/:id', guard('reviews.moderate'), wrap(async (req, res) => { await pool.query('DELETE FROM reviews WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

router.get('/messages', guard('messages.manage'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200');
  res.json({ chat: rows.filter(m => m.subject === 'Live chat').map(m => ({ id: m.id, text: m.body, at: m.created_at })), contact: rows.filter(m => m.subject !== 'Live chat').map(m => ({ id: m.id, name: m.name, contact: m.contact, company: m.company, subject: m.subject, body: m.body, at: m.created_at, status: m.status || 'New', note: m.note || '', handledBy: m.handled_by || '', handledAt: m.handled_at })) });
}));
// work a message: its status (New, Read, Replied, Closed) and a private note for the team
router.put('/messages/:id', guard('messages.manage'), wrap(async (req, res) => {
  const [[m]] = await pool.query('SELECT id, status FROM messages WHERE id = ?', [req.params.id]);
  if (!m) throw fail(404, 'Message not found');
  const sets = [], vals = [];
  if ('status' in req.body) {
    if (!['New', 'Read', 'Replied', 'Closed'].includes(req.body.status)) throw fail(400, 'Unknown status');
    sets.push('status = ?', 'handled_by = ?', 'handled_at = NOW()'); vals.push(req.body.status, req.body.status === 'New' ? '' : req.staff.name);
  }
  if ('note' in req.body) { sets.push('note = ?'); vals.push(String(req.body.note || '').trim().slice(0, 1000)); }
  if (!sets.length) throw fail(400, 'Nothing to update');
  await pool.query(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`, [...vals, m.id]);
  res.json({ ok: true });
}));
router.delete('/messages/:id', guard('messages.manage'), wrap(async (req, res) => { await pool.query('DELETE FROM messages WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

// ---------- marketing: subscribers, consent log, campaigns ----------
router.get('/subscribers', guard('marketing.manage'), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('email LIKE ?'); params.push(like(req.query.q)); }
  addRange(cond, params, 'created_at', req);
  const q = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM subscribers ${q}`, params);
  const [rows] = await pool.query(`SELECT email, created_at FROM subscribers ${q} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
  res.json({ total: n, rows });
}));
router.post('/subscribers', guard('marketing.manage'), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
  await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [email]);
  res.json({ ok: true });
}));
router.delete('/subscribers/:email', guard('marketing.manage'), wrap(async (req, res) => {
  await pool.query('DELETE FROM subscribers WHERE email = ?', [req.params.email]);
  await pool.query('UPDATE consents SET status = "Unsubscribed" WHERE email = ? AND status <> "Unsubscribed"', [req.params.email]);
  res.json({ ok: true });
}));
router.get('/consents', guard('marketing.manage'), wrap(async (req, res) => {
  const { size, offset } = page(req);
  const cond = [], params = [];
  if (req.query.q) { cond.push('(email LIKE ? OR source LIKE ?)'); params.push(like(req.query.q), like(req.query.q)); }
  if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
  addRange(cond, params, 'created_at', req);
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM consents ${where}`, params);
  const [rows] = await pool.query(`SELECT * FROM consents ${where} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
  res.json({ total: n, rows: rows.map(c => ({ id: c.id, email: c.email, source: c.source, token: c.token, status: c.status, ip: c.ip, at: c.created_at, confirmedAt: c.confirmed_at })) });
}));
router.put('/consents/:id/confirm', guard('marketing.manage'), wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM consents WHERE id = ?', [req.params.id]);
  if (!c) throw fail(404, 'Not found');
  await pool.query('UPDATE consents SET status = "Confirmed", confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = ?', [c.id]);
  await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [c.email]);
  (await import('./mkt.js')).onSubscribed(c.email).catch(() => {});
  res.json({ ok: true });
}));

// ---------- careers ----------
router.get('/jobs', guard('careers.manage'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) apps FROM jobs j ORDER BY j.deadline DESC');
  res.json(rows.map(j => ({ id: j.id, title: j.title, dept: j.dept, type: j.type, loc: j.loc, exp: j.exp, salary: j.salary, vacancies: j.vacancies, deadline: j.deadline, open: !!j.open, about: j.about, resp: parseJson(j.resp) || [], req: parseJson(j.req) || [], perks: parseJson(j.perks) || [], apps: j.apps })));
}));
router.post('/jobs', guard('careers.manage'), wrap(async (req, res) => {
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
router.delete('/jobs/:id', guard('careers.manage'), wrap(async (req, res) => {
  await pool.query('DELETE FROM applications WHERE job_id = ?', [req.params.id]);
  await pool.query('DELETE FROM jobs WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
router.get('/applications', guard('careers.manage'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT a.*, j.title job_title FROM applications a JOIN jobs j ON j.id = a.job_id ORDER BY a.created_at DESC');
  res.json(rows.map(a => ({ id: a.id, job: a.job_id, jobTitle: a.job_title, name: a.name, phone: a.phone, email: a.email, exp: a.exp, salary: a.salary, link: a.link, note: a.note, cv: a.cv_name, stage: a.stage, at: a.created_at })));
}));
// applicants' CVs are private files: downloaded here by an Admin, never through the public /api/uploads path
router.get('/applications/:id/cv', guard('careers.manage'), wrap(async (req, res) => {
  const [[a]] = await pool.query('SELECT cv_file, cv_name FROM applications WHERE id = ?', [req.params.id]);
  if (!a || !a.cv_file) throw fail(404, 'CV not found');
  const file = path.join(CV_DIR, path.basename(a.cv_file));
  if (!fs.existsSync(file)) throw fail(404, 'CV file is missing on the server');
  res.download(file, (/\.[a-z]{3,4}$/i.test(a.cv_name || '') ? a.cv_name : a.cv_file).replace(/[^\w.\- ]/g, '_'));
}));
router.put('/applications/:id', guard('careers.manage'), wrap(async (req, res) => {
  if (!['New', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'].includes(req.body.stage)) throw fail(400, 'Unknown stage');
  await pool.query('UPDATE applications SET stage = ? WHERE id = ?', [req.body.stage, req.params.id]);
  res.json({ ok: true });
}));

// ---------- team ----------
router.get('/staff', guard('team.manage'), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM staff ORDER BY FIELD(status,"Pending","Active","Disabled"), created_at');
  res.json(rows.map(staffRow));
}));
router.put('/staff/:id', guard('team.manage'), wrap(async (req, res) => {
  const { role, status } = req.body;
  const [[t]] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
  if (!t) throw fail(404, 'Not found');
  if (t.id === req.staff.id) throw fail(400, 'You cannot change your own access');
  const master = req.staff.role === MASTER;
  // only the Master Admin may touch, or create, the two top roles
  if (!master && (t.role === MASTER || t.role === 'Admin')) throw fail(403, 'Only the Master Admin can change a Master Admin or an Admin');
  if (role === MASTER && t.role !== MASTER) throw fail(409, 'There is only one Master Admin. Use "Transfer Master Admin" to hand it over.');
  if (!master && role === 'Admin') throw fail(403, 'Only the Master Admin can make someone an Admin');
  if (t.role === MASTER && ((role && role !== MASTER) || (status && status !== 'Active'))) {
    const [[o]] = await pool.query('SELECT COUNT(*) n FROM staff WHERE role = ? AND status = "Active" AND id <> ?', [MASTER, t.id]);
    if (!o.n) throw fail(400, 'There must always be one active Master Admin');
  }
  if (role) { if (!ROLE_NAMES.includes(role)) throw fail(400, 'Unknown role'); await pool.query('UPDATE staff SET role = ? WHERE id = ?', [role, t.id]); }
  if (status) { if (!['Active', 'Pending', 'Disabled'].includes(status)) throw fail(400, 'Unknown status'); await pool.query('UPDATE staff SET status = ? WHERE id = ?', [status, t.id]); }
  res.json({ ok: true });
}));

// ---------- roles & permissions (the role matrix; Master Admin only) ----------
/** NID, addresses and the reference person of a staff member. All optional, but checked when given. */
function staffDetails(b) {
  const nid = digits(b.nid);
  if (nid && ![10, 13, 17].includes(nid.length)) throw fail(400, 'NID must have 10, 13 or 17 digits.');
  const refPhone = digits(b.refPhone).slice(-11);
  if (refPhone && !/^01[3-9]\d{8}$/.test(refPhone)) throw fail(400, "Enter a valid 11-digit mobile number for the reference person (01XXXXXXXXX).");
  const cut = (v, n) => String(v ?? '').trim().slice(0, n);
  return { nid, present_address: cut(b.presentAddress, 300), contact_address: cut(b.contactAddress, 300), ref_name: cut(b.refName, 120), ref_phone: refPhone };
}
const staffRow = s => ({ ...staffOut(s), nid: s.nid || '', presentAddress: s.present_address || '', contactAddress: s.contact_address || '', refName: s.ref_name || '', refPhone: s.ref_phone || '' });

// add a team member without the request-access step: the account is active straight away
router.post('/staff', guard('team.manage'), wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 120);
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160);
  const phone = digits(req.body.phone).slice(-11);
  const role = String(req.body.role || '');
  if (name.length < 2) throw fail(400, 'Enter the name of the team member.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid work email.');
  if (!/^01[3-9]\d{8}$/.test(phone)) throw fail(400, 'Enter a valid 11-digit mobile number (01XXXXXXXXX).');
  checkPassword(req.body.password);
  if (!ROLE_NAMES.includes(role)) throw fail(400, 'Choose a role.');
  if (role === MASTER) throw fail(409, 'There is only one Master Admin and it is already taken. Use "Transfer Master Admin" to hand it to someone else.');
  if (req.staff.role !== MASTER && role === 'Admin') throw fail(403, 'Only the Master Admin can add an Admin.');
  const d = staffDetails(req.body);
  const [dup] = await pool.query('SELECT id FROM staff WHERE email = ? OR phone = ?', [email, phone]);
  if (dup.length) throw fail(409, 'This email or mobile number is already registered.');
  const [r] = await pool.query('INSERT INTO staff (name,email,phone,password_hash,role,status,nid,present_address,contact_address,ref_name,ref_phone) VALUES (?,?,?,?,?,"Active",?,?,?,?,?)', [name, email, phone, await bcrypt.hash(String(req.body.password), 10), role, d.nid, d.present_address, d.contact_address, d.ref_name, d.ref_phone]);
  res.json({ ok: true, id: r.insertId });
}));
// edit a team member's name, contact and personal details (role, status and password have their own routes)
router.put('/staff/:id/details', guard('team.manage'), wrap(async (req, res) => {
  const [[t]] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
  if (!t) throw fail(404, 'Not found');
  if (req.staff.role !== MASTER && (t.role === MASTER || t.role === 'Admin') && t.id !== req.staff.id) throw fail(403, 'Only the Master Admin can change a Master Admin or an Admin');
  const name = String(req.body.name ?? t.name).trim().slice(0, 120);
  const email = String(req.body.email ?? t.email).trim().toLowerCase().slice(0, 160);
  const phone = digits(req.body.phone ?? t.phone).slice(-11);
  if (name.length < 2) throw fail(400, 'Enter the name of the team member.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid work email.');
  if (!/^01[3-9]\d{8}$/.test(phone)) throw fail(400, 'Enter a valid 11-digit mobile number (01XXXXXXXXX).');
  const d = staffDetails(req.body);
  const [dup] = await pool.query('SELECT id FROM staff WHERE (email = ? OR phone = ?) AND id <> ?', [email, phone, t.id]);
  if (dup.length) throw fail(409, 'This email or mobile number is already used by another account.');
  await pool.query('UPDATE staff SET name=?, email=?, phone=?, nid=?, present_address=?, contact_address=?, ref_name=?, ref_phone=? WHERE id=?', [name, email, phone, d.nid, d.present_address, d.contact_address, d.ref_name, d.ref_phone, t.id]);
  res.json({ ok: true });
}));
// hand the single Master Admin role to another active member; the current Master Admin becomes an Admin (one step, so there is never zero or two)
router.post('/staff/:id/make-master', guard('team.manage'), wrap(async (req, res) => {
  if (req.staff.role !== MASTER) throw fail(403, 'Only the Master Admin can hand over the Master Admin role');
  const [[t]] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
  if (!t) throw fail(404, 'Not found');
  if (t.id === req.staff.id) throw fail(400, 'You already are the Master Admin');
  if (t.status !== 'Active') throw fail(400, 'Choose an active team member');
  if (String(req.body.confirm || '') !== 'TRANSFER') throw fail(400, 'Type TRANSFER to confirm');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE staff SET role = "Admin" WHERE id = ? AND role = ?', [req.staff.id, MASTER]);
    await conn.query('UPDATE staff SET role = ? WHERE id = ?', [MASTER, t.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await pool.query('INSERT INTO role_log (role, staff_id, staff_name, what) VALUES (?,?,?,?)', [MASTER, req.staff.id, req.staff.name, `Master Admin role handed over to ${t.name}; ${req.staff.name} is now an Admin`.slice(0, 255)]);
  res.json({ ok: true });
}));
router.get('/staff/roles', guard('team.manage'), wrap(async (req, res) => {
  const master = req.staff.role === MASTER;
  res.json(ROLE_DEFS.map(r => ({ name: r.name, icon: r.icon, desc: r.desc, legacy: !!r.legacy, assignable: r.name !== MASTER && (master || r.name !== 'Admin'), perms: [...permsOf(r.name)].length })));
}));
// ---------- database backups (Master Admin only: a backup holds every customer's data) ----------
router.get('/backups', guard(MASTER_ONLY), wrap(async (req, res) => { res.json(await backupStatus()); }));
router.post('/backups', guard(MASTER_ONLY), wrap(async (req, res) => { res.json(await runBackup(req.body?.scope === 'files' ? 'files' : 'db', 'manual', req.staff.name)); }));
router.put('/backups/dir', guard(MASTER_ONLY), wrap(async (req, res) => { const dir = await setBackupDir(req.body?.dir); console.log('[backup] folder changed to', dir, 'by', req.staff.name); res.json(await backupStatus()); }));
router.get('/backups/:id/download', guard(MASTER_ONLY), wrap(async (req, res) => {
  const f = await backupFile(req.params.id);
  res.set('Cache-Control', 'no-store');
  res.download(f.full, f.name);
}));
router.delete('/backups/:id', guard(MASTER_ONLY), wrap(async (req, res) => { await deleteBackup(req.params.id); res.json({ ok: true }); }));

router.get('/roles', guard(MASTER_ONLY), wrap(async (req, res) => { res.json(await matrix()); }));
router.put('/roles/:name', guard(MASTER_ONLY), wrap(async (req, res) => {
  const name = req.params.name;
  if (!ROLE_NAMES.includes(name)) throw fail(404, 'Unknown role');
  if (name === MASTER) throw fail(400, 'The Master Admin always has full access');
  res.json({ ok: true, perms: await saveRole(name, req.body.perms, req.staff) });
}));
router.post('/roles/:name/reset', guard(MASTER_ONLY), wrap(async (req, res) => {
  const name = req.params.name;
  if (!ROLE_NAMES.includes(name)) throw fail(404, 'Unknown role');
  if (name === MASTER) throw fail(400, 'The Master Admin always has full access');
  res.json({ ok: true, perms: await saveRole(name, DEFAULTS[name], req.staff) });
}));

// ---------- settings ----------
router.get('/settings', guard('settings.manage'), wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "site"');
  res.json(parseJson(row.v));
}));
router.put('/settings', guard('settings.manage'), wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "site"');
  const cur = parseJson(row.v);
  const b = req.body, num = v => Math.max(0, parseInt(v, 10) || 0);
  const next = {
    ...cur,
    promo: b.promo ?? cur.promo, showPromo: b.showPromo ?? cur.showPromo, showOffer: 'showOffer' in b ? !!b.showOffer : (cur.showOffer ?? true), heroTitle: b.heroTitle ?? cur.heroTitle, heroSub: b.heroSub ?? cur.heroSub,
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
