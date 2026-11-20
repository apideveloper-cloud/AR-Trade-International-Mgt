export { send } from './pricesApi.js';
export { mcMsg as gsMsg } from './mcApi.js';

export const nf = n => (Number(n) || 0).toLocaleString('en-US');
export const pct = n => (Number(n) * 100 || 0).toFixed(1) + ' %';
export const pos = n => (Number(n) || 0).toFixed(1);
export const dt = v => (v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never');
export const day = v => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'never');

/** Change text with an arrow and a word, never colour alone. lowerBetter is for position. */
export function change(delta, { lowerBetter = false, ratio = false } = {}) {
  const d = Number(delta);
  if (delta == null || !Number.isFinite(d) || d === 0) return { arrow: '■', text: 'No change' };
  const up = d > 0;
  const good = lowerBetter ? !up : up;
  const val = lowerBetter ? Math.abs(d).toFixed(1) : Math.abs(d * 100).toFixed(ratio ? 1 : 0) + ' %';
  const word = lowerBetter ? (good ? 'improved' : 'worse') : (up ? 'up' : 'down');
  return { arrow: up ? '▲' : '▼', text: (up ? '+' : '-') + val + ' ' + word };
}

/** Plain-English advice for the reasons Google gives for not indexing a page. */
export function advice(reason) {
  const r = String(reason || '').toLowerCase();
  if (r.includes('crawled')) return 'Google saw the page but did not add it yet. Improve the page content and link to it from other pages.';
  if (r.includes('discovered')) return 'Google knows the address but has not visited it yet. Linking to it from other pages helps.';
  if (r.includes('duplicate') || r.includes('canonical')) return 'Google chose another page as the main one. Make this page clearly different, or ignore it if it is a copy.';
  if (r.includes('redirect')) return 'This address sends visitors somewhere else, so Google skips it. This is usually fine.';
  if (r.includes('404') || r.includes('not found')) return 'The page does not exist. Restore it or remove links to it.';
  if (r.includes('robots')) return 'The site settings tell Google not to visit this page. Check the robots.txt file if this is a mistake.';
  if (r.includes('noindex')) return 'The page asks Google not to list it. Remove the noindex tag if you want it found.';
  return 'Google gave this reason. Open the page in Search Console for more details.';
}
