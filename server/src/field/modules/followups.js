// RM follow-up tracker. Follow-ups are created when a visit is saved (see visits.js).
//   GET /api/field/followups?bucket=overdue|today|upcoming|all[&staff_id=]  -> { items, counts }
//        with ?page=&size= (and optional ?q=, ?status=Open|Done, ?from=&to= on the due date) the same JSON plus { rows (= items of the page), total (matching the bucket and filters), page, size };
//        counts always cover all of the person's follow-ups
//   PUT /api/field/followups/:id/done        { remarks }                      (remarks required)
//   PUT /api/field/followups/:id/reopen
//   PUT /api/field/followups/:id/reschedule  { dueAt (ISO), reason, remarks } (remarks required)
import { Router } from 'express';
import { pool, guard, guardRole, wrap, fail, roleKey, UTC, parseJson } from '../common.js';
import { bdDate, bdToDate, addDays, utcSql } from '../crm_util.js';
import { pageOf, addRange, addSearch, whereOf, wantsPage } from '../../listing.js';

const router = Router();
const isBoss = s => ['manager', 'admin'].includes(roleKey(s.role));

const SQL = `SELECT f.id, f.customer_id, f.visit_id, f.staff_id, f.title, f.note, f.action, ${UTC('f.due_at')} due_at, f.status, f.done_remarks,
  ${UTC('f.rescheduled_from')} moved_from, f.history_json, c.name customer, c.area, c.phone FROM field_followups f JOIN field_customers c ON c.id = f.customer_id`;

/** 0 overdue, 1 today, 2 upcoming (relative to today in Bangladesh time). */
function group(dueIso) {
  const due = new Date(dueIso);
  if (due < bdToDate(bdDate())) return 0;
  return due < bdToDate(addDays(bdDate(), 1)) ? 1 : 2;
}

const out = f => ({
  id: f.id, customerId: f.customer_id, customer: f.customer, area: f.area, phone: f.phone, visitId: f.visit_id, title: f.title, note: f.note || '',
  action: f.action, dueAt: f.due_at, movedFrom: f.moved_from, status: f.status, doneRemarks: f.done_remarks, group: group(f.due_at),
  history: parseJson(f.history_json) || []
});

async function load(id) {
  const [[f]] = await pool.query(SQL + ' WHERE f.id = ?', [id]);
  if (!f) throw fail(404, 'Follow-up not found');
  return f;
}
const canEdit = (req, f) => { if (f.staff_id !== req.staff.id && !isBoss(req.staff)) throw fail(403, 'This is not your follow-up'); };

router.get('/', guard(), wrap(async (req, res) => {
  let sid = req.staff.id;
  const q = parseInt(req.query.staff_id, 10);
  if (q && q !== sid) { if (!isBoss(req.staff)) throw fail(403, 'Your role cannot do this'); sid = q; }
  if (wantsPage(req)) { // paged: bucket, search and period are applied in the database (still only this person's follow-ups)
    const { size, page, offset } = pageOf(req);
    const t0 = utcSql(bdToDate(bdDate())), t1 = utcSql(bdToDate(addDays(bdDate(), 1)));
    const [[k]] = await pool.query(
      `SELECT COALESCE(SUM(status = 'Open' AND due_at < ?), 0) overdue, COALESCE(SUM(status = 'Open' AND due_at >= ? AND due_at < ?), 0) today,
              COALESCE(SUM(status = 'Open' AND due_at >= ?), 0) upcoming, COALESCE(SUM(status = 'Open'), 0) open FROM field_followups WHERE staff_id = ?`, [t0, t0, t1, t1, sid]);
    const cond = ['f.staff_id = ?'], args = [sid];
    const bk = String(req.query.bucket || 'all');
    if (bk === 'overdue') { cond.push('f.due_at < ?'); args.push(t0); } else if (bk === 'today') { cond.push('f.due_at >= ? AND f.due_at < ?'); args.push(t0, t1); } else if (bk === 'upcoming') { cond.push('f.due_at >= ?'); args.push(t1); }
    const st = ['Open', 'Done'].find(x => x.toLowerCase() === String(req.query.status || '').toLowerCase());
    if (st) { cond.push('f.status = ?'); args.push(st); }
    addRange(cond, args, 'f.due_at', req);
    addSearch(cond, args, ['c.name', 'c.area', 'f.title', 'f.note', 'f.action'], req.query.q);
    const w = whereOf(cond);
    const [[m]] = await pool.query(`SELECT COUNT(*) n FROM field_followups f JOIN field_customers c ON c.id = f.customer_id ${w}`, args);
    const [list] = await pool.query(`${SQL} ${w} ORDER BY f.due_at, f.id LIMIT ? OFFSET ?`, [...args, size, offset]);
    const items = list.map(out);
    return res.json({ items, rows: items, total: Number(m.n), page, size, counts: { overdue: Number(k.overdue), today: Number(k.today), upcoming: Number(k.upcoming), open: Number(k.open) } });
  }
  const [rows] = await pool.query(SQL + ' WHERE f.staff_id = ? ORDER BY f.due_at, f.id', [sid]);
  const all = rows.map(out);
  const open = g => all.filter(f => f.group === g && f.status === 'Open').length;
  const counts = { overdue: open(0), today: open(1), upcoming: open(2), open: all.filter(f => f.status === 'Open').length };
  const b = { overdue: 0, today: 1, upcoming: 2 }[String(req.query.bucket || 'all')];
  res.json({ items: b == null ? all : all.filter(f => f.group === b), counts });
}));

const push = (id, entry) => pool.query(
  "UPDATE field_followups SET history_json = JSON_ARRAY_APPEND(COALESCE(history_json, JSON_ARRAY()), '$', CAST(? AS JSON)) WHERE id = ?", [JSON.stringify(entry), id]);

router.put('/:id/done', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const f = await load(req.params.id);
  canEdit(req, f);
  const remarks = String(req.body.remarks || '').trim().slice(0, 255);
  if (!remarks) throw fail(400, 'Please add remarks before marking done');
  if (f.status === 'Done') throw fail(409, 'Already done');
  await pool.query("UPDATE field_followups SET status = 'Done', done_remarks = ? WHERE id = ?", [remarks, f.id]);
  await push(f.id, { k: 'Done', t: remarks });
  res.json(out(await load(f.id)));
}));

router.put('/:id/reopen', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const f = await load(req.params.id);
  canEdit(req, f);
  await pool.query("UPDATE field_followups SET status = 'Open', done_remarks = '' WHERE id = ?", [f.id]);
  res.json(out(await load(f.id)));
}));

router.put('/:id/reschedule', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const f = await load(req.params.id);
  canEdit(req, f);
  const due = new Date(req.body.dueAt);
  if (isNaN(due)) throw fail(400, 'Choose a new date and time');
  const reason = String(req.body.reason || '').trim().slice(0, 60);
  const remarks = String(req.body.remarks || '').trim().slice(0, 255);
  if (!remarks) throw fail(400, 'Please add remarks before rescheduling');
  await pool.query('UPDATE field_followups SET due_at = ?, rescheduled_from = COALESCE(rescheduled_from, ?) WHERE id = ?', [utcSql(due), utcSql(new Date(f.due_at)), f.id]);
  const extras = [req.body.remind ? 'reminder 30 min before' : '', req.body.sms ? 'client SMS requested' : ''].filter(Boolean);
  await push(f.id, { k: 'Rescheduled', t: `${reason ? reason + ' — ' : ''}${remarks}${extras.length ? ' (' + extras.join(', ') + ')' : ''}` });
  res.json(out(await load(f.id)));
}));

export default router;
