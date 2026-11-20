import { getAdminToken } from '../../adminApi.js';
export { send } from './pricesApi.js';

/** DELETE that keeps the error body: returns { status, ok, body }. Never throws. */
export async function sendDelete(url) {
  const headers = {};
  const t = getAdminToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  try {
    const res = await fetch('/api/admin' + url, { method: 'DELETE', headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body: data };
  } catch {
    return { status: 0, ok: false, body: { error: "Can't reach the server. Check your internet connection and try again." } };
  }
}

/** Turns an answer into a { ok, text } line in plain English. */
export function mcMsg(r, okText, tr = s => s) {
  if (r.ok) return { ok: true, text: okText || tr('Done.') };
  const b = r.body || {};
  const fallback = r.status === 403 ? 'You are not allowed to do this.' : r.status === 429 ? 'Too many tries. Please wait a minute and try again.' : r.status === 503 ? 'This is not set up yet.' : r.status >= 500 ? 'The server had a problem. Please try again.' : 'Something went wrong. Please try again.';
  const text = b.error || b.hint || b.message || fallback;
  return { ok: false, text: b.hint && b.error && !String(b.error).includes(b.hint) ? tr(b.error) + ' ' + tr(b.hint) : tr(text) };
}

/** Translates the text of a { ok, text } message at display time. */
export const trMsg = (tr, m) => (m && m.text ? { ...m, text: tr(m.text) } : m);

export const STATUS_FILTERS = [['', 'All'], ['included', 'In feed'], ['skipped', 'Left out'], ['warning', 'Warnings'], ['excluded', 'Excluded by me'], ['error', 'Google errors']];
export const REASON_TEXT = { no_image: 'No picture', no_price: 'No price', zero_price: 'Price is 0', not_published: 'Not published', out_of_stock: 'Out of stock', small_image: 'Picture too small', excluded: 'Excluded by you', excluded_category: 'Category excluded', no_description: 'No description', no_brand: 'No brand', no_gtin: 'No barcode (GTIN)' };
const FEED_REASONS = { 'no price': 'No price (0)', 'no image': 'No picture', 'not active': 'Not published', 'name empty': 'No name', 'noindex': 'Hidden from Google', 'excluded by owner': 'Excluded by you', 'category excluded': 'Category excluded', 'image too small': 'Picture too small', 'image size unknown': 'Picture size unknown', 'over cap': 'Over the 5,000 product limit' };
/** Plain-words reason for a feed code. Pass tr to get it in the admin language. */
export const why = (r, tr = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m)) : s)) => {
  const hit = REASON_TEXT[r] || FEED_REASONS[r];
  if (hit) return tr(hit);
  if (/^image under \d+ px$/.test(r)) return tr('Picture smaller than {n} px', { n: String(r).replace(/\D/g, '') });
  return tr(String(r || '').replace(/_/g, ' '));
};
export const TAXONOMY_URL = 'https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt';
