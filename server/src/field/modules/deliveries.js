// Deliveries of sales orders (list -> check items -> proof -> confirm).
//   GET  /api/field/deliveries?status=pending|delivered|all&q=   -> { counts, pendingAmount, items }
//        with ?page=&size=[&from=&to=] (created date) the same JSON plus { rows (= items of the page), total, page, size }; counts/pendingAmount/percent still cover all of the caller's deliveries
//   GET  /api/field/deliveries/:id                               -> delivery with order lines, customer, proof info
//   PUT  /api/field/deliveries/:id/start                         Ready -> OnTheWay  { eta? }
//   POST /api/field/deliveries/:id/otp                           send the customer a 4-digit code (no SMS gateway yet: devCode is returned outside production)
//   PUT  /api/field/deliveries/:id/confirm                       { checked: [orderItemId...], photo (data URL), signature (PNG data URL), otp, receivedBy, lat, lng }
//   GET  /api/field/deliveries/:id/proof/photo|signature         private image
// Confirming (in one transaction): every item must be ticked, a photo is required plus a signature OR the customer's OTP.
// Then the delivery is Delivered, product stock is REDUCED here (not when the order is placed), an invoice INV-nnnn
// (credit 30 days) is posted and the order owner + managers are notified.
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import { pool, fail, wrap, guardRole, nextSeq, notify, staffIdsByRole, UTC, digits, coord, parseJson } from '../common.js';
import { secret } from '../../util.js';
import { PROOFS, mailCustomer, removeFile, saveImage, seesAll } from '../sales_util.js';
import { buildDeliveryNotePdf } from '../../salesorder.js';
import { pageOf, addRange, addSearch, wantsPage } from '../../listing.js';

const router = Router();
const guardSales = guardRole('rm', 'manager', 'accountant');
const PROD = process.env.NODE_ENV === 'production';
// a 4-digit code is only safe with a limit on guesses: 5 wrong tries lock the code for 15 minutes (a new code resets it)
const otpTries = new Map();
const otpHash = (id, code) => crypto.createHash('sha256').update(`dlv:${id}:${code}:${secret()}`).digest('hex');

const SELECT = `SELECT d.*, o.customer_id, o.total, o.staff_id order_staff, o.approval_status, c.name customer, c.phone, c.contact_person,
    (SELECT COUNT(*) FROM field_sales_order_items i WHERE i.order_id = o.id) line_count,
    (SELECT COALESCE(SUM(i.qty), 0) FROM field_sales_order_items i WHERE i.order_id = o.id) qty,
    ${UTC('o.created_at')} created_utc, ${UTC('d.delivered_at')} delivered_utc
  FROM field_deliveries d JOIN field_sales_orders o ON o.id = d.order_id JOIN field_customers c ON c.id = o.customer_id
  WHERE o.status <> 'Cancelled'`;

const out = d => ({
  id: d.id, orderId: d.order_id, customerId: d.customer_id, customer: d.customer, contact: d.contact_person || '', phone: d.phone || '',
  address: d.address, amount: d.total, items: d.line_count, qty: Number(d.qty), status: d.status, eta: d.eta, deliveredAt: d.delivered_utc,
  receivedBy: d.received_by, invoiceId: d.invoice_id, approval: d.approval_status,
  isNew: Date.now() - new Date(d.created_utc).getTime() < 2 * 3600e3 && d.status !== 'Delivered'
});

const mine = staff => (seesAll(staff) ? ['', []] : ['AND (d.staff_id = ? OR o.staff_id = ?)', [staff.id, staff.id]]);

async function find(req) {
  const [clause, args] = mine(req.staff);
  const [[d]] = await pool.query(`${SELECT} AND d.id = ? ${clause}`, [req.params.id, ...args]);
  if (!d) throw fail(404, 'Delivery not found');
  return d;
}

