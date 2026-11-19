// Vendor payments: list, record (optionally against one purchase) and undo within 24 hours.
import { Router } from 'express';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { D, fail, int, iso, nextSeq, text, today, tx, wrap } from '../util.js';
import { addAmount, addRange, addSearch, whereOf } from '../listing.js';
import { VIEW, MANAGE, METHODS } from './constants.js';
import { addVendorFilter, pagingFor, vendorOf } from './helpers.js';
import { billedOf } from './pure.js';

const router = Router();

/** Inserts one vendor payment row inside the caller's transaction. */
async function addPayment(conn, { vendorId, receiptId = null, amount, method, reference, date, note, by }) {
  const id = await nextSeq('stock_vpy', 'vendor_payments', 'VPY-', 1000);
  await conn.query('INSERT INTO vendor_payments (id, vendor_id, receipt_id, amount, method, reference, paid_on, note, staff_name) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, vendorId, receiptId, amount, METHODS.includes(method) ? method : 'Cash', text(reference, 80), iso(date, today()), text(note, 300), by]);
  return { id, amount };
}

router.get('/payments', guard(VIEW), wrap(async (req, res) => {
  const cond = [], args = [];
  addSearch(cond, args, ['p.id', 'v.name', 'p.reference', 'p.receipt_id', 'p.note'], req.query.q);
  addVendorFilter(cond, args, 'p.vendor_id', req);
  if (METHODS.includes(req.query.method)) { cond.push('p.method = ?'); args.push(req.query.method); }
  addRange(cond, args, 'p.paid_on', req);
  addAmount(cond, args, 'p.amount', req);
  const from = `FROM vendor_payments p JOIN field_vendors v ON v.id = p.vendor_id ${whereOf(cond)}`;
  const { paged, size, offset } = pagingFor(req, 300);
  const [rows] = await pool.query(`SELECT p.id, p.vendor_id, v.name vendor, p.receipt_id, p.amount, p.method, p.reference, ${D('p.paid_on')} d, p.note, p.staff_name ${from} ORDER BY p.paid_on DESC, p.created_at DESC LIMIT ${size} OFFSET ${offset}`, args);
  const items = rows.map(p => ({ id: p.id, vendorId: p.vendor_id, vendor: p.vendor, receiptId: p.receipt_id, amount: p.amount, method: p.method, reference: p.reference, date: p.d, note: p.note, by: p.staff_name }));
  if (!paged) return res.json({ methods: METHODS, items });
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(p.amount), 0) amount ${from}`, args);
  res.json({ methods: METHODS, total: Number(t.n), rows: items, items, totals: { amount: Number(t.amount) } });
}));

router.post('/payments', guard(MANAGE), wrap(async (req, res) => {
  const b = req.body;
  const amount = int(b.amount);
  if (amount <= 0) throw fail(400, 'Enter the amount paid');
  const out = await tx(async conn => {
    const v = await vendorOf(conn, b.vendorId);
    const receiptId = text(b.receiptId, 20) || null;
    if (receiptId) {
      const [[r]] = await conn.query('SELECT id, total, vendor_id, status, (SELECT COALESCE(SUM(amount), 0) FROM vendor_payments p WHERE p.receipt_id = stock_receipts.id) paid FROM stock_receipts WHERE id = ? FOR UPDATE', [receiptId]); // locked: two payments at once cannot both fit in the same balance
      if (!r || r.vendor_id !== v.id) throw fail(400, 'That purchase does not belong to this vendor');
      if (!billedOf(r.status)) throw fail(409, `${r.id} is not approved yet, so it cannot be paid`);
      if (amount > r.total - Number(r.paid)) throw fail(409, `Only ৳ ${(r.total - Number(r.paid)).toLocaleString('en-US')} is still due on ${r.id}`);
    }
    return addPayment(conn, { vendorId: v.id, receiptId, amount, method: b.method, reference: b.reference, date: b.date, note: b.note, by: req.staff.name });
  });
  res.json(out);
}));

router.delete('/payments/:id', guard(MANAGE), wrap(async (req, res) => {
  const [r] = await pool.query('DELETE FROM vendor_payments WHERE id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)', [req.params.id]);
  if (!r.affectedRows) throw fail(409, 'This payment cannot be removed: it does not exist, or it was recorded more than 24 hours ago.');
  res.json({ ok: true });
}));

export default router;
