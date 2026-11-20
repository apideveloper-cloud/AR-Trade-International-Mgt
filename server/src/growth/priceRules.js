// Pure price and stock rules (no database, unit-tested). Whole taka only: non-negative integers.
import { saleEndsOf, stockStatusOf } from '../admin/seoValidate.js';

export const PRICE_MAX = 10000000;
export const STOCK_MAX = 1000000;
export const JUMP_PCT = 50;
/** Dhaka calendar date (UTC+6, no daylight saving) as YYYY-MM-DD. */
export const dhakaToday = (now = Date.now()) => new Date(now + 6 * 3600e3).toISOString().slice(0, 10);

const NOT_SENT = Symbol('not sent');
/** A non-negative whole number from a number or a digit string; null when it is anything else. */
export function wholeNumber(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && /^\s*\d{1,12}\s*$/.test(v)) return parseInt(v, 10);
  return null;
}
/** mysql2 returns a DATE column as a local-time Date: read it with local parts, never toISOString. */
export const localYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dateText = d => (d == null || d === '' ? null : d instanceof Date ? localYmd(d) : String(d).slice(0, 10));

/**
 * product = the stored row ({ price, old | old_price, stock, active, saleEnds | sale_ends }); change = the fields being set
 * (price, old, saleEnds, stock, stockStatus; a missing key = unchanged).
 * @returns {{ value: object, errors: {field,message}[], jump: {from,to,pct}|null }} value holds only the clean fields that were sent.
 */
export function validatePriceChange(product, change, { today = dhakaToday() } = {}) {
  const p = product || {}, c = change || {}, errors = [], value = {};
  const has = k => k in c && c[k] !== undefined;
  const err = (field, message) => errors.push({ field, message });
  const curPrice = wholeNumber(p.price) ?? 0, curOld = wholeNumber(p.old ?? p.old_price) ?? 0, curEnds = dateText(p.saleEnds ?? p.sale_ends);
  let price = NOT_SENT, old = NOT_SENT, ends = NOT_SENT;

  if (has('price')) {
    const n = wholeNumber(c.price);
    if (n == null) err('price', 'Price must be a whole number of taka, 0 or more');
    else if (n > PRICE_MAX) err('price', 'Price cannot be more than 10,000,000');
    else if (n === 0 && p.active !== false && p.active !== 0) err('price', 'A live product cannot have a price of 0. Hide the product first, or enter a price');
    else { price = n; value.price = n; }
  }
  if (has('old')) {
    const n = c.old === null || c.old === '' ? 0 : wholeNumber(c.old);
    if (n == null) err('old', 'Old price must be a whole number of taka, 0 or more');
    else if (n > PRICE_MAX) err('old', 'Old price cannot be more than 10,000,000');
    else { old = n; value.old = n; }
  }
  if (has('saleEnds')) {
    try { ends = saleEndsOf(c.saleEnds); value.saleEnds = ends; } catch (e) { err('saleEnds', e.message); }
  }
  if (has('stock')) {
    const n = wholeNumber(c.stock);
    if (n == null) err('stock', 'Stock must be a whole number, 0 or more');
    else if (n > STOCK_MAX) err('stock', 'Stock cannot be more than 1,000,000');
    else value.stock = n;
  }
  if (has('stockStatus')) {
    try { value.stockStatus = stockStatusOf(c.stockStatus); } catch (e) { err('stockStatus', e.message); }
  }

  // relations are checked on the merged result, and only when one of the fields involved was touched
  const newPrice = price === NOT_SENT ? curPrice : price, newOld = old === NOT_SENT ? curOld : old, newEnds = ends === NOT_SENT ? curEnds : ends;
  const bad = k => errors.some(e => e.field === k);
  if ((price !== NOT_SENT || old !== NOT_SENT) && !bad('price') && !bad('old') && newOld !== 0 && newOld < newPrice) {
    err(old !== NOT_SENT ? 'old' : 'price', `Old price (${newOld}) must be 0 or at least the price (${newPrice})`);
  }
  if ((price !== NOT_SENT || old !== NOT_SENT || ends !== NOT_SENT) && !bad('saleEnds') && newEnds && newEnds < today && newOld > newPrice) {
    err('saleEnds', 'The sale already ended (' + newEnds + '). Clear the old price and the end date, or choose a later date');
  }

  let jump = null;
  if (price !== NOT_SENT && curPrice > 0 && !errors.length) {
    const pct = Math.abs(price - curPrice) / curPrice * 100;
    if (pct > JUMP_PCT) jump = { from: curPrice, to: price, pct: Math.round(pct * 10) / 10 };
  }
  return { value, errors, jump };
}

/** The part of the change that really differs from the stored product (unchanged fields are not re-validated, so old data is never blocked). */
export function onlyChanged(product, change) {
  const p = product || {}, out = {};
  const cur = { price: p.price, old: p.old ?? p.old_price, saleEnds: dateText(p.saleEnds ?? p.sale_ends), stock: p.stock, stockStatus: p.stockStatus ?? p.stock_status };
  for (const k of Object.keys(cur)) {
    if (!(k in (change || {})) || change[k] === undefined) continue;
    const v = change[k];
    const same = k === 'saleEnds' ? (dateText(v) ?? null) === (cur.saleEnds ?? null) : k === 'stockStatus' ? String(v).trim().toLowerCase() === String(cur.stockStatus || 'auto') : k === 'old' && (v === '' || v === null) ? Number(cur.old || 0) === 0 : wholeNumber(v) !== null && wholeNumber(v) === Number(cur[k]);
    if (!same) out[k] = v;
  }
  return out;
}
