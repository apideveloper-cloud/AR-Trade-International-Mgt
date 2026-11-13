// Leave for the field app.
//   GET  /api/field/leave                 my balances + my requests
//   POST /api/field/leave                 apply { type, from, to, reason }
//   PUT  /api/field/leave/:id/cancel      cancel my own open request
//   GET  /api/field/leave/pending         (manager / admin) everyone else's requests, open first
//   PUT  /api/field/leave/:id/decision    (manager / admin) { status: 'approved'|'rejected', remarks } - remarks required to reject
// Approved leave shows up as 'leave' days in GET /api/field/week.
import { Router } from 'express';
import { pool, fail, wrap, guard, guardRole, roleKey, notify, staffIdsByRole, UTC_TS, todayBD } from '../common.js';
import { iso } from '../../util.js';

const router = Router();
const TYPES = ['Casual', 'Sick', 'Annual', 'Unpaid'];
const ENTITLEMENT = { Casual: 10, Sick: 14, Annual: 20 }; // days per year
const DAY = 864e5;

const isoDate = s => iso(s, null);
/** Days between two YYYY-MM-DD dates (inclusive), Fridays (weekly off) not counted. */
function countDays(from, to) {
  let n = 0;
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += DAY) if (new Date(t).getUTCDay() !== 5) n++;
  return n;
}
const niceDate = d => { const dt = new Date(d + 'T00:00:00Z'); return `${dt.getUTCDate()} ${dt.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`; };
const span = (f, t) => (f === t ? niceDate(f) : `${niceDate(f)} – ${niceDate(t)}`);

const SELECT = `SELECT l.id, l.staff_id, s.name, s.role, l.type, DATE_FORMAT(l.from_date,'%Y-%m-%d') from_date, DATE_FORMAT(l.to_date,'%Y-%m-%d') to_date,
  l.days, l.reason, l.status, l.remarks, d.name decided_by_name, ${UTC_TS('l.created_at')} created_at, DATE_FORMAT(l.decided_at,'%Y-%m-%dT%H:%i:%sZ') decided_at
  FROM field_leave_requests l JOIN staff s ON s.id = l.staff_id LEFT JOIN staff d ON d.id = l.decided_by`;

const out = r => ({
  id: r.id, staffId: r.staff_id, name: r.name, role: roleKey(r.role), type: r.type, from: r.from_date, to: r.to_date, days: r.days,
  dates: span(r.from_date, r.to_date), reason: r.reason, status: r.status.toLowerCase(), remarks: r.remarks || '',
  decidedBy: r.decided_by_name || '', decidedAt: r.decided_at, createdAt: r.created_at
});

async function balances(staffId) {
  const year = todayBD().slice(0, 4);
  const [rows] = await pool.query(
    "SELECT type, SUM(days) used FROM field_leave_requests WHERE staff_id = ? AND status = 'Approved' AND from_date >= ? AND from_date < ? GROUP BY type", [staffId, `${year}-01-01`, `${Number(year) + 1}-01-01`]);
  const used = Object.fromEntries(rows.map(r => [r.type, Number(r.used)]));
  return Object.entries(ENTITLEMENT).map(([type, total]) => ({ type, total, used: used[type] || 0, left: Math.max(0, total - (used[type] || 0)) }));
}

router.get('/', guard(), wrap(async (req, res) => {
  const [rows] = await pool.query(`${SELECT} WHERE l.staff_id = ? ORDER BY l.id DESC LIMIT 50`, [req.staff.id]);
  res.json({ balances: await balances(req.staff.id), requests: rows.map(out), canApprove: ['manager', 'admin'].includes(roleKey(req.staff.role)) });
}));

