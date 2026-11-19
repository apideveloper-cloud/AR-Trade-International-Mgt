// Attendance figures for the reports: per-person days from clock rows (stored in UTC), lateness, duty hours, who clocks in.
import { pool, UTC } from '../common.js';
import { toSql, bdParts, bdDateStr, seesAll } from '../report_util.js';
import { sum } from './shared.js';

const CLOCKERS = ['Field Officer', 'RM', 'Purchase Officer'];

/** Folds clock rows [{ staff_id, type, at_utc }] (ordered by staff, time) into one entry per staff and Bangladesh day: { staff, date, first, ms }. */
export function foldDays(rows, now = Date.now()) {
  const days = new Map(); // "staff|date" -> { first, ms, open }
  for (const r of rows) {
    const at = new Date(r.at_utc);
    const key = `${r.staff_id}|${bdDateStr(at)}`;
    if (r.type !== 'Clocked In' && !days.has(key)) continue; // a clock-out whose clock-in was on an earlier day is not a day present (and has no first-in time)
    const d = days.get(key) || { staff: r.staff_id, date: bdDateStr(at), first: null, ms: 0, open: null };
    if (r.type === 'Clocked In') { d.first ||= at; d.open = at; } else if (d.open) { d.ms += at - d.open; d.open = null; }
    days.set(key, d);
  }
  for (const d of days.values()) if (d.open) d.ms += Math.max(0, Math.min(now, d.open.getTime() + 10 * 3600e3) - d.open);
  return [...days.values()];
}

/** Present days of the given staff in the window (or the previous one). */
export async function attendanceDays(win, staffIds, prev = false) {
  const from = prev ? win.prevStart : win.start;
  const to = prev ? win.prevEnd : win.end;
  if (!staffIds.length) return [];
  const [rows] = await pool.query(
    `SELECT staff_id, type, ${UTC('at')} AS at_utc FROM field_attendance WHERE at >= ? AND at < ? AND staff_id IN (?) ORDER BY staff_id, at, id`,
    [toSql(from), toSql(to), staffIds]);
  return foldDays(rows);
}

/** Staff ids the report covers: the caller alone, or every active person who clocks in. */
export async function clockerIds(req) {
  if (!seesAll(req.staff)) return [req.staff.id];
  const [rows] = await pool.query('SELECT id FROM staff WHERE status = "Active" AND role IN (?)', [CLOCKERS]);
  return rows.map(r => r.id);
}

/** First clock-in after 09:15 Bangladesh time. */
export const lateDay = d => d.first && bdParts(d.first).min > 9 * 60 + 15;
/** Average duty hours per present day. */
export const hoursOf = days => (days.length ? sum(days, d => d.ms) / 3600e3 / days.length : 0);
