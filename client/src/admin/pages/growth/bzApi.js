import { mcMsg } from './mcApi.js';
export { send } from './pricesApi.js';
export { mcMsg };

export const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** Always 7 rows, in a fixed order, whatever the server sent. */
export function normHours(list) {
  const by = {};
  (list || []).forEach(h => { if (h && h.day) by[String(h.day).toLowerCase()] = h; });
  return DAYS.map(day => {
    const h = by[day.toLowerCase()] || by[day.slice(0, 3).toLowerCase()] || {};
    return { day, opens: h.opens || '09:00', closes: h.closes || '18:00', closed: !!h.closed };
  });
}

export const SOURCE_TEXT = { site: 'the Settings page', 'seo.business': 'this page', 'content.social': 'Storefront content (social links)' };
/** tr is optional: pass the admin translator to get 'never' in Bangla. */
export const when = (at, tr = s => s) => { const d = at ? new Date(at) : null; return d && !isNaN(d) ? d.toLocaleString() : tr('never'); };
/** Translates the text of a { ok, text } message at display time. */
export const trMsg = (tr, m) => (m && m.text ? { ...m, text: tr(m.text) } : m);
