// Purchases (goods receipts): reading lists, detail, open purchase orders and creating a purchase.
import { Router } from 'express';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { D, fail, iso, nextSeq, text, today, tx, wrap } from '../util.js';
import { addAmount, addRange, addSearch, whereOf } from '../listing.js';
import { VIEW, MANAGE, BILLED, PAID } from './constants.js';
import { nextInvoiceNo } from './numbering.js';
import { addVendorFilter, cleanLines, pagingFor, vendorOf } from './helpers.js';
import { billedOf, sum } from './pure.js';

const router = Router();

router.get('/receipts', guard(VIEW), wrap(async (req, res) => {
  const cond = [], args = [];
  addVendorFilter(cond, args, 'r.vendor_id', req);
  addSearch(cond, args, ['r.id', 'r.invoice_no', 'r.reference_no', 'v.name', 'r.po_id'], req.query.q);
  addRange(cond, args, 'r.received_on', req);
  addAmount(cond, args, 'r.total', req);
  if (['Pending', 'Approved', 'Stocked', 'Rejected'].includes(req.query.stage)) { cond.push('r.status = ?'); args.push(req.query.stage); }
  if (req.query.status === 'due') cond.push(`r.${BILLED} AND r.total > ${PAID}`);
  if (req.query.status === 'paid') cond.push(`r.${BILLED} AND r.total <= ${PAID}`);
  const from = `FROM stock_receipts r JOIN field_vendors v ON v.id = r.vendor_id ${whereOf(cond)}`;
  const { paged, size, offset } = pagingFor(req, 200);
  const [rows] = await pool.query(`SELECT r.id, r.vendor_id, v.name vendor, r.po_id, r.invoice_no, r.reference_no, ${D('r.received_on')} d, r.total, r.staff_name, r.note, r.status,
    (SELECT COALESCE(SUM(qty), 0) FROM stock_receipt_items i WHERE i.receipt_id = r.id) pcs, ${PAID} paid
    ${from} ORDER BY r.received_on DESC, r.created_at DESC LIMIT ${size} OFFSET ${offset}`, args);
  const items = rows.map(r => ({ id: r.id, vendorId: r.vendor_id, vendor: r.vendor, poId: r.po_id, invoiceNo: r.invoice_no, referenceNo: r.reference_no, date: r.d, total: r.total, pcs: Number(r.pcs), paid: Number(r.paid), due: billedOf(r.status) ? Math.max(0, r.total - Number(r.paid)) : 0, status: r.status, by: r.staff_name, note: r.note }));
  if (!paged) return res.json({ items });
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(r.total), 0) total, COALESCE(SUM(${PAID}), 0) paid, COALESCE(SUM(r.${BILLED} AND r.total > ${PAID}), 0) due_n, COALESCE(SUM(IF(r.${BILLED}, GREATEST(r.total - ${PAID}, 0), 0)), 0) due_amt, COALESCE(SUM(r.status = 'Pending'), 0) pend, COALESCE(SUM(r.status = 'Approved'), 0) appr ${from}`, args);
  res.json({ total: Number(t.n), rows: items, items, totals: { bills: Number(t.n), total: Number(t.total), paid: Number(t.paid), due: Number(t.due_amt), dueCount: Number(t.due_n), pending: Number(t.pend), approved: Number(t.appr) } });
}));

router.get('/next-invoice', guard(VIEW), wrap(async (req, res) => {
  res.json({ invoiceNo: await nextInvoiceNo(iso(req.query.date, today()).slice(2, 4), true) });
}));

router.get('/receipts/:id', guard(VIEW), wrap(async (req, res) => {
  const [[r]] = await pool.query(`SELECT r.*, ${D('r.received_on')} d, v.name vendor, v.code vendor_code FROM stock_receipts r JOIN field_vendors v ON v.id = r.vendor_id WHERE r.id = ?`, [req.params.id]);
  if (!r) throw fail(404, 'Purchase not found');
  const [[lines], [pays]] = await Promise.all([pool.query('SELECT i.product_id, i.name, i.qty, i.unit_cost, i.discount, i.sale_price, i.remarks, p.price cur_price, p.img FROM stock_receipt_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.receipt_id = ? ORDER BY i.id', [r.id]), pool.query(`SELECT id, ${D('paid_on')} d, method, reference, amount FROM vendor_payments WHERE receipt_id = ? ORDER BY paid_on`, [r.id])]);
  const paid = pays.reduce((t, p) => t + p.amount, 0);
  res.json({ id: r.id, vendorId: r.vendor_id, vendor: r.vendor, vendorCode: r.vendor_code || '', poId: r.po_id, invoiceNo: r.invoice_no, referenceNo: r.reference_no, createdAt: r.created_at, date: r.d, note: r.note, total: r.total, paid, due: billedOf(r.status) ? Math.max(0, r.total - paid) : 0, by: r.staff_name,
    status: r.status, decidedBy: r.decided_by, decidedAt: r.decided_at, decisionNote: r.decision_note, stockedBy: r.stocked_by, stockedAt: r.stocked_at,
    lines: lines.map(l => ({ productId: l.product_id, name: l.name, qty: l.qty, unitCost: l.unit_cost, discount: l.discount, total: l.qty * l.unit_cost - l.discount, salePrice: l.sale_price, remarks: l.remarks, currentPrice: l.cur_price, img: l.img || '' })), payments: pays.map(p => ({ id: p.id, date: p.d, method: p.method, reference: p.reference, amount: p.amount })) });
}));

/** Approved purchase orders that have not been received yet, so stock can be received against them. */
router.get('/open-orders', guard(VIEW), wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT p.id, p.vendor_id, v.name vendor, p.grand_total, ${D('p.deliver_by')} deliver_by FROM field_purchase_orders p JOIN field_vendors v ON v.id = p.vendor_id
    WHERE p.status = 'Approved' AND NOT EXISTS (SELECT 1 FROM stock_receipts r WHERE r.po_id = p.id AND r.status <> 'Rejected') ORDER BY p.created_at DESC LIMIT 60`).catch(() => [[]]);
  res.json({ items: rows.map(p => ({ id: p.id, vendorId: p.vendor_id, vendor: p.vendor, total: p.grand_total, deliverBy: p.deliver_by })) });
}));

