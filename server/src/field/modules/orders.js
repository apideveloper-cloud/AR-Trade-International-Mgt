// Sales orders from the field.
//   GET  /api/field/orders/customers?q=        customers with credit limit + open dues (customer picker)
//   POST /api/field/orders                     { customerId, lines: [{ productId, qty }], notes } -> order (SO-2026-nnnn)
//   GET  /api/field/orders?mine=1&limit=       recent orders (+ today's summary); RM sees own, manager/accountant/admin all
//   GET  /api/field/orders/:id                 order detail with lines
//   (GET /orders also takes ?approval=Pending|Approved|Rejected; order JSON carries approvalNote)
//   PUT  /api/field/orders/:id/approve         { status: 'approved' | 'rejected', remarks }  (manager / admin)
// Placing an order: prices come from the products table (never from the app), 5% order discount, synced to the ledger flag,
// a delivery (DN-nnnn, status Ready) is created and managers are notified. Stock is NOT touched here: it is reduced when the
// delivery is confirmed (deliveries.js).
import { Router } from 'express';
import { pool, fail, wrap, guard, guardRole, nextSeq, notify, staffIdsByRole, UTC, parseJson, clientRefOf } from '../common.js';
import { buildSalesOrderPdf } from '../../salesorder.js';
import { bdDayStartUtc, creditOf, customerById, customerOut, mailCustomer, seesAll } from '../sales_util.js';
import { skuOf } from './products.js';

const router = Router();
const DISCOUNT_PCT = 5;

router.get('/customers', guardRole('rm', 'manager', 'accountant'), wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.contact_person, c.phone, c.address, c.area,
            COALESCE(cr.credit_limit, 300000) credit,
            (SELECT COALESCE(SUM(i.total - i.paid), 0) FROM field_invoices i WHERE i.customer_id = c.id) due
     FROM field_customers c LEFT JOIN field_customer_credit cr ON cr.customer_id = c.id
     ${q ? 'WHERE c.name LIKE ? OR c.contact_person LIKE ? OR c.area LIKE ?' : ''} ORDER BY c.name LIMIT 40`,
    q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []);
  res.json(rows.map(r => customerOut(r, { credit: r.credit, due: Number(r.due) })));
}));

async function orderOut(o) {
  const [items] = await pool.query('SELECT id, product_id, name, sku, price, qty FROM field_sales_order_items WHERE order_id = ? ORDER BY id', [o.id]);
  return {
    id: o.id, customerId: o.customer_id, customer: o.customer_name, status: o.status, approval: o.approval_status, approvalNote: o.approval_note || '',
    subtotal: o.subtotal, discount: o.discount, total: o.total, synced: !!o.accounting_synced, notes: o.notes,
    by: o.staff_name, createdAt: o.created_utc, itemCount: items.reduce((t, i) => t + i.qty, 0),
    lines: items.map(i => ({ id: i.id, productId: i.product_id, name: i.name, sku: i.sku, price: i.price, qty: i.qty }))
  };
}
const ORDER_SELECT = `SELECT o.*, c.name customer_name, s.name staff_name, ${UTC('o.created_at')} created_utc
  FROM field_sales_orders o JOIN field_customers c ON c.id = o.customer_id JOIN staff s ON s.id = o.staff_id`;

router.post('/', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const ref = clientRefOf(req.body);
  if (ref) { // a retry of an order this person already placed: return it again (same shape), do not create a second one
    const [[dup]] = await pool.query(`${ORDER_SELECT} WHERE o.staff_id = ? AND o.client_ref = ? LIMIT 1`, [req.staff.id, ref]);
    if (dup) {
      const [[d]] = await pool.query('SELECT id FROM field_deliveries WHERE order_id = ? ORDER BY created_at LIMIT 1', [dup.id]);
      return res.json({ ...(await orderOut(dup)), deliveryId: d?.id || null, mailed: false });
    }
  }
  const customer = await customerById(parseInt(req.body.customerId, 10));
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  if (!lines.length || lines.length > 60) throw fail(400, 'Add at least one product');
  const qty = new Map();
  for (const l of lines) {
    const id = parseInt(l.productId, 10), n = parseInt(l.qty, 10);
    if (!id || !(n >= 1 && n <= 999)) throw fail(400, 'Invalid product or quantity');
    qty.set(id, (qty.get(id) || 0) + n);
  }
  const [prods] = await pool.query('SELECT id, name, sku, price, stock FROM products WHERE active = 1 AND id IN (?)', [[...qty.keys()]]);
  if (prods.length !== qty.size) throw fail(400, 'A product is no longer available');
  let subtotal = 0;
  for (const p of prods) {
    if (!(p.price > 0)) throw fail(400, `${p.name} needs a quotation — it cannot be ordered here`);
    if (qty.get(p.id) > p.stock) throw fail(409, `Only ${p.stock} of ${p.name} in stock`);
    subtotal += p.price * qty.get(p.id);
  }
  const discount = Math.round(subtotal * DISCOUNT_PCT / 100);
  const notes = String(req.body.notes || '').trim().slice(0, 255);
  const id = await nextSeq('field_so', 'field_sales_orders', 'SO-2026-', 1046);
  const dn = await nextSeq('field_dn', 'field_deliveries', 'DN-', 590);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT INTO field_sales_orders (id, customer_id, staff_id, status, subtotal, discount, total, notes, accounting_synced, approval_status, client_ref, created_at) VALUES (?,?,?,?,?,?,?,?,1,"Pending",?, UTC_TIMESTAMP())',
      [id, customer.id, req.staff.id, 'Placed', subtotal, discount, subtotal - discount, notes, ref]);
    // first order for an Upcoming customer makes them Active (same as visits.js and POST /customers/:id/convert)
    await conn.query("UPDATE field_customers SET kind = 'Active', next_step = '' WHERE id = ? AND kind <> 'Active'", [customer.id]);
    for (const p of prods) {
      await conn.query('INSERT INTO field_sales_order_items (order_id, product_id, name, sku, price, qty) VALUES (?,?,?,?,?,?)', [id, p.id, p.name, skuOf(p), p.price, qty.get(p.id)]);
    }
    await conn.query('INSERT INTO field_deliveries (id, order_id, status, address, staff_id, created_at) VALUES (?,?, "Ready", ?, ?, UTC_TIMESTAMP())', [dn, id, customer.address || customer.area || '', req.staff.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

  staffIdsByRole('manager', 'admin').then(ids => notify(ids.filter(i => i !== req.staff.id), {
    icon: 'hourglass_top', cat: 'Approvals', title: 'Sales order awaiting approval', sub: `${id} · ${customer.name} · ৳ ${(subtotal - discount).toLocaleString('en-IN')}`,
    body: `${req.staff.name} created sales order ${id} for ${customer.name}.`,
    rows: [['Order', id], ['Customer', customer.name], ['Total', '৳ ' + (subtotal - discount).toLocaleString('en-IN')], ['Created by', req.staff.name]], a1: 'Open orders', a1Icon: 'shopping_bag' }));

  const [[o]] = await pool.query(`${ORDER_SELECT} WHERE o.id = ?`, [id]);
  const out = await orderOut(o);
  // `mailed` is true only when the confirmation really left through SMTP (the app shows the "mailed to customer" line from it)
  const mailed = await mailCustomer(customer.id, `Order ${id} received - AR Trade International`, [
    `Thank you for your order ${id}.`,
    ...out.lines.map(l => `${l.name} x ${l.qty}`),
    `Total: Tk ${out.total.toLocaleString('en-IN')} (after ${DISCOUNT_PCT}% discount). It will be delivered after our manager approves it.`]);
  res.json({ ...out, deliveryId: dn, mailed });
}));

router.get('/', guardRole('rm', 'manager', 'accountant'), wrap(async (req, res) => {
  const mine = !seesAll(req.staff) || req.query.mine === '1';
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const ap = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }[String(req.query.approval || '').toLowerCase()];
  const conds = [], args = [];
  if (mine) { conds.push('o.staff_id = ?'); args.push(req.staff.id); }
  if (ap) { conds.push('o.approval_status = ?'); args.push(ap); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const [rows] = await pool.query(`${ORDER_SELECT} ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ?`, [...args, limit]);
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(total), 0) total FROM field_sales_orders o WHERE o.created_at >= ? ${mine ? 'AND o.staff_id = ?' : ''}`, mine ? [bdDayStartUtc(), req.staff.id] : [bdDayStartUtc()]);
  const items = [];
  for (const o of rows) items.push(await orderOut(o));
  res.json({ summary: { ordersToday: t.n, salesToday: Number(t.total) }, items });
}));

