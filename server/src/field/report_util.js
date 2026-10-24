// Helpers for the reports / overview / admin modules: Bangladesh-time periods, number formats, report scope.
import { pool, isApprover, roleKey } from './common.js';

const BD = 6 * 3600e3; // Bangladesh is UTC+6 all year
const DAY = 864e5;

/** UTC instant of 00:00 Bangladesh time on the given calendar date (month is 0-based, overflow rolls over). */
const bdMidnight = (y, m, d) => new Date(Date.UTC(y, m, d) - BD);
/** The Bangladesh calendar parts of an instant. */
export const bdParts = date => {
  const b = new Date(date.getTime() + BD);
  return { y: b.getUTCFullYear(), m: b.getUTCMonth(), d: b.getUTCDate(), dow: b.getUTCDay(), min: b.getUTCHours() * 60 + b.getUTCMinutes() };
};
export const bdDateStr = date => new Date(date.getTime() + BD).toISOString().slice(0, 10);
export const isFriday = date => bdParts(date).dow === 5;

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDay = date => { const p = bdParts(date); return `${p.d} ${MON[p.m].slice(0, 3)}`; };

/**
 * Period window (UTC instants) with its chart buckets and the previous window of the same kind.
 * day: 7 two-hour buckets 8a..8p · week: Saturday..Friday · month: weeks of the month.
 */
export function period(kind, now = new Date()) {
  const p = bdParts(now);
  let start, end, prevStart, labels, bucketMs, label;
  if (kind === 'day') {
    start = bdMidnight(p.y, p.m, p.d); end = new Date(start.getTime() + DAY); prevStart = new Date(start.getTime() - DAY);
    labels = ['8a', '10a', '12p', '2p', '4p', '6p', '8p'];
    label = `Today, ${fmtDay(now)}`;
  } else if (kind === 'month') {
    start = bdMidnight(p.y, p.m, 1); end = bdMidnight(p.y, p.m + 1, 1); prevStart = bdMidnight(p.y, p.m - 1, 1);
    const weeks = Math.ceil((end - start) / DAY / 7);
    labels = Array.from({ length: weeks }, (_, i) => `W${i + 1}`);
    label = `${MON[p.m]} ${p.y}`;
  } else {
    const sinceSat = (p.dow + 1) % 7;
    start = bdMidnight(p.y, p.m, p.d - sinceSat); end = new Date(start.getTime() + 7 * DAY); prevStart = new Date(start.getTime() - 7 * DAY);
    labels = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    label = `This week · ${fmtDay(start)} – ${fmtDay(new Date(end.getTime() - DAY))}`;
  }
  const prevEnd = start;
  const bucketOf = t => {
    const x = t instanceof Date ? t : new Date(t);
    if (kind === 'day') return Math.max(0, Math.min(6, Math.floor((x - start - 8 * 3600e3) / (2 * 3600e3))));
    if (kind === 'month') return Math.max(0, Math.min(labels.length - 1, Math.floor((x - start) / (7 * DAY))));
    return Math.max(0, Math.min(6, Math.floor((x - start) / DAY)));
  };
  return { kind, start, end, prevStart, prevEnd, labels, bucketOf, label, months: kind === 'month' ? 1 : 0 };
}

/** Non-Friday days of the window that have already started (the days people are expected to work). */
export function workdaysElapsed(win, now = new Date()) {
  let n = 0;
  for (let t = win.start.getTime(); t < Math.min(win.end.getTime(), now.getTime()); t += DAY) if (!isFriday(new Date(t + 1000))) n++;
  return n;
}

/** SQL fragment "column (TIMESTAMP, server time zone) lies inside [from, to)" with its UTC parameters. */
export const tsBetween = (col, from, to) => ({
  sql: `CONVERT_TZ(${col}, @@session.time_zone, "+00:00") >= ? AND CONVERT_TZ(${col}, @@session.time_zone, "+00:00") < ?`,
  args: [toSql(from), toSql(to)]
});
export const toSql = d => d.toISOString().slice(0, 19).replace('T', ' ');

/** Short taka text like the design: ৳ 486k, ৳ 3.2L, ৳ 950. */
export const kfmt = n => {
  const v = Math.abs(Math.round(n));
  const s = v >= 100000 ? `${(v / 100000).toFixed(1).replace(/\.0$/, '')}L` : v >= 1000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '')}k` : String(v);
  return (n < 0 ? '−' : '') + s;
};
export const tkText = n => '৳ ' + kfmt(n);
export const group = n => { // Indian digit grouping: 1,23,456
  const s = String(Math.round(Math.abs(n)));
  const last = s.slice(-3); let rest = s.slice(0, -3); const parts = [];
  while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) parts.unshift(rest);
  return (n < 0 ? '−' : '') + (parts.length ? parts.join(',') + ',' : '') + last;
};
export const pctDelta = (cur, prev) => (prev > 0 ? `${cur >= prev ? '+' : '−'}${Math.abs(Math.round(((cur - prev) / prev) * 100))}%` : (cur > 0 ? 'new' : '—'));
export const numDelta = (cur, prev, unit = '') => { const d = Math.round((cur - prev) * 10) / 10; return `${d >= 0 ? '+' : '−'}${Math.abs(d)}${unit}`; };

export async function setting(key, fallback) {
  const [[r]] = await pool.query('SELECT v FROM field_settings WHERE k = ?', [key]);
  const n = Number(r?.v);
  return Number.isFinite(n) && r ? n : fallback;
}

/** Managers, accountants and admins see the whole team; everyone else only their own figures. */
export const seesAll = staff => isApprover(staff) || ['manager', 'accountant', 'admin'].includes(roleKey(staff.role));

export const CSV = rows => rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
export { WD, MON, DAY, BD };
