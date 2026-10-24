// RM visit schedule and visit report.
//   GET  /api/field/visits?date=YYYY-MM-DD[&staff_id=]  -> { date, today, visits, total, done, week:[{date,dn,dt,count,off}] }
//   POST /api/field/visits              { customerId, date, time, purpose }
//   GET  /api/field/visits/:id
//   POST /api/field/visits/:id/checkin  { lat, lng }
//   POST /api/field/visits/:id/save     { purpose?, outcome, orderValue, notes, followupAction, followupWhen }
import { Router } from 'express';
import { pool, guard, guardRole, wrap, fail, roleKey, coord } from '../common.js';
import { bdDate, bdToDate, utcSql, addDays, dateOk, timeOk, VISIT_SQL, visitOut, loadVisit } from '../crm_util.js';

const router = Router();
const PURPOSES = ['Delivery', 'Sales pitch', 'Collection', 'Demo', 'Support', 'Follow-up', 'Sampling'];
const OUTCOMES = ['Order taken', 'Quotation', 'Interested', 'Not interested'];
const ACTIONS = ['Call', 'Visit', 'Send quote', 'Collect'];
const WHENS = { Today: [0, '17:00'], Tomorrow: [1, '11:00'], 'In 3 days': [3, '11:00'], 'Next week': [7, '11:00'] };
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isBoss = s => ['manager', 'admin'].includes(roleKey(s.role));

/** staff whose visits are being looked at: yourself, or anyone for manager / admin. */
function whose(req) {
  const sid = parseInt(req.query.staff_id, 10);
  if (sid && sid !== req.staff.id) { if (!isBoss(req.staff)) throw fail(403, 'Your role cannot do this'); return sid; }
  return req.staff.id;
}
function mine(req, v) { if (v.staff_id !== req.staff.id && !isBoss(req.staff)) throw fail(403, 'This is not your visit'); }

router.get('/', guard(), wrap(async (req, res) => {
  const date = dateOk(req.query.date) ? req.query.date : bdDate();
  const sid = whose(req);
  const [rows] = await pool.query(VISIT_SQL + ' WHERE v.staff_id = ? AND v.visit_date = ? ORDER BY v.visit_time, v.id', [sid, date]);
  // week strip: Saturday .. Friday around the chosen date
  const dow = new Date(date + 'T00:00:00Z').getUTCDay(); // 0 = Sun
  const start = addDays(date, -((dow + 1) % 7));
  const [cnt] = await pool.query("SELECT DATE_FORMAT(visit_date,'%Y-%m-%d') d, COUNT(*) n FROM field_visits WHERE staff_id = ? AND visit_date BETWEEN ? AND ? GROUP BY visit_date", [sid, start, addDays(start, 6)]);
  const byDay = new Map(cnt.map(r => [r.d, Number(r.n)]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const wd = new Date(d + 'T00:00:00Z').getUTCDay();
    return { date: d, dn: DN[wd], dt: Number(d.slice(8)), count: byDay.get(d) || 0, off: wd === 5 };
  });
  const visits = rows.map(visitOut);
  res.json({ date, today: bdDate(), visits, total: visits.length, done: visits.filter(v => v.status === 'Done').length, week });
}));

router.post('/', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const { customerId, date, time } = req.body;
  const purpose = String(req.body.purpose || '').trim().slice(0, 60);
  if (!dateOk(date) || !timeOk(time) || !purpose) throw fail(400, 'Choose a customer, date, time and purpose');
  const [[c]] = await pool.query('SELECT id FROM field_customers WHERE id = ?', [customerId]);
  if (!c) throw fail(404, 'Customer not found');
  const [r] = await pool.query('INSERT INTO field_visits (customer_id, staff_id, visit_date, visit_time, purpose) VALUES (?,?,?,?,?)', [c.id, req.staff.id, date, time + ':00', purpose]);
  res.json(visitOut(await loadVisit(r.insertId)));
}));

router.get('/:id', guard(), wrap(async (req, res) => {
  const v = await loadVisit(req.params.id);
  mine(req, v);
  res.json(visitOut(v));
}));

router.post('/:id/checkin', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const v = await loadVisit(req.params.id);
  mine(req, v);
  if (v.status === 'Done') throw fail(409, 'This visit is already completed');
  const lat = req.body.lat == null ? null : coord(req.body.lat, 90), lng = req.body.lng == null ? null : coord(req.body.lng, 180);
  if (v.status === 'Planned') await pool.query("UPDATE field_visits SET status = 'InProgress', check_in = UTC_TIMESTAMP(), lat = ?, lng = ? WHERE id = ?", [lat, lng, v.id]);
  res.json(visitOut(await loadVisit(v.id)));
}));

router.post('/:id/save', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const v = await loadVisit(req.params.id);
  mine(req, v);
  if (v.status === 'Done') throw fail(409, 'This visit is already completed');
  if (v.status !== 'InProgress') throw fail(409, 'Check in at the client first');
  const outcome = OUTCOMES.includes(req.body.outcome) ? req.body.outcome : OUTCOMES[0];
  const purpose = PURPOSES.includes(req.body.purpose) ? req.body.purpose : v.purpose;
  const value = Math.max(0, Math.min(1e9, Math.round(Number(req.body.orderValue) || 0)));
  const notes = String(req.body.notes || '').trim().slice(0, 2000) || 'Visit completed.';
  const action = ACTIONS.includes(req.body.followupAction) ? req.body.followupAction : ACTIONS[0];
  const when = WHENS[req.body.followupWhen] ? req.body.followupWhen : 'Tomorrow';
  await pool.query(
    "UPDATE field_visits SET status = 'Done', check_out = UTC_TIMESTAMP(), purpose = ?, outcome = ?, order_value = ?, notes = ?, followup_action = ?, followup_when = ? WHERE id = ?",
    [purpose, outcome, value, notes, action, when, v.id]);
  // follow-up created from the visit
  const [days, at] = WHENS[when];
  const due = bdToDate(addDays(bdDate(), days), at);
  await pool.query('INSERT INTO field_followups (customer_id, visit_id, staff_id, title, note, action, due_at, history_json) VALUES (?,?,?,?,?,?,?,?)',
    [v.customer_id, v.id, v.staff_id, `${action} · ${outcome.toLowerCase()}`, notes, action, utcSql(due), JSON.stringify([])]);
  // an order from an upcoming customer makes them active
  if (outcome === 'Order taken' || value > 0) await pool.query("UPDATE field_customers SET kind = 'Active', next_step = '' WHERE id = ? AND kind <> 'Active'", [v.customer_id]);
  res.json(visitOut(await loadVisit(v.id)));
}));

export default router;