router.post('/', guard(), wrap(async (req, res) => {
  const type = TYPES.includes(req.body.type) ? req.body.type : null;
  const from = isoDate(req.body.from), to = isoDate(req.body.to);
  const reason = String(req.body.reason || '').trim().slice(0, 500);
  if (!type) throw fail(400, 'Choose a leave type');
  if (!from || !to) throw fail(400, 'Choose the from and to dates');
  if (to < from) throw fail(400, 'The end date is before the start date');
  if (reason.length < 3) throw fail(400, 'Write a short reason for the leave');
  const days = countDays(from, to);
  if (days < 1) throw fail(400, 'Those dates are only the weekly holiday (Friday)');
  const [[clash]] = await pool.query(
    "SELECT COUNT(*) n FROM field_leave_requests WHERE staff_id = ? AND status IN ('Open','Approved') AND from_date <= ? AND to_date >= ?", [req.staff.id, to, from]);
  if (clash.n) throw fail(409, 'You already have a leave request on those dates');
  if (type !== 'Unpaid') {
    const left = (await balances(req.staff.id)).find(b => b.type === type).left;
    if (days > left) throw fail(400, `Only ${left} ${type.toLowerCase()} leave day(s) left this year`);
  }
  const [r] = await pool.query('INSERT INTO field_leave_requests (staff_id,type,from_date,to_date,days,reason) VALUES (?,?,?,?,?,?)', [req.staff.id, type, from, to, days, reason]);
  staffIdsByRole('manager', 'admin').then(ids => notify(ids.filter(i => i !== req.staff.id), {
    icon: 'event_available', cat: 'Approvals', title: 'Leave request waiting', sub: `${req.staff.name} · ${type} · ${span(from, to)}`,
    body: `${req.staff.name} applied for ${days} day(s) of ${type.toLowerCase()} leave. Reason: ${reason}`,
    rows: [['Type', `${type} leave`], ['Dates', `${span(from, to)} · ${days} day${days > 1 ? 's' : ''}`], ['Applicant', req.staff.name]], a1: 'Review request', a1Icon: 'pending_actions' }));
  const [[row]] = await pool.query(`${SELECT} WHERE l.id = ?`, [r.insertId]);
  res.json(out(row));
}));

router.put('/:id/cancel', guard(), wrap(async (req, res) => {
  const [r] = await pool.query("UPDATE field_leave_requests SET status = 'Cancelled' WHERE id = ? AND staff_id = ? AND status = 'Open'", [req.params.id, req.staff.id]);
  if (!r.affectedRows) throw fail(404, 'No open request to cancel');
  res.json({ ok: true });
}));

router.get('/pending', guardRole('manager'), wrap(async (req, res) => {
  const [rows] = await pool.query(
    `${SELECT} WHERE l.staff_id <> ? ORDER BY (l.status = 'Open') DESC, l.id DESC LIMIT 100`, [req.staff.id]);
  const items = rows.map(out);
  res.json({ pending: items.filter(i => i.status === 'open').length, items });
}));

router.put('/:id/decision', guardRole('manager'), wrap(async (req, res) => {
  const status = { approved: 'Approved', rejected: 'Rejected' }[req.body.status];
  if (!status) throw fail(400, 'Status must be approved or rejected');
  const remarks = String(req.body.remarks || '').trim().slice(0, 255);
  if (status === 'Rejected' && !remarks) throw fail(400, 'Please write a reason for rejecting');
  const [[l]] = await pool.query(`${SELECT} WHERE l.id = ?`, [req.params.id]);
  if (!l) throw fail(404, 'Leave request not found');
  if (l.staff_id === req.staff.id) throw fail(403, 'You cannot decide your own leave');
  if (l.status !== 'Open') throw fail(409, 'This request was already decided');
  const [u] = await pool.query("UPDATE field_leave_requests SET status = ?, remarks = ?, decided_by = ?, decided_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'Open'", [status, remarks, req.staff.id, l.id]);
  if (!u.affectedRows) throw fail(409, 'This request was already decided');
  const ok = status === 'Approved';
  await notify(l.staff_id, {
    icon: ok ? 'event_available' : 'event_busy', cat: 'Approvals', title: ok ? 'Leave approved' : 'Leave rejected',
    sub: `${l.type} leave · ${span(l.from_date, l.to_date)} ${ok ? 'approved' : 'rejected'} by ${req.staff.name}`,
    body: `Your ${l.type.toLowerCase()} leave request was ${status.toLowerCase()}.` + (remarks ? ` Remarks: ${remarks}` : ''),
    rows: [['Type', `${l.type} leave`], ['Dates', `${span(l.from_date, l.to_date)} · ${l.days} day(s)`], [ok ? 'Approved by' : 'Rejected by', req.staff.name], ['Remarks', remarks || '—']]
  });
  res.json({ ok: true });
}));

export default router;
