// Admin orders: the list with advanced search, one order, comments, status changes, invoice PDF / email and delete.
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { esc, fail, parseJson, wrap } from '../util.js';
import { applyFlow, cancelOrder, FROM_STATUS, reopenError } from '../flow.js';
import { buildInvoicePdf, docLabel } from '../invoice.js';
import { mailReady, mailSetupHint, sendMail } from '../mailer.js';
import { day, whereOf } from '../listing.js';
import { can } from '../permissions.js';
import { like, page } from '../adminHelpers.js';

const STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
const RIDER = 'Delivery rider';

async function loadOrders(where, params, extra = '') {
  const [rows] = await pool.query(`SELECT * FROM orders ${where} ORDER BY created_at DESC ${extra}`, params);
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id IN (?)', [ids]);
  const [hist] = await pool.query('SELECT * FROM order_history WHERE order_id IN (?) ORDER BY id', [ids]);
  return rows.map(r => ({
    id: r.id, date: r.created_at, status: r.status, payment: r.payment, gateway: r.gateway, payStatus: r.pay_status, area: r.area, address: r.address,
    note: r.note, slot: r.slot, partial: r.partial, hold: !!r.hold, holdNote: r.hold_note, vatInvoice: !!r.vat_invoice, company: r.company, bin: r.bin, express: !!r.express, source: r.source || 'Customer', placedBy: r.placed_by || '',
    distanceKm: r.distance_km != null ? Number(r.distance_km) : null, shipPartner: r.ship_partner || '', destLat: r.dest_lat != null ? Number(r.dest_lat) : null, destLng: r.dest_lng != null ? Number(r.dest_lng) : null,
    customer: { name: r.customer_name, phone: r.customer_phone, email: r.customer_email },
    subtotal: r.subtotal, discount: r.discount + r.member_discount, delivery: r.delivery, total: r.total, vat: r.vat, vatAmount: r.vat_amount != null ? Number(r.vat_amount) : null,
    items: items.filter(i => i.order_id === r.id).map(i => ({ id: i.product_id, name: i.name, img: i.img, price: i.price, qty: i.qty, backorder: i.backorder })),
    history: hist.filter(h => h.order_id === r.id).map(h => ({ s: h.status, at: h.at, kind: h.kind, note: h.note, by: h.by_name }))
  }));
}

const loadOrder = async id => (await loadOrders('WHERE id = ?', [id]))[0];
const money = v => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null);
const word = v => String(v || '').trim().slice(0, 80);

/** The WHERE conditions for the orders list: plain filters plus the advanced search (customer, product, date, amount). */
/** WHERE parts for the orders list. `skipStatus` leaves the status out, which is what the per-status tab counts need. */
function orderFilters(req, { skipStatus = false } = {}) {
  const q = req.query;
  const cond = [], params = [];
  if (q.q) { cond.push('(id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'); params.push(like(q.q), like(q.q), like(q.q)); }
  const wanted = skipStatus ? [] : String(q.status || '').split(',').filter(x => STATUSES.includes(x));
  if (wanted.length === 1) { cond.push('status = ?'); params.push(wanted[0]); } else if (wanted.length > 1) { cond.push(`status IN (${wanted.map(() => '?').join(',')})`); params.push(...wanted); }
  if (q.pay) { cond.push('payment LIKE ?'); params.push(like(q.pay)); }
  if (['Customer', 'Call center', 'Admin', 'Seller'].includes(q.source)) { cond.push('source = ?'); params.push(q.source); }
  if (['inside', 'suburb', 'outside'].includes(q.area)) { cond.push('area = ?'); params.push(q.area); }
  if (word(q.customer)) { const c = like(word(q.customer)); cond.push('(customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ? OR company LIKE ?)'); params.push(c, c, c, c); }
  if (word(q.product)) { cond.push('EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = orders.id AND oi.name LIKE ?)'); params.push(like(word(q.product))); }
  if (day(q.from)) { cond.push('created_at >= ?'); params.push(day(q.from) + ' 00:00:00'); }
  if (day(q.to)) { cond.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(day(q.to)); }
  if (money(q.min) !== null) { cond.push('total >= ?'); params.push(money(q.min)); }
  if (money(q.max) !== null) { cond.push('total <= ?'); params.push(money(q.max)); }
  if (req.staff.role === RIDER) { cond.push('(status IN ("Packed","Shipped") OR rider_id = ?)'); params.push(req.staff.id); } // riders: the pick-up queue plus their own deliveries
  return { cond, params };
}

