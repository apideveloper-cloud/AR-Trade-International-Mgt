// Unified approvals for the field app. The decisions themselves stay where they were built:
//   expenses      PUT /api/field/expenses/:id/decision   { status, remarks }
//   leave         PUT /api/field/leave/:id/decision      { status, remarks }
//   sales orders  PUT /api/field/orders/:id/approve      { status, remarks }
//   purchase      PUT /api/field/approvals/purchase/:id/decision   { status, remarks }   (below)
// and this file adds what the one Approvals screen needs:
//   GET /api/field/approvals/summary     which kinds the caller approves + pending counts
//   GET /api/field/approvals/expenses    pending claims first, then recently decided ones (with remarks)
//   GET /api/field/approvals/purchase    POs waiting for the caller's step first, then recently decided ones
// Purchase orders: Manager approves Submitted -> ManagerApproved, Accountant approves ManagerApproved -> Approved,
// Admin can act on either step. Rejecting needs a reason and sends the PO back to its owner.
import { Router } from 'express';
import { pool, fail, wrap, guard, roleKey, isApprover, notify, staffIdsByRole, UTC_TS } from '../common.js';
import { PO_SELECT, poOut, BUDGET } from './purchase.js';
import { sendMail, mailReady } from '../../mailer.js';

const router = Router();

/** Which approval kinds a role sees, in tab order. */
const KINDS = {
  manager: ['expenses', 'leave', 'purchase', 'orders'],
  accountant: ['expenses', 'purchase'],
  admin: ['expenses', 'leave', 'purchase', 'orders']
};
const kindsFor = staff => (isApprover(staff) || roleKey(staff.role) === 'manager' ? (KINDS[roleKey(staff.role)] || ['expenses']) : []);

/** PO status this role may decide: manager/admin step 1, accountant/admin step 2. */
const waitingFor = role => (role === 'manager' ? ['Submitted'] : role === 'accountant' ? ['ManagerApproved'] : role === 'admin' ? ['Submitted', 'ManagerApproved'] : []);

router.get('/summary', guard(), wrap(async (req, res) => {
  const role = roleKey(req.staff.role);
  const kinds = kindsFor(req.staff);
  const counts = { expenses: 0, leave: 0, purchase: 0, orders: 0 };
  if (kinds.includes('expenses')) {
    const [[r]] = await pool.query("SELECT COUNT(*) n FROM field_expenses WHERE status = 'Pending' AND staff_id <> ?", [req.staff.id]);
    counts.expenses = r.n;
  }
  if (kinds.includes('leave')) {
    const [[r]] = await pool.query("SELECT COUNT(*) n FROM field_leave_requests WHERE status = 'Open' AND staff_id <> ?", [req.staff.id]);
    counts.leave = r.n;
  }
  if (kinds.includes('purchase')) {
    const st = waitingFor(role);
    if (st.length) {
      const [[r]] = await pool.query('SELECT COUNT(*) n FROM field_purchase_orders WHERE status IN (?) AND staff_id <> ?', [st, req.staff.id]);
      counts.purchase = r.n;
    }
  }
  if (kinds.includes('orders')) {
    const [[r]] = await pool.query("SELECT COUNT(*) n FROM field_sales_orders WHERE approval_status = 'Pending'");
    counts.orders = r.n;
  }
  res.json({ role, kinds, counts, waiting: Object.values(counts).reduce((a, b) => a + b, 0) });
}));

router.get('/expenses', guard(), wrap(async (req, res) => {
  if (!isApprover(req.staff)) throw fail(403, 'Your role cannot do this');
  const [rows] = await pool.query(
    `SELECT e.id, e.title, e.category, e.amount, e.voucher, e.status, e.remarks, s.name, d.name decided_by_name,
            ${UTC_TS('e.created_at')} created_at, DATE_FORMAT(e.decided_at, '%Y-%m-%dT%H:%i:%sZ') decided_at
     FROM field_expenses e JOIN staff s ON s.id = e.staff_id LEFT JOIN staff d ON d.id = e.decided_by
     WHERE e.staff_id <> ? AND (e.status = 'Pending' OR e.decided_at >= (UTC_TIMESTAMP() - INTERVAL 14 DAY))
     ORDER BY (e.status = 'Pending') DESC, COALESCE(e.decided_at, e.created_at) DESC LIMIT 80`, [req.staff.id]);
  res.json({
    items: rows.map(e => ({
      id: String(e.id), employeeName: e.name, title: e.title, category: e.category, amount: Number(e.amount), date: e.created_at,
      voucher: e.voucher ? `/api/field/vouchers/${e.voucher}` : null, status: e.status.toLowerCase(), remarks: e.remarks || '',
      decidedBy: e.decided_by_name || '', decidedAt: e.decided_at
    }))
  });
}));

router.get('/purchase', guard(), wrap(async (req, res) => {
  const role = roleKey(req.staff.role);
  const st = waitingFor(role);
  if (!st.length) throw fail(403, 'Your role cannot do this');
  const [rows] = await pool.query(
    `${PO_SELECT} WHERE p.staff_id <> ? AND (p.status IN (?) OR p.status IN ('ManagerApproved', 'Approved', 'Rejected') AND COALESCE(p.final_at, p.rejected_at, p.manager_at, p.created_at) >= (UTC_TIMESTAMP() - INTERVAL 14 DAY))
     ORDER BY (p.status IN (?)) DESC, COALESCE(p.final_at, p.rejected_at, p.manager_at, p.submitted_at, p.created_at) DESC LIMIT 60`, [req.staff.id, st, st]);
  const items = [];
  for (const p of rows) items.push({ ...(await poOut(p, true, req.staff)), mine: st.includes(p.status) });
  res.json({ items, budget: BUDGET });
}));

