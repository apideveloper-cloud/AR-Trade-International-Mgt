// Vendor money history: the combined transactions list and one vendor's running-balance statement.
import { Router } from 'express';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { D, fail, wrap } from '../util.js';
import { addAmount, addRange, addSearch, pageOf, whereOf } from '../listing.js';
import { VIEW, BILLED } from './constants.js';
import { fillVendorCodes } from './numbering.js';
import { addVendorFilter } from './helpers.js';
import { vOut } from './pure.js';

const router = Router();

/** All vendor transactions in one list: bills (approved purchases), returns to vendors and payments, newest first. */
router.get('/transactions', guard(VIEW), wrap(async (req, res) => {
  const union = `SELECT 'Bill' type, r.id ref, r.vendor_id, r.received_on d, r.total credit, 0 debit, CONCAT_WS(' · ', NULLIF(r.invoice_no, ''), NULLIF(r.note, '')) info, r.created_at at FROM stock_receipts r WHERE r.${BILLED}
    UNION ALL SELECT 'Return', t.id, t.vendor_id, t.returned_on, 0, t.total, t.reason, t.created_at FROM vendor_returns t
    UNION ALL SELECT 'Payment', p.id, p.vendor_id, p.paid_on, 0, p.amount, CONCAT_WS(' · ', p.method, NULLIF(p.reference, ''), NULLIF(p.receipt_id, '')), p.created_at FROM vendor_payments p`;
  const cond = [], args = [];
  addVendorFilter(cond, args, 'x.vendor_id', req);
  if (['Bill', 'Return', 'Payment'].includes(req.query.type)) { cond.push('x.type = ?'); args.push(req.query.type); }
  addSearch(cond, args, ['x.ref', 'v.name', 'x.info'], req.query.q);
  addRange(cond, args, 'x.d', req);
  addAmount(cond, args, 'GREATEST(x.credit, x.debit)', req);
  const from = `FROM (${union}) x JOIN field_vendors v ON v.id = x.vendor_id ${whereOf(cond)}`;
  const { size, offset } = pageOf(req);
  const [[rows], [[t]]] = await Promise.all([pool.query(`SELECT x.type, x.ref, x.vendor_id, v.name vendor, ${D('x.d')} d, x.credit, x.debit, x.info, x.at ${from} ORDER BY x.d DESC, x.at DESC LIMIT ${size} OFFSET ${offset}`, args), pool.query(`SELECT COUNT(*) n, COALESCE(SUM(x.credit), 0) bills, COALESCE(SUM(IF(x.type = 'Return', x.debit, 0)), 0) returns, COALESCE(SUM(IF(x.type = 'Payment', x.debit, 0)), 0) paid ${from}`, args)]);
  res.json({ total: Number(t.n), rows: rows.map(r => ({ type: r.type, ref: r.ref, vendorId: r.vendor_id, vendor: r.vendor, date: r.d, bill: Number(r.credit), settled: Number(r.debit), info: r.info || '' })), totals: { bills: Number(t.bills), returns: Number(t.returns), paid: Number(t.paid) } });
}));

/** Statement: opening balance, then bills, returns and payments in date order with a running balance. */
router.get('/vendors/:id/ledger', guard(VIEW), wrap(async (req, res) => {
  await fillVendorCodes();
  const id = parseInt(req.params.id, 10);
  const [[v]] = await pool.query('SELECT * FROM field_vendors WHERE id = ?', [id]);
  if (!v) throw fail(404, 'Vendor not found');
  const [[bills], [rets], [pays]] = await Promise.all([pool.query(`SELECT id, ${D('received_on')} d, invoice_no, total, created_at FROM stock_receipts WHERE vendor_id = ? AND ${BILLED}`, [id]), pool.query(`SELECT id, ${D('returned_on')} d, reason, total, created_at FROM vendor_returns WHERE vendor_id = ?`, [id]), pool.query(`SELECT id, ${D('paid_on')} d, method, reference, receipt_id, amount, created_at FROM vendor_payments WHERE vendor_id = ?`, [id])]);
  const rows = [
    ...bills.map(b => ({ at: b.created_at, d: b.d, ref: b.id, type: 'Bill', text: b.invoice_no ? 'Invoice ' + b.invoice_no : 'Goods received', debit: 0, credit: b.total })),
    ...rets.map(b => ({ at: b.created_at, d: b.d, ref: b.id, type: 'Return', text: b.reason || 'Goods returned', debit: b.total, credit: 0 })),
    ...pays.map(b => ({ at: b.created_at, d: b.d, ref: b.id, type: 'Payment', text: [b.method, b.reference, b.receipt_id && 'for ' + b.receipt_id].filter(Boolean).join(' · '), debit: b.amount, credit: 0 }))
  ].sort((a, b) => (a.d === b.d ? new Date(a.at) - new Date(b.at) : a.d < b.d ? -1 : 1));
  let bal = v.opening;
  res.json({ vendor: vOut({ ...v, bills: 0, returns: 0, paid: 0, balance: 0 }), opening: v.opening, items: rows.map(r => ({ ...r, balance: (bal += r.credit - r.debit) })), balance: bal });
}));

export default router;
