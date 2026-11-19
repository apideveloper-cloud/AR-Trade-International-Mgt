// Expense claims (with private voucher photos): submit, list, approve / reject.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { pool, guard, wrap, fail, notify, staffIdsByRole, clientRefOf, isApprover, UTC } from '../common.js';
import { parseExpense, parseVoucher } from './rules.js';

const router = Router();
const VOUCHERS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads/vouchers'); // server/uploads/vouchers
fs.mkdirSync(VOUCHERS, { recursive: true });

const expenseOut = e => ({
  id: String(e.id), employeeName: e.name, title: e.title, category: e.category, amount: Number(e.amount),
  date: e.created_utc, voucher: e.voucher ? `/api/field/vouchers/${e.voucher}` : null, status: e.status.toLowerCase(), remarks: e.remarks || ''
});
const EXPENSE_SELECT = `SELECT e.*, ${UTC('CONVERT_TZ(e.created_at, @@session.time_zone, "+00:00")')} created_utc, s.name FROM field_expenses e JOIN staff s ON s.id = e.staff_id`;
const tk = n => '৳ ' + Number(n).toLocaleString('en-IN');

router.post('/expenses', guard(), wrap(async (req, res) => {
  const { title, category, amount } = parseExpense(req.body);
  const ref = clientRefOf(req.body);
  if (ref) { // retry of a claim this person already submitted: return it again
    const [[dup]] = await pool.query(`${EXPENSE_SELECT} WHERE e.staff_id = ? AND e.client_ref = ? LIMIT 1`, [req.staff.id, ref]);
    if (dup) return res.json(expenseOut(dup));
  }
  let file = null;
  if (req.body.voucher) {
    const { buf, ext } = parseVoucher(req.body.voucher);
    file = crypto.randomBytes(8).toString('hex') + ext;
    fs.writeFileSync(path.join(VOUCHERS, file), buf);
  }
  let r;
  try { [r] = await pool.query('INSERT INTO field_expenses (staff_id,title,category,amount,voucher,client_ref) VALUES (?,?,?,?,?,?)', [req.staff.id, title, category, amount, file, ref]); }
  catch (e) { if (file) fs.rm(path.join(VOUCHERS, file), { force: true }, () => {}); throw e; } // no orphan image when the claim was not saved
  const [[e]] = await pool.query(`${EXPENSE_SELECT} WHERE e.id = ?`, [r.insertId]);
  staffIdsByRole('manager', 'accountant', 'admin').then(ids => notify(ids.filter(i => i !== req.staff.id), {
    icon: 'receipt_long', cat: 'Approvals', title: 'Expense waiting for approval', sub: `${req.staff.name} · ${title} · ${tk(amount)}`,
    body: `${req.staff.name} submitted an expense claim for approval.`, rows: [['Amount', tk(amount)], ['Category', category], ['Voucher', file ? 'Attached' : 'None']] }));
  res.json(expenseOut(e));
}));

// mine by default; approvers can pass ?scope=pending to review everyone's pending claims
router.get('/expenses', guard(), wrap(async (req, res) => {
  const all = req.query.scope === 'pending';
  if (all && !isApprover(req.staff)) throw fail(403, 'Your role cannot do this');
  const [rows] = await pool.query(`${EXPENSE_SELECT} WHERE ${all ? 'e.status = "Pending"' : 'e.staff_id = ?'} ORDER BY e.id DESC LIMIT 200`, all ? [] : [req.staff.id]);
  res.json(rows.map(expenseOut));
}));

router.put('/expenses/:id/decision', guard('field.approve'), wrap(async (req, res) => {
  const status = { approved: 'Approved', rejected: 'Rejected' }[req.body.status];
  if (!status) throw fail(400, 'Status must be approved or rejected');
  const remarks = String(req.body.remarks || '').trim().slice(0, 255);
  if (status === 'Rejected' && !remarks) throw fail(400, 'Please write a reason for rejecting');
  const [[e]] = await pool.query('SELECT * FROM field_expenses WHERE id = ?', [req.params.id]);
  if (!e) throw fail(404, 'Expense not found');
  if (e.staff_id === req.staff.id) throw fail(403, 'You cannot approve your own expense');
  if (e.status !== 'Pending') throw fail(409, 'This expense was already decided');
  const [dec] = await pool.query("UPDATE field_expenses SET status = ?, decided_by = ?, decided_at = UTC_TIMESTAMP(), remarks = ? WHERE id = ? AND status = 'Pending'", [status, req.staff.id, remarks, e.id]);
  if (!dec.affectedRows) throw fail(409, 'This expense was already decided');
  await notify(e.staff_id, {
    icon: status === 'Approved' ? 'fact_check' : 'cancel', cat: 'Approvals',
    title: status === 'Approved' ? 'Expense approved' : 'Expense rejected', sub: `${e.title} ${tk(e.amount)} ${status.toLowerCase()} by ${req.staff.name}`,
    body: `Your expense claim "${e.title}" was ${status.toLowerCase()}.` + (remarks ? ` Remarks: ${remarks}` : ''),
    rows: [['Amount', tk(e.amount)], ['Category', e.category], [status === 'Approved' ? 'Approved by' : 'Rejected by', req.staff.name], ['Remarks', remarks || '—']]
  });
  res.json({ ok: true });
}));

// voucher images are private: owner or an approver only
router.get('/vouchers/:file', guard(), wrap(async (req, res) => {
  const file = path.basename(req.params.file);
  const [[e]] = await pool.query('SELECT staff_id FROM field_expenses WHERE voucher = ?', [file]);
  if (!e) throw fail(404, 'Not found');
  if (e.staff_id !== req.staff.id && !isApprover(req.staff)) throw fail(403, 'Your role cannot do this');
  res.sendFile(path.join(VOUCHERS, file));
}));

export default router;
