// Date and number helpers for the dashboard (pure). Days are 'YYYY-MM-DD' strings in UTC so a calendar day never shifts.
export const DAY = 864e5;
/** Periods the dashboard can be sorted by: days -> wording used in the text. */
export const RANGES = { 1: 'day', 7: '7 days', 15: '15 days', 30: '30 days', 90: '3 months', 180: '6 months', 365: '12 months' };
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = n => String(n).padStart(2, '0');
/** A Date as 'YYYY-MM-DD' (UTC). */
export const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
/** 'YYYY-MM-DD' as a UTC midnight Date. */
export const parse = s => new Date(s + 'T00:00:00Z');
/** The day `n` days after (or before, when negative) the day `s`. */
export const addDays = (s, n) => ymd(new Date(parse(s).getTime() + n * DAY));
/** Percentage change from b to a, or null when there is nothing to compare with. */
export const pct = (a, b) => (b ? Math.round((a - b) / b * 100) : null);
export const sum = (a, f = x => x) => a.reduce((t, x) => t + f(x), 0);
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
/** True for a plain 'YYYY-MM-DD' string. */
export const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
/** The chosen period length in days, falling back to 30. */
export const periodDays = rangeDays => (RANGES[rangeDays] ? Number(rangeDays) : 30);