router.get('/', guardSales, wrap(async (req, res) => {
  const [clause, args] = mine(req.staff);
  if (wantsPage(req)) { // paged: filtered and cut in the database
    const { size, page, offset } = pageOf(req);
    const tab = req.query.status === 'delivered' ? 'delivered' : req.query.status === 'all' ? 'all' : 'pending';
    const cond = [], ca = [];
    if (tab === 'pending') cond.push("d.status <> 'Delivered'"); else if (tab === 'delivered') cond.push("d.status = 'Delivered'");
    addRange(cond, ca, 'd.created_at', req);
    addSearch(cond, ca, ['d.id', 'd.order_id', 'c.name', 'd.address'], req.query.q);
    const extra = cond.length ? 'AND ' + cond.join(' AND ') : '';
    const base = "FROM field_deliveries d JOIN field_sales_orders o ON o.id = d.order_id JOIN field_customers c ON c.id = o.customer_id WHERE o.status <> 'Cancelled'";
    const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(d.status <> 'Delivered'), 0) pend, COALESCE(SUM(IF(d.status <> 'Delivered', o.total, 0)), 0) amt ${base} ${clause}`, args);
    const [[m]] = await pool.query(`SELECT COUNT(*) n ${base} ${clause} ${extra}`, [...args, ...ca]);
    const [list] = await pool.query(`${SELECT} ${clause} ${extra} ORDER BY (d.status = 'Delivered'), d.created_at DESC, d.id DESC LIMIT ? OFFSET ?`, [...args, ...ca, size, offset]);
    const n = Number(t.n), pend = Number(t.pend), items = list.map(out);
    return res.json({
      counts: { pending: pend, delivered: n - pend, all: n }, pendingAmount: Number(t.amt), percent: n ? Math.round((n - pend) / n * 100) : 0,
      items, rows: items, total: Number(m.n), page, size
    });
  }
  const [rows] = await pool.query(`${SELECT} ${clause} ORDER BY (d.status = 'Delivered'), d.created_at DESC, d.id DESC LIMIT 200`, args);
  const all = rows.map(out);
  const pending = all.filter(d => d.status !== 'Delivered');
  const q = String(req.query.q || '').trim().toLowerCase();
  const tab = req.query.status === 'delivered' ? 'delivered' : req.query.status === 'all' ? 'all' : 'pending';
  const items = all.filter(d => (tab === 'all' || (tab === 'pending' ? d.status !== 'Delivered' : d.status === 'Delivered'))
    && (!q || [d.id, d.orderId, d.customer, d.address].join(' ').toLowerCase().includes(q)));
  res.json({
    counts: { pending: pending.length, delivered: all.length - pending.length, all: all.length },
    pendingAmount: pending.reduce((t, d) => t + d.amount, 0),
    percent: all.length ? Math.round((all.length - pending.length) / all.length * 100) : 0,
    items
  });
}));

router.get('/:id', guardSales, wrap(async (req, res) => {
  const d = await find(req);
  const [items] = await pool.query('SELECT id, product_id, name, sku, price, qty FROM field_sales_order_items WHERE order_id = ? ORDER BY id', [d.order_id]);
  res.json({
    ...out(d), terms: 'Credit · 30 days', gps: d.lat != null, hasPhoto: !!d.proof_photo, hasSignature: !!d.signature, otpOk: !!d.otp_ok,
    lines: items.map(i => ({ id: i.id, productId: i.product_id, name: i.name, sku: i.sku, price: i.price, qty: i.qty }))
  });
}));

// the delivery note as a PDF (preview, print or save); same visibility as the delivery itself
router.get('/:id/pdf', guardSales, wrap(async (req, res) => {
  const d = await find(req);
  const [items] = await pool.query('SELECT id, name, sku, price, qty FROM field_sales_order_items WHERE order_id = ? ORDER BY id', [d.order_id]);
  const site = parseJson((await pool.query('SELECT v FROM settings WHERE k = ?', ['site']))[0][0]?.v) || {};
  const pdf = await buildDeliveryNotePdf({ ...out(d), terms: 'Credit · 30 days', gps: d.lat != null, hasPhoto: !!d.proof_photo, hasSignature: !!d.signature, otpOk: !!d.otp_ok, lines: items.map(i => ({ id: i.id, name: i.name, sku: i.sku, price: i.price, qty: i.qty })) }, site);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="' + d.id + '.pdf"', 'Cache-Control': 'no-store' }).send(pdf);
}));

router.put('/:id/start', guardSales, wrap(async (req, res) => {
  const d = await find(req);
  if (d.status === 'Delivered') throw fail(409, 'Already delivered');
  await pool.query('UPDATE field_deliveries SET status = "OnTheWay", eta = ?, staff_id = COALESCE(staff_id, ?) WHERE id = ?', [String(req.body.eta || d.eta || '').slice(0, 30), req.staff.id, d.id]);
  res.json({ ok: true });
}));

router.post('/:id/otp', guardSales, wrap(async (req, res) => {
  const d = await find(req);
  if (d.status === 'Delivered') throw fail(409, 'Already delivered');
  const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  await pool.query('UPDATE field_deliveries SET otp_hash = ? WHERE id = ?', [otpHash(d.id, code), d.id]);
  otpTries.delete(d.id);
  const p = digits(d.phone).slice(-11);
  if (!PROD) console.log(`[field] delivery ${d.id} OTP: ${code}`);
  // there is no SMS gateway yet: outside production the code is only returned as devCode, in production nothing is sent at all
  res.json({ to: p.length === 11 ? `+880 ${p.slice(1, 3)}•• ••• ${p.slice(-3)}` : 'the customer', smsSent: false, ...(PROD ? {} : { devCode: code }) });
}));

router.put('/:id/confirm', guardSales, wrap(async (req, res) => {
  const d = await find(req);
  if (d.status === 'Delivered') throw fail(409, 'This delivery is already confirmed');
  if (d.approval_status !== 'Approved') throw fail(409, 'Order is awaiting approval');
  const [items] = await pool.query('SELECT id, product_id, qty FROM field_sales_order_items WHERE order_id = ?', [d.order_id]);
  const checked = new Set((Array.isArray(req.body.checked) ? req.body.checked : []).map(Number));
  if (!items.every(i => checked.has(i.id))) throw fail(400, 'Check every item before confirming');
  if (!req.body.photo) throw fail(400, 'Add a photo of the delivered goods');
  const otp = String(req.body.otp || '').trim();
  let otpOk = false;
  if (otp) {
    const tr = otpTries.get(d.id);
    if (tr && tr.n >= 5 && Date.now() - tr.at < 15 * 60000) throw fail(429, 'Too many wrong codes. Send a new code to the customer.');
    const a = Buffer.from(otpHash(d.id, otp)), b = Buffer.from(d.otp_hash || '0');
    otpOk = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!otpOk) { otpTries.set(d.id, { n: (tr && Date.now() - tr.at < 15 * 60000 ? tr.n : 0) + 1, at: Date.now() }); throw fail(400, 'The customer code is not correct'); }
    otpTries.delete(d.id);
  }
  if (!req.body.signature && !otpOk) throw fail(400, 'Get the customer\'s signature or OTP');
  const lat = req.body.lat == null ? null : coord(req.body.lat, 90), lng = req.body.lng == null ? null : coord(req.body.lng, 180);
  const receivedBy = String(req.body.receivedBy || d.contact_person || '').trim().slice(0, 120);

  const photo = saveImage(req.body.photo, 'dlv-photo');
  let sign = null;
  const invoiceId = await nextSeq('field_inv', 'field_invoices', 'INV-', 2200);
  const conn = await pool.getConnection();
  try {
    sign = req.body.signature ? saveImage(req.body.signature, 'dlv-sign', { png: true, maxMb: 1 }) : null;
    await conn.beginTransaction();
    const [[lock]] = await conn.query('SELECT status FROM field_deliveries WHERE id = ? FOR UPDATE', [d.id]);
    if (lock.status === 'Delivered') throw fail(409, 'This delivery is already confirmed');
    const [[ord]] = await conn.query('SELECT approval_status, status FROM field_sales_orders WHERE id = ? FOR UPDATE', [d.order_id]);
    if (ord.approval_status !== 'Approved' || ord.status === 'Cancelled') throw fail(409, 'Order is awaiting approval');
    const need = new Map();
    for (const i of items) need.set(i.product_id, (need.get(i.product_id) || 0) + i.qty);
    const [stock] = need.size ? await conn.query('SELECT id, name, stock FROM products WHERE id IN (?) FOR UPDATE', [[...need.keys()]]) : [[]];
    const short = stock.filter(p => p.stock < need.get(p.id));
    if (short.length) throw fail(409, 'Not enough stock: ' + short.map(p => `${p.name} (need ${need.get(p.id)}, have ${p.stock})`).join(', '));
    for (const [pid, qty] of need) await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, pid]);
    await conn.query('INSERT INTO field_invoices (id, order_id, order_ref, customer_id, total, paid, due_date, created_at) VALUES (?,?,?,?,?,0, DATE_ADD(UTC_DATE(), INTERVAL 30 DAY), UTC_TIMESTAMP())', [invoiceId, d.order_id, d.order_id, d.customer_id, d.total]);
    await conn.query('UPDATE field_deliveries SET status = "Delivered", delivered_at = UTC_TIMESTAMP(), received_by = ?, lat = ?, lng = ?, proof_photo = ?, signature = ?, otp_ok = ?, invoice_id = ?, staff_id = COALESCE(staff_id, ?) WHERE id = ?',
      [receivedBy, lat, lng, photo, sign, otpOk ? 1 : 0, invoiceId, req.staff.id, d.id]);
    await conn.query('UPDATE field_sales_orders SET status = "Delivered" WHERE id = ?', [d.order_id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    removeFile(photo); removeFile(sign);
    throw e;
  } finally { conn.release(); }

  const managers = await staffIdsByRole('manager', 'accountant', 'admin');
  notify([...new Set([d.order_staff, ...managers])].filter(i => i !== req.staff.id), {
    icon: 'local_shipping', cat: 'Updates', title: 'Delivery confirmed', sub: `${d.id} · ${d.customer} received`,
    body: `Delivery ${d.id} was received by ${receivedBy || d.customer}. Invoice ${invoiceId} was posted to accounts.`,
    rows: [['Client', d.customer], ['Delivery', d.id], ['Invoice', invoiceId], ['Delivered by', req.staff.name], ['Proof', otpOk ? 'Photo + OTP' : 'Photo + signature']], a1: 'View proof', a1Icon: 'verified' });
  // `mailed` is true only when the receipt really left through SMTP
  const mailed = await mailCustomer(d.customer_id, `Delivery ${d.id} received - AR Trade International`, [
    `Your order ${d.order_id} was delivered (delivery note ${d.id}) and received by ${receivedBy || 'your team'}.`,
    `Invoice ${invoiceId} - Tk ${Number(d.total).toLocaleString('en-IN')} - payable within 30 days.`]);
  res.json({ ok: true, invoiceId, deliveredAt: new Date().toISOString(), receivedBy, gps: lat != null, mailed, stockReduced: true });
}));

router.get('/:id/proof/:kind', guardSales, wrap(async (req, res) => {
  const d = await find(req);
  const file = req.params.kind === 'signature' ? d.signature : d.proof_photo;
  if (!file) throw fail(404, 'No proof saved');
  res.sendFile(path.join(PROOFS, path.basename(file)));
}));

export default router;
