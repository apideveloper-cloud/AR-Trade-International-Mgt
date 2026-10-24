// This week's attendance summary for the Home screen.
//   GET /api/field/week -> { today, shift, days:[{date,label,day,status,hours,firstIn}], seconds, hoursText, present, workdays, late, overtimeSeconds, overtimeText }
// Week = Saturday..Friday in Bangladesh time (UTC+6). Friday is the weekly off. Shift 09:00-18:00; late = first clock-in after 09:15.
// Day status: present | late | leave | absent | today | off | upcoming
import { Router } from 'express';
import { pool, wrap, guard, UTC, mysqlDate, todayBD } from '../common.js';

const router = Router();
const H = 3600e3, DAY = 864e5, BD = 6 * H;
const SHIFT_START = 9 * H, SHIFT_END = 18 * H, LATE_AFTER = 9 * H + 15 * 60e3;
const LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayStartUtc = d => Date.parse(d + 'T00:00:00Z') - BD; // instant when the BD date d begins
const bdDate = ms => new Date(ms + BD).toISOString().slice(0, 10);
const bdClock = ms => ((ms + BD) % DAY + DAY) % DAY; // ms since BD midnight
const hm = s => `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`;

router.get('/', guard(), wrap(async (req, res) => {
  const today = todayBD();
  const t0 = new Date(today + 'T00:00:00Z');
  const start = t0.getTime() - ((t0.getUTCDay() + 1) % 7) * DAY; // Saturday on or before today (as BD date at 00:00Z)
  const dates = Array.from({ length: 7 }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10));
  const from = dayStartUtc(dates[0]), to = dayStartUtc(dates[6]) + DAY;

  const [rows] = await pool.query(`SELECT type, ${UTC('at')} at FROM field_attendance WHERE staff_id = ? AND at >= ? AND at < ? ORDER BY at, id`,
    [req.staff.id, mysqlDate(from), mysqlDate(to)]);
  const [leave] = await pool.query(
    "SELECT DATE_FORMAT(from_date,'%Y-%m-%d') f, DATE_FORMAT(to_date,'%Y-%m-%d') t FROM field_leave_requests WHERE staff_id = ? AND status = 'Approved' AND from_date <= ? AND to_date >= ?",
    [req.staff.id, dates[6], dates[0]]).catch(() => [[]]);

  const now = Date.now();
  const per = Object.fromEntries(dates.map(d => [d, { firstIn: null, ms: 0, overtimeMs: 0 }]));
  let openIn = null;
  const close = (inAt, outAt) => {
    const d = per[bdDate(inAt)];
    if (!d) return;
    d.ms += outAt - inAt;
    const a = bdClock(inAt), b = a + (outAt - inAt); // overtime = time before the shift starts or after it ends
    d.overtimeMs += Math.max(0, Math.min(b, SHIFT_START) - a) + Math.max(0, b - Math.max(a, SHIFT_END));
  };
  for (const r of rows) {
    const at = Date.parse(r.at);
    if (r.type === 'Clocked In') {
      if (openIn === null) {
        openIn = at;
        const d = per[bdDate(at)];
        if (d && d.firstIn === null) d.firstIn = at;
      }
    } else if (openIn !== null) { close(openIn, at); openIn = null; }
  }
  if (openIn !== null) close(openIn, Math.min(now, dayStartUtc(bdDate(openIn)) + DAY)); // still clocked in: counts up to now

  const onLeave = d => leave.some(l => l.f <= d && l.t >= d);
  let seconds = 0, overtime = 0, present = 0, late = 0, workdays = 0;
  const days = dates.map(d => {
    const p = per[d], dow = new Date(d + 'T00:00:00Z').getUTCDay();
    const worked = p.firstIn !== null, isLate = worked && bdClock(p.firstIn) > LATE_AFTER;
    let status;
    if (onLeave(d)) status = 'leave';
    else if (d > today) status = dow === 5 ? 'off' : 'upcoming';
    else if (d === today) status = dow === 5 && !worked ? 'off' : 'today';
    else if (worked) status = isLate ? 'late' : 'present';
    else status = dow === 5 ? 'off' : 'absent';
    if (d <= today && status !== 'off' && status !== 'leave') workdays++;
    if (worked && status !== 'leave') { present++; if (isLate) late++; }
    seconds += Math.round(p.ms / 1000);
    overtime += Math.round(p.overtimeMs / 1000);
    return { date: d, label: LABELS[dow], day: Number(d.slice(8)), status, late: isLate, worked, hours: Math.round(p.ms / 36e4) / 10, firstIn: p.firstIn ? new Date(p.firstIn).toISOString() : null };
  });

  res.json({ today, shift: { start: '09:00', end: '18:00' }, days, seconds, hoursText: hm(seconds), present, workdays, late,
    overtimeSeconds: overtime, overtimeText: hm(overtime) });
}));

export default router;
