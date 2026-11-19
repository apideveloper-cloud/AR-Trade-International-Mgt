// Clock in / out, my entries, and the office view of a day's attendance.
import { Router } from 'express';
import { pool, guard, wrap, fail, roleKey, todayBD, mysqlDate, UTC, range, coord } from '../common.js';
import { iso } from '../../util.js';
import { serverTime, bdDayStartUtc, bdDayWindow, summariseDay } from './rules.js';

const router = Router();
const num = v => (v == null ? null : Number(v));

router.post('/attendance', guard(), wrap(async (req, res) => {
  const type = req.body.type;
  if (!['Clocked In', 'Clocked Out'].includes(type)) throw fail(400, 'Invalid attendance type');
  // only today's (Bangladesh time) rows count: a forgotten clock-out from an earlier day must not block today's clock-in
  const [[last]] = await pool.query('SELECT type FROM field_attendance WHERE staff_id = ? AND at >= ? ORDER BY at DESC, id DESC LIMIT 1', [req.staff.id, mysqlDate(bdDayStartUtc())]);
  if ((last?.type || 'Clocked Out') === type) throw fail(409, type === 'Clocked In' ? 'You are already clocked in.' : 'You are not clocked in.');
  const lat = req.body.lat == null ? null : coord(req.body.lat, 90);
  const lng = req.body.lng == null ? null : coord(req.body.lng, 180);
  await pool.query('INSERT INTO field_attendance (staff_id,type,at,lat,lng) VALUES (?,?,?,?,?)', [req.staff.id, type, mysqlDate(serverTime(req.body.time)), lat, lng]);
  res.json({ ok: true });
}));

// my entries in a time range (?from=&to= ISO instants), oldest first
router.get('/attendance', guard(), wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT type, ${UTC('at')} at, lat, lng FROM field_attendance WHERE staff_id = ? AND at >= ? AND at <= ? ORDER BY at, id`, [req.staff.id, ...range(req.query)]);
  res.json(rows.map(r => ({ type: r.type, time: r.at, lat: num(r.lat), lng: num(r.lng) })));
}));

// office view (approvers): everyone's attendance for one day in Bangladesh time, plus how many days each person clocked in this month
router.get('/attendance/report', guard('field.approve'), wrap(async (req, res) => {
  const today = todayBD();
  const date = iso(req.query.date, today);
  const { start: dayStart, end: dayEnd, monthStart } = bdDayWindow(date);
  const [staff] = await pool.query("SELECT id, name, role, phone FROM staff WHERE status = 'Active' ORDER BY name");
  const [rows] = await pool.query(`SELECT staff_id, type, ${UTC('at')} at, lat, lng FROM field_attendance WHERE at >= ? AND at < ? ORDER BY at, id`, [mysqlDate(dayStart), mysqlDate(dayEnd)]);
  const [leave] = await pool.query("SELECT DISTINCT staff_id FROM field_leave_requests WHERE status = 'Approved' AND from_date <= ? AND to_date >= ?", [date, date]);
  const [month] = await pool.query("SELECT staff_id, COUNT(DISTINCT DATE(CONVERT_TZ(at, '+00:00', '+06:00'))) days FROM field_attendance WHERE type = 'Clocked In' AND at >= ? AND at < ? GROUP BY staff_id", [mysqlDate(monthStart), mysqlDate(dayEnd)]);
  const onLeave = new Set(leave.map(l => l.staff_id));
  const monthDays = new Map(month.map(m => [m.staff_id, Number(m.days)]));
  const weeklyOff = new Date(date + 'T00:00:00Z').getUTCDay() === 5; // Friday
  const out = staff.map(s => {
    const mine = rows.filter(r => r.staff_id === s.id);
    const d = summariseDay(mine, { onLeave: onLeave.has(s.id), date, today, weeklyOff });
    return { id: s.id, name: s.name, role: roleKey(s.role), roleLabel: s.role, phone: s.phone, status: d.status, firstIn: d.firstIn, lastOut: d.lastOut, minutes: d.minutes, monthDays: monthDays.get(s.id) || 0, punches: mine.map(r => ({ type: r.type, at: r.at, lat: num(r.lat), lng: num(r.lng) })) };
  });
  res.json({ date, today, weeklyOff, rows: out });
}));

export default router;
