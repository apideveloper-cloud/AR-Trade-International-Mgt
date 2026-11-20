export { send } from './pricesApi.js';

export const NA = 'Not available yet';
export const isNum = v => typeof v === 'number' && Number.isFinite(v);
export const num = v => (isNum(v) ? v.toLocaleString('en-US') : NA);
export const SEV = {
  high: { label: 'High', icon: '⚠', cls: 'adov-high' },
  medium: { label: 'Medium', icon: '●', cls: 'adov-med' },
  low: { label: 'Low', icon: 'ℹ', cls: 'adov-low' },
  error: { label: 'Error', icon: '✖', cls: 'adov-high' },
  warning: { label: 'Warning', icon: '⚠', cls: 'adov-med' },
};
export const sevOf = s => SEV[s] || SEV.low;

/** Change vs the previous period as { text, cls }. `good` = which direction is better. */
export function change(d, { good = 'up', unit = '' } = {}) {
  if (!isNum(d)) return { text: 'No earlier figure to compare', cls: 'adov-flat' };
  if (d === 0) return { text: 'No change', cls: 'adov-flat' };
  const up = d > 0;
  const val = Math.abs(Math.round(d * 10) / 10);
  return { text: (up ? '▲ Up ' : '▼ Down ') + val + unit + ' from the previous 28 days', cls: (good === 'up') === up ? 'adov-good' : 'adov-bad' };
}

export const pathOf = u => { try { const x = new URL(u, 'https://x.invalid'); return x.pathname + x.search; } catch { return String(u || ''); } };
export const richUrl = u => 'https://search.google.com/test/rich-results?url=' + encodeURIComponent(u);
export const when = t => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never');
