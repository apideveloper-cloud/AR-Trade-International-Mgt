// Shared helpers for server-side lists: page and size, a date period and a text search, so every list filters in the database
// and sends only one page. All of it is optional: a request without these parameters behaves as it did before.

import { iso } from './util.js';

/** A real calendar date as YYYY-MM-DD, or null ("2026-02-31" is not a date). */
export const day = v => iso(v, null);

/** Page number, page size and the SQL offset from ?page= and ?size= (size is kept between 1 and max). */
export function pageOf(req, { def = 25, max = 200 } = {}) {
  const size = Math.min(max, Math.max(1, parseInt(req.query.size, 10) || def));
  const page = Math.min(1000000, Math.max(1, parseInt(req.query.page, 10) || 1));
  return { size, page, offset: (page - 1) * size };
}

/** Adds "col is within ?from .. ?to" (whole days, both ends included) to a condition list. Works for DATE, DATETIME and TIMESTAMP columns. */
export function addRange(cond, args, col, req, { from = 'from', to = 'to' } = {}) {
  const a = day(req.query[from]), b = day(req.query[to]);
  if (a) { cond.push(`${col} >= ?`); args.push(a + ' 00:00:00'); }
  if (b) { cond.push(`${col} < DATE_ADD(?, INTERVAL 1 DAY)`); args.push(b); }
}

/** Adds "any of these columns contains ?q". */
export function addSearch(cond, args, cols, q) {
  const w = String(q || '').trim().slice(0, 80);
  if (!w) return;
  const like = `%${w.replace(/[\\%_]/g, c => '\\' + c)}%`;
  cond.push('(' + cols.map(c => `${c} LIKE ?`).join(' OR ') + ')');
  args.push(...cols.map(() => like));
}

export const whereOf = cond => (cond.length ? 'WHERE ' + cond.join(' AND ') : '');

/** True when the request asks for a page (so older callers that send no page still get their old full list). */
export const wantsPage = req => req.query.page !== undefined || req.query.size !== undefined;

/** Adds "col between ?min and ?max" (whole taka). */
export function addAmount(cond, args, col, req) {
  const n = v => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null);
  if (n(req.query.min) !== null) { cond.push(`${col} >= ?`); args.push(n(req.query.min)); }
  if (n(req.query.max) !== null) { cond.push(`${col} <= ?`); args.push(n(req.query.max)); }
}