async function mailVendor(p, lines) {
  if (!mailReady() || !/^[^\s,;<>"()]+@[^\s,;<>"()]+\.[^\s,;<>"()]+$/.test(p.vendor_email || '')) return false;
  const text = `Purchase order ${p.id}${p.rev ? ' (rev ' + p.rev + ')' : ''} from AR Trade International\n\n` +
    lines.map(l => `${l.name} × ${l.qty} @ ৳ ${l.unit_price}`).join('\n') +
    `\n\nGrand total: ৳ ${p.grand_total}\nDeliver by: ${p.deliver_by_d || '-'} to ${p.deliver_to}\nPayment: ${p.payment_terms}`;
  try { await sendMail({ to: p.vendor_email, subject: `Purchase order ${p.id} — AR Trade International`, text }); return true; } catch { return false; }
}

router.put('/purchase/:id/decision', guard(), wrap(async (req, res) => {
  const role = roleKey(req.staff.role);
  const status = { approved: 'Approved', rejected: 'Rejected' }[req.body.status];
  if (!status) throw fail(400, 'Status must be approved or rejected');
  const remarks = String(req.body.remarks || '').trim().slice(0, 255);
  if (status === 'Rejected' && !remarks) throw fail(400, 'Please write a reason for rejecting');
  const [[p]] = await pool.query(`${PO_SELECT} WHERE p.id = ?`, [req.params.id]);
  if (!p) throw fail(404, 'Purchase order not found');
  if (p.staff_id === req.staff.id) throw fail(403, 'You cannot approve your own purchase order');
  if (!waitingFor(role).includes(p.status)) {
    throw fail(409, ['Submitted', 'ManagerApproved'].includes(p.status) ? 'This purchase order is waiting for a different approver' : 'This purchase order was already decided');
  }

  const money = '৳ ' + p.grand_total.toLocaleString('en-IN');
  const rows = [['PO', p.id], ['Vendor', p.vendor_name], ['Grand total', money], ['Remarks', remarks || '—']];
  if (status === 'Rejected') {
    const [u] = await pool.query("UPDATE field_purchase_orders SET status = 'Rejected', rejected_by = ?, reject_remarks = ?, rejected_at = UTC_TIMESTAMP() WHERE id = ? AND status = ?", [req.staff.id, remarks, p.id, p.status]);
    if (!u.affectedRows) throw fail(409, 'This purchase order was already decided');
    if (p.pr_id) await pool.query("UPDATE field_purchase_requests SET status = 'Open' WHERE id = ?", [p.pr_id]);
    await notify(p.staff_id, { icon: 'cancel', cat: 'Approvals', title: 'Purchase order rejected', sub: `${p.id} rejected by ${req.staff.name}`,
      body: `Purchase order ${p.id} was rejected. Remarks: ${remarks}`, rows: [...rows, ['Rejected by', req.staff.name]] });
    return res.json({ ok: true, status: 'rejected' });
  }

  if (p.status === 'Submitted') {
    // manager step: pass it to the accountants
    const [u] = await pool.query("UPDATE field_purchase_orders SET status = 'ManagerApproved', manager_by = ?, manager_remarks = ?, manager_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'Submitted'", [req.staff.id, remarks, p.id]);
    if (!u.affectedRows) throw fail(409, 'This purchase order was already decided');
    await notify(p.staff_id, { icon: 'fact_check', cat: 'Approvals', title: 'Purchase order approved by manager', sub: `${p.id} approved by ${req.staff.name}, waiting for Accounts`,
      body: `Purchase order ${p.id} passed the manager check and is now with Accounts.` + (remarks ? ` Remarks: ${remarks}` : ''), rows: [...rows, ['Approved by', req.staff.name]] });
    const acc = await staffIdsByRole('accountant');
    await notify(acc.filter(i => i !== req.staff.id), { icon: 'shopping_cart_checkout', cat: 'Approvals', title: 'Purchase order waiting for Accounts', sub: `${p.id} · ${p.vendor_name} · ${money}`,
      body: `Purchase order ${p.id} was approved by ${req.staff.name} and needs the final approval.`, rows, a1: 'Review', a1Icon: 'fact_check' });
    return res.json({ ok: true, status: 'manager_approved' });
  }

  // accounts step: final approval, vendor gets the order
  const [fin] = await pool.query("UPDATE field_purchase_orders SET status = 'Approved', final_by = ?, final_remarks = ?, final_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'ManagerApproved'", [req.staff.id, remarks, p.id]);
  if (!fin.affectedRows) throw fail(409, 'This purchase order was already decided');
  const [lines] = await pool.query('SELECT name, qty, unit_price FROM field_purchase_order_items WHERE po_id = ?', [p.id]);
  const mailed = await mailVendor(p, lines);
  if (mailed) await pool.query('UPDATE field_purchase_orders SET vendor_mailed = 1 WHERE id = ?', [p.id]);
  await notify(p.staff_id, { icon: 'verified', cat: 'Approvals', title: 'Purchase order approved', sub: `${p.id} fully approved by ${req.staff.name}`,
    body: `Purchase order ${p.id} is approved.` + (mailed ? ' The vendor was emailed.' : ' Send it to the vendor.') + (remarks ? ` Remarks: ${remarks}` : ''),
    rows: [...rows, ['Approved by', req.staff.name], ['Vendor mailed', mailed ? 'Yes' : 'No (email not configured)']] });
  res.json({ ok: true, status: 'approved', vendorMailed: mailed });
}));

export default router;