/** Money figures for the orders page header: only for roles that may see the dashboard (not riders). */
async function orderSummary() {
  const [[a]] = await pool.query(`SELECT COUNT(*) total, SUM(status = 'Cancelled') cancelled,
    COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN total END), 0) revenue,
    SUM(DATE(created_at) = CURDATE()) today,
    COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status <> 'Cancelled' THEN total END), 0) todayRevenue,
    COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled', 'Delivered') THEN total END), 0) openValue,
    SUM(status NOT IN ('Cancelled', 'Delivered')) open,
    COALESCE(SUM(CASE WHEN status <> 'Cancelled' AND pay_status = 'Unpaid' THEN total END), 0) unpaid FROM orders`);
  const live = a.total - a.cancelled;
  return { total: Number(a.total), cancelled: Number(a.cancelled), revenue: Number(a.revenue), avg: live ? Math.round(Number(a.revenue) / live) : 0, today: Number(a.today), todayRevenue: Number(a.todayRevenue), open: Number(a.open), openValue: Number(a.openValue), unpaid: Number(a.unpaid) };
}

const siteInfo = async () => parseJson((await pool.query('SELECT v FROM settings WHERE k = "site"'))[0][0]?.v) || {};
async function invoiceOrder(req) {
  if (req.staff.role === RIDER) throw fail(403, 'Riders cannot open invoices');
  const o = await loadOrder(req.params.id);
  if (!o) throw fail(404, 'Order not found');
  return o;
}

