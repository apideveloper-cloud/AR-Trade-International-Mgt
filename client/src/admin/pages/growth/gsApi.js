export { send } from './pricesApi.js';
export { mcMsg as gsMsg } from './mcApi.js';

export const nf = n => (Number(n) || 0).toLocaleString('en-US');
export const pct = n => (Number(n) * 100 || 0).toFixed(1) + ' %';
export const pos = n => (Number(n) || 0).toFixed(1);
export const dt = (v, tr = s => s) => (v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : tr('never'));
export const day = (v, tr = s => s) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : tr('never'));

/** Change text with an arrow and a word, never colour alone. lowerBetter is for position. */
export function change(delta, { lowerBetter = false, ratio = false, tr = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined ? v[k] : m)) } = {}) {
  const d = Number(delta);
  if (delta == null || !Number.isFinite(d) || d === 0) return { arrow: '■', text: tr('No change') };
  const up = d > 0;
  const good = lowerBetter ? !up : up;
  const val = lowerBetter ? Math.abs(d).toFixed(1) : Math.abs(d * 100).toFixed(ratio ? 1 : 0) + ' %';
  const v = (up ? '+' : '-') + val;
  const text = lowerBetter ? (good ? tr('{v} improved', { v }) : tr('{v} worse', { v })) : (up ? tr('{v} up', { v }) : tr('{v} down', { v }));
  return { arrow: up ? '▲' : '▼', text };
}

/** Plain-English advice for the reasons Google gives for not indexing a page. */
export function advice(reason, tr = s => s) {
  const r = String(reason || '').toLowerCase();
  if (r.includes('crawled')) return tr('Google saw the page but did not add it yet. Improve the page content and link to it from other pages.');
  if (r.includes('discovered')) return tr('Google knows the address but has not visited it yet. Linking to it from other pages helps.');
  if (r.includes('duplicate') || r.includes('canonical')) return tr('Google chose another page as the main one. Make this page clearly different, or ignore it if it is a copy.');
  if (r.includes('redirect')) return tr('This address sends visitors somewhere else, so Google skips it. This is usually fine.');
  if (r.includes('404') || r.includes('not found')) return tr('The page does not exist. Restore it or remove links to it.');
  if (r.includes('robots')) return tr('The site settings tell Google not to visit this page. Check the robots.txt file if this is a mistake.');
  if (r.includes('noindex')) return tr('The page asks Google not to list it. Remove the noindex tag if you want it found.');
  return tr('Google gave this reason. Open the page in Search Console for more details.');
}
