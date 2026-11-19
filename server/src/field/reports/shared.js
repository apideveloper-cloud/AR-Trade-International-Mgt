// Helpers shared by the report routes: period kind, sums, who-can-see-what scope, timestamp reads, custom date windows.
import { pool, UTC_TS } from '../common.js';
import { tsBetween, seesAll, MON, DAY, BD } from '../report_util.js';
import { day } from '../../listing.js';

/** 'day' | 'week' | 'month' (anything else -> 'week'). */
export const kind = v => (['day', 'week', 'month'].includes(v) ? v : 'week');
/** Sum of f(row) over rows, as a number. */
export const sum = (rows, f) => rows.reduce((t, r) => t + Number(f(r) || 0), 0);

/** [sqlFragment, args] limiting a table's `staff_id` to the caller unless they may see everybody. */
export const scopeOf = (req, col = 'staff_id') => (seesAll(req.staff) ? ['', []] : [` AND ${col} = ?`, [req.staff.id]]);

/** Rows of `table` whose timestamp column lies in the window (or the previous window), each with `at_utc`. */
export async function rowsIn(table, tsCol, win, extra = '', args = [], prev = false, select = '*') {
  const from = prev ? win.prevStart : win.start;
  const to = prev ? win.prevEnd : win.end;
  const r = tsBetween(tsCol, from, to);
  const [rows] = await pool.query(`SELECT ${select}, ${UTC_TS(tsCol)} AS at_utc FROM ${table} WHERE ${r.sql}${extra}`, [...r.args, ...args]);
  return rows;
}

/** '2026-11-05' -> '5 Nov 2026'. */
export const dayText = s => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MON[m - 1].slice(0, 3)} ${y}`; };

/** A custom date window (?from= and/or ?to=, whole Bangladesh days, both ends included), or null when neither is sent. */
export function customWindow(req) {
  const a = day(req.query.from), b = day(req.query.to);
  if (!a && !b) return null;
  const start = a ? new Date(Date.parse(a + 'T00:00:00Z') - BD) : new Date(0);
  const end = b ? new Date(Date.parse(b + 'T00:00:00Z') + DAY - BD) : new Date(Date.UTC(2100, 0, 1));
  return { kind: 'custom', start, end, label: a && b ? (a === b ? dayText(a) : `${dayText(a)} – ${dayText(b)}`) : a ? `From ${dayText(a)}` : `Until ${dayText(b)}` };
}