router.get('/:id', guard(), wrap(async (req, res) => {
  const [[o]] = await pool.query(`${ORDER_SELECT} WHERE o.id = ?`, [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  if (o.staff_id !== req.staff.id && !seesAll(req.staff)) throw fail(403, 'Your role cannot do this');
  const c = await customerById(o.customer_id);
  res.json({ ...(await orderOut(o)), customerInfo: customerOut(c, await creditOf(c.id)) });
}));

// the sales order as a PDF (preview in the admin console, print or save); same visibility as the order itself
router.get('/:id/pdf', guard(), wrap(async (req, res) => {
  const [[o]] = await pool.query(`${ORDER_SELECT} WHERE o.id = ?`, [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  if (o.staff_id !== req.staff.id && !seesAll(req.staff)) throw fail(403, 'Your role cannot do this');
  const c = await customerById(o.customer_id);
  const ap = o.approved_by ? (await pool.query('SELECT name FROM staff WHERE id = ?', [o.approved_by]))[0][0] : null;
  const site = parseJson((await pool.query('SELECT v FROM settings WHERE k = "site"'))[0][0]?.v) || {};
  const pdf = await buildSalesOrderPdf({ ...(await orderOut(o)), customerInfo: customerOut(c), approvedBy: ap?.name || '' }, site);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${o.id}.pdf"`, 'Cache-Control': 'no-store' }).send(pdf);
}));

router.put('/:id/approve', guardRole('manager'), wrap(async (req, res) => {
  const status = { approved: 'Approved', rejected: 'Rejected' }[req.body.status];
  if (!status) throw fail(400, 'Status must be approved or rejected');
  const remarks = String(req.body.remarks || '').trim().slice(0, 255);
  if (status === 'Rejected' && !remarks) throw fail(400, 'Please write a reason for rejecting');
  const [[o]] = await pool.query('SELECT * FROM field_sales_orders WHERE id = ?', [req.params.id]);
  if (!o) throw fail(404, 'Order not found');
  if (o.approval_status !== 'Pending') throw fail(409, 'This order was already decided');
  await pool.query('UPDATE field_sales_orders SET approval_status = ?, approved_by = ?, approval_note = ?, status = IF(? = "Rejected", "Cancelled", status) WHERE id = ? AND approval_status = "Pending"', [status, req.staff.id, remarks, status, o.id]);
  await notify(o.staff_id, {
    icon: status === 'Approved' ? 'fact_check' : 'cancel', cat: 'Approvals', title: `Sales order ${status.toLowerCase()}`, sub: `${o.id} ${status.toLowerCase()} by ${req.staff.name}`,
    body: `Sales order ${o.id} was ${status.toLowerCase()}.` + (remarks ? ` Remarks: ${remarks}` : ''), rows: [['Order', o.id], ['Remarks', remarks || '—']] });
  res.json({ ok: true });
}));

export default router;
