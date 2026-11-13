// Orders: pricing (mirrors the design's AR.totals), the customer's own orders, order tracking and staff-placed orders.
import { pool } from '../db.js';
import { digits, fail, nextSeq, wrap } from '../util.js';
import { guard } from '../admin.js';
import { fieldCustomers } from '../quotation.js';
import { limit } from '../middleware/security.js';
import { auth } from '../middleware/customerAuth.js';
import { AREAS } from './auth.js';
import { getSettings } from './shared.js';

const PARTIAL = ['split', 'together', 'drop'];
const ORDER_SOURCES = ['Call center', 'Admin', 'Seller'];

async function priceOrder(items, { area, coupon, userId, express, partial, phone }) {
  const s = (await getSettings()).site;
  if (!Array.isArray(items) || items.length > 100) throw fail(400, 'Your cart is empty or too large');
  const ids = items.map(i => parseInt(i?.id, 10)).filter(Number.isInteger);
  const [rows] = ids.length ? await pool.query('SELECT * FROM products WHERE active = 1 AND id IN (?)', [ids]) : [[]];
  const byId = new Map(rows.map(r => [r.id, r]));
  const mode = PARTIAL.includes(partial) ? partial : 'split';

  const lines = items.map(it => {
    const p = byId.get(parseInt(it?.id, 10));
    const qty = Math.max(1, Math.min(999, parseInt(it?.qty, 10) || 1));
    if (!p) throw fail(400, 'A product in your cart is no longer available');
    if (!p.price) throw fail(400, `${p.name} needs a quotation — please contact us`);
    const avail = Math.max(0, Math.min(qty, p.stock));
    return { p, qty, avail, short: qty - avail, held: p.price >= 100000, chargeQty: mode === 'drop' ? avail : qty };
  });
  const subtotal = lines.reduce((a, l) => a + l.p.price * l.chargeQty, 0);
  const saved = lines.reduce((a, l) => a + Math.max(0, (l.p.old_price || l.p.price) - l.p.price) * l.chargeQty, 0);

  const cu = String(coupon || '').trim().toUpperCase();
  const welcome = cu === 'WELCOME10';
  let okCoupon = !!cu && ((!!s.coupon && cu === String(s.coupon).toUpperCase()) || welcome); // no coupon set in Settings must not make the text "UNDEFINED" a valid code
  if (welcome && okCoupon) { // the welcome code works once per customer (account or mobile number)
    const ph = digits(phone).slice(-10);
    const [[used]] = await pool.query('SELECT COUNT(*) n FROM orders WHERE coupon = "WELCOME10" AND status <> "Cancelled" AND ((? IS NOT NULL AND user_id = ?) OR (? <> "" AND RIGHT(customer_phone, 10) = ?))', [userId || null, userId || null, ph, ph]);
    if (used.n) okCoupon = false;
  }
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

async function hydrateOrders(rows) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [ids]);
  const [hist] = await pool.query("SELECT * FROM order_history WHERE order_id IN (?) AND kind = 'status' ORDER BY id", [ids]);
  return rows.map(r => ({
    id: r.id, date: r.created_at, status: r.status, payment: r.payment, gateway: r.gateway, payStatus: r.pay_status, area: r.area,
    address: r.address, note: r.note, slot: r.slot, partial: r.partial, hold: !!r.hold, holdNote: r.hold_note, vatInvoice: !!r.vat_invoice,
    company: r.company, bin: r.bin, express: !!r.express, source: r.source || 'Customer', placedBy: r.placed_by || '',
    customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email },
    subtotal: r.subtotal, discount: r.discount + r.member_discount, delivery: r.delivery, total: r.total, vat: r.vat,
    items: items.filter(i => i.order_id === r.id).map(i => ({ id: i.product_id, name: i.name, img: i.img, price: i.price, qty: i.qty, backorder: i.backorder })),
    history: hist.filter(h => h.order_id === r.id).map(h => ({ s: h.status, at: h.at }))
  }));
}

/** Prices and saves one order. `source` says who generated it: Customer (the website), or Call center / Admin / Seller (staff in the console). */
async function placeOrder(body, { userId = null, source = 'Customer', placedBy = '' } = {}) {
  const { items, customer: cust = {}, area, coupon, express, partial, vatInvoice } = body;
  // payment status is never taken from the browser: orders start Unpaid and staff / the delivery flow mark them Paid
  const str = (v, n) => String(v ?? '').trim().slice(0, n);
  const customer = { name: str(cust.name, 120), phone: str(cust.phone, 40), email: str(cust.email, 160) };
  const address = str(body.address, 500), payment = str(body.payment, 60), gateway = str(body.gateway, 60), note = str(body.note, 500), slot = str(body.slot, 60), company = str(body.company, 160), bin = str(body.bin, 60);
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Your cart is empty');
  if (!customer.name || !customer.phone || !address) throw fail(400, 'Name, phone and delivery address are required');
  if (!/^01\d{9}$/.test(digits(customer.phone).slice(-11))) throw fail(400, 'Enter a valid mobile number (01XXXXXXXXX)');
  const t = await priceOrder(items, { area, coupon, userId, express, partial, phone: customer.phone });
  const live = t.lines.filter(l => l.chargeQty > 0);
  if (!live.length) throw fail(400, 'None of the items in your cart are in stock right now');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = await nextSeq('order', 'orders', 'AR-', 10500);
    const hold = t.heldN > 0;
    await conn.query(
      `INSERT INTO orders (id,user_id,customer_name,customer_phone,customer_email,company,bin,address,area,subtotal,discount,member_discount,delivery,express,total,vat,
         payment,gateway,pay_status,partial,slot,vat_invoice,hold,hold_note,note,coupon,source,placed_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, userId || null, customer.name, customer.phone, customer.email, vatInvoice ? company : '', vatInvoice ? bin : '', address, t.zone,
        t.subtotal, t.discount, t.member, t.delivery, +!!t.express, t.total, t.vat, payment || 'Cash on delivery', gateway, 'Unpaid',
        t.partial, slot, +!!vatInvoice, +hold, hold ? 'High-value / special-order items held until our team approves them' : '', note, t.coupon, source, placedBy]);
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
    return (await hydrateOrders(rows))[0];
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}

export function mountOrderRoutes(app) {
  app.post('/api/quote', auth(false), wrap(async (req, res) => {
    const t = await priceOrder(req.body.items || [], { ...req.body, userId: req.user?.id, phone: req.body.phone });
    res.json(quoteOut(t));
  }));

  app.post('/api/orders', limit('order', 20, 3600000), auth(false), wrap(async (req, res) => {
    res.json(await placeOrder(req.body, { userId: req.user?.id }));
  }));

  /** Staff create an order for a customer. The source is chosen on the form; when it is not sent it follows the person's role. */
  app.post('/api/admin/orders', guard('orders.create'), wrap(async (req, res) => {
    const role = req.staff.role;
    const fallback = role === 'Call center agent' ? 'Call center' : ['RM', 'Field Officer'].includes(role) ? 'Seller' : 'Admin';
    const source = ORDER_SOURCES.includes(req.body?.source) ? req.body.source : fallback;
    res.json(await placeOrder(req.body, { source, placedBy: req.staff.name }));
  }));

  /** Customers a staff member can pick on the New order form: the field app's Existing customers or Upcoming (prospect) customers. */
  app.get('/api/admin/order-customers', guard('orders.create'), wrap(async (req, res) => { res.json({ items: await fieldCustomers(req.query.type, req.query.q) }); }));

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
}