export function mountOrderRoutes(router, guard) {
  router.get('/orders', guard('orders.view'), wrap(async (req, res) => {
    const { size, offset } = page(req);
    const { cond, params } = orderFilters(req);
    const where = whereOf(cond);
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM orders ${where}`, params);
    // tab counts follow every filter except the status itself, so each tab shows how many orders it would list
    const cf = orderFilters(req, { skipStatus: true });
    const [counts] = await pool.query(`SELECT status, COUNT(*) c FROM orders ${whereOf(cf.cond)} GROUP BY status`, cf.params);
    const summary = req.query.summary === '1' && can(req.staff, 'dashboard.view') ? await orderSummary() : undefined;
    let queue; // Deliveries page: cash still to collect on orders that are packed or on the road
    if (req.query.queue === '1') {
      const [[qd]] = await pool.query("SELECT COALESCE(SUM(CASE WHEN pay_status <> 'Paid' THEN total END), 0) cod, COALESCE(SUM(pay_status <> 'Paid'), 0) codCount FROM orders WHERE status IN ('Packed','Shipped')");
      queue = { cod: Number(qd.cod), codCount: Number(qd.codCount) };
    }
    res.json({ total: n, counts: Object.fromEntries(counts.map(c => [c.status, c.c])), summary, queue, rows: await loadOrders(where, params, `LIMIT ${size} OFFSET ${offset}`) });
  }));

  router.get('/orders/:id', guard('orders.view'), wrap(async (req, res) => {
    const rider = req.staff.role === RIDER;
    const [o] = await loadOrders('WHERE id = ?' + (rider ? ' AND (status IN ("Packed","Shipped") OR rider_id = ?)' : ''), rider ? [req.params.id, req.staff.id] : [req.params.id]);
    if (!o) throw fail(404, 'Order not found');
    res.json(o);
  }));

  /** VAT / taxes line on this order's invoice. Show-only: totals, payments and stock are not touched. Empty clears it ("Excluding all Govt VAT & taxes"). */
  router.put('/orders/:id/vat', guard('orders.status'), wrap(async (req, res) => {
    if (req.staff.role === RIDER) throw fail(403, 'Riders cannot change the invoice VAT / taxes');
    const raw = req.body.amount;
    let amount = null;
    if (raw !== '' && raw != null) {
      amount = Math.round(Number(raw));
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) throw fail(400, 'Enter the VAT / tax amount as a number, or leave it empty');
    }
    const [[o]] = await pool.query('SELECT status FROM orders WHERE id = ?', [req.params.id]);
    if (!o) throw fail(404, 'Order not found');
    await pool.query('UPDATE orders SET vat_amount = ? WHERE id = ?', [amount, req.params.id]);
    await pool.query("INSERT INTO order_history (order_id,status,flow,note,by_name,kind) VALUES (?,?,?,?,?,'comment')", [req.params.id, o.status, null, amount == null ? 'Invoice VAT / taxes cleared (shown as excluded)' : `Invoice VAT / taxes set to ৳${amount}`, req.staff.name]);
    res.json(await loadOrder(req.params.id));
  }));

  /** Staff comment on an order: kept on the order's timeline, never shown to the customer. */
  router.post('/orders/:id/comments', guard('orders.view'), wrap(async (req, res) => {
    const text = String(req.body.text || '').trim().slice(0, 255);
    if (!text) throw fail(400, 'Write the comment first');
    const rider = req.staff.role === RIDER;
    const [[o]] = await pool.query('SELECT status, rider_id FROM orders WHERE id = ?', [req.params.id]);
    if (!o || (rider && !(o.rider_id === req.staff.id || (!o.rider_id && ['Packed', 'Shipped'].includes(o.status))))) throw fail(404, 'Order not found');
    await pool.query("INSERT INTO order_history (order_id,status,flow,note,by_name,kind) VALUES (?,?,?,?,?,'comment')", [req.params.id, o.status, null, text, req.staff.name]);
    res.json(await loadOrder(req.params.id));
  }));

  router.put('/orders/:id/status', guard('orders.status'), wrap(async (req, res) => {
    const { status } = req.body;
    if (!STATUSES.includes(status)) throw fail(400, 'Unknown status');
    const remarks = String(req.body.remarks || '').trim().slice(0, 255);
    if (remarks.length < 3) throw fail(400, 'Write the remarks for this status change (at least 3 characters)');
    const rider = req.staff.role === RIDER;
    // riders only start their own trip here; closing a delivery needs the OTP / signature and cash tick in the Delivery Hub
    if (rider && status !== 'Shipped') throw fail(403, 'Riders start the trip here; close the delivery with the OTP or signature in the Delivery Hub');
    const [[o]] = await pool.query('SELECT status, rider_id FROM orders WHERE id = ?', [req.params.id]);
    if (!o) throw fail(404, 'Order not found');
    if (rider && !(o.rider_id === req.staff.id || (!o.rider_id && o.status === 'Packed'))) throw fail(404, 'Order not found');
    const blocked = reopenError(o.status, status);
    if (blocked) throw fail(400, blocked);
    if (o.status !== status) {
      if (status === 'Cancelled') await cancelOrder(req.params.id, remarks, req.staff.name); // also puts the stock back
      else {
        const extra = {};
        if (status === 'Shipped') { // same trip details the Delivery Hub creates, so the OTP proof works
          const cur = (await pool.query('SELECT otp FROM orders WHERE id = ?', [req.params.id]))[0][0];
          extra.out_at = new Date(); // a Date is written and read back in the same driver time zone (same as the delivery hub)
          extra.otp = cur.otp || String(1000 + crypto.randomInt(9000));
          if (rider) extra.rider_id = req.staff.id;
        }
        await applyFlow(req.params.id, FROM_STATUS[status], remarks, extra, req.staff.name);
        if (status === 'Delivered') await pool.query('UPDATE orders SET pay_status = IF(payment = "Cash on delivery", "Paid", pay_status) WHERE id = ?', [req.params.id]);
      }
    }
    res.json(await loadOrder(req.params.id));
  }));

  // ---------- order / invoice PDF: view or download it, or email it to the customer ----------
  router.get('/orders/:id/invoice.pdf', guard('orders.view'), wrap(async (req, res) => {
    const o = await invoiceOrder(req);
    const pdf = await buildInvoicePdf(o, await siteInfo());
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${docLabel(o).fileName}"`, 'Cache-Control': 'no-store' }).send(pdf);
  }));
  router.post('/orders/:id/invoice/email', guard('orders.status'), wrap(async (req, res) => {
    const o = await invoiceOrder(req);
    const to = String(req.body.to || o.customer.email || '').trim().toLowerCase();
    if (!/^[^\s,;<>"()]+@[^\s,;<>"()]+\.[^\s,;<>"()]+$/.test(to) || to.length > 160) throw fail(400, 'Enter one valid email address for the customer');
    if (!mailReady('sales')) throw fail(409, 'Email sending is not set up yet. ' + mailSetupHint('sales'));
    const site = await siteInfo();
    const dk = docLabel(o), inv = dk.no;
    const taka = n => '৳ ' + Math.round(Number(n) || 0).toLocaleString('en-US');
    const note = String(req.body.message || '').trim().slice(0, 1000);
    const paid = o.payStatus === 'Paid';
    const pdf = await buildInvoicePdf(o, site);
    await sendMail({ channel: 'sales',
      to, replyTo: site.email || undefined, subject: `Your ${dk.lower} ${inv} from AR Trade International`,
      text: `Hello ${o.customer.name},\n\n${note ? note + '\n\n' : ''}Thank you for your order ${o.id}. Your ${dk.lower} ${inv} is attached as a PDF.\n\nOrder total: ${taka(o.total)} (${paid ? 'paid' : 'payment due'})\nStatus: ${o.status}\n\nAR Trade International\n${[site.phone, site.email].filter(Boolean).join(' · ')}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#0b1631"><p>Hello ${esc(o.customer.name)},</p>${note ? `<p style="white-space:pre-wrap">${esc(note)}</p>` : ''}<p>Thank you for your order <b>${esc(o.id)}</b>. Your ${dk.lower} <b>${inv}</b> is attached as a PDF.</p><table cellpadding="6" style="background:#f4f7fc;border-radius:8px"><tr><td>Order total</td><td><b>${taka(o.total)}</b> (${paid ? 'paid' : 'payment due'})</td></tr><tr><td>Status</td><td>${esc(o.status)}</td></tr></table><p style="color:#6b7388;font-size:13px">AR Trade International<br>${esc([site.phone, site.email].filter(Boolean).join(' · '))}</p></div>`,
      attachments: [{ filename: dk.fileName, content: pdf, contentType: 'application/pdf' }]
    });
    await pool.query("INSERT INTO order_history (order_id,status,flow,note,by_name,kind) VALUES (?,?,?,?,?,'comment')", [o.id, o.status, 'Invoice emailed', `${dk.word} ${inv} emailed to ${to}`.slice(0, 255), req.staff.name]);
    res.json({ ok: true, to });
  }));

  router.delete('/orders/:id', guard('orders.delete'), wrap(async (req, res) => {
    const [[o]] = await pool.query('SELECT status FROM orders WHERE id = ?', [req.params.id]);
    if (!o) throw fail(404, 'Order not found');
    if (o.status !== 'Cancelled') throw fail(400, 'Only cancelled orders can be deleted. Cancel it first so the stock goes back.');
    await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  }));
}