router.get('/open-orders/:id', guard(VIEW), wrap(async (req, res) => {
  const [lines] = await pool.query('SELECT i.product_id, i.name, i.qty, i.unit_price FROM field_purchase_order_items i WHERE i.po_id = ? AND i.product_id IS NOT NULL ORDER BY i.id', [req.params.id]);
  res.json({ lines: lines.map(l => ({ productId: l.product_id, name: l.name, qty: l.qty, unitCost: l.unit_price })) });
}));

/** Step 1: record a purchase; it starts as Pending until someone approves it. */
router.post('/receipts', guard(MANAGE), wrap(async (req, res) => {
  const b = req.body, by = req.staff.name;
  const out = await tx(async conn => {
    const v = await vendorOf(conn, b.vendorId);
    const lines = await cleanLines(conn, b.lines);
    const poId = text(b.poId, 20) || null;
    if (poId) {
      const [[dup]] = await conn.query("SELECT id FROM stock_receipts WHERE po_id = ? AND status <> 'Rejected' LIMIT 1", [poId]);
      if (dup) throw fail(409, `${poId} was already received as ${dup.id}`);
    }
    const id = await nextSeq('stock_grn', 'stock_receipts', 'GRN-', 1000);
    const total = sum(lines);
    const buyDate = iso(b.date, today());
    const invoiceNo = await nextInvoiceNo(buyDate.slice(2, 4));
    await conn.query("INSERT INTO stock_receipts (id, vendor_id, po_id, invoice_no, reference_no, received_on, note, total, staff_name, status) VALUES (?,?,?,?,?,?,?,?,?,'Pending')", [id, v.id, poId, invoiceNo, text(b.referenceNo, 60), buyDate, text(b.note, 300), total, by]);
    for (const l of lines) await conn.query('INSERT INTO stock_receipt_items (receipt_id, product_id, name, qty, unit_cost, discount) VALUES (?,?,?,?,?,?)', [id, l.productId, l.name, l.qty, l.unitCost, l.discount]);
    return { id, total, status: 'Pending', invoiceNo };
  });
  res.json(out);
}));

export default router;
