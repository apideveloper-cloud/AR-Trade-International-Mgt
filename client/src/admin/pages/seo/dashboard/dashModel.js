import { getAdminToken } from '../../../adminApi.js';

/** Which product-list filter the View button of an issue opens. */
export function filterForIssue(id) {
  const s = String(id || '');
  if (s.startsWith('title')) return 'missing_title';
  if (s.startsWith('desc')) return 'missing_desc';
  if (s === 'image_alt') return 'alt_missing';
  if (s === 'gtin_or_mpn') return 'missing_gtin';
  if (s === 'noindex') return 'noindex';
  return 'low_score';
}

/** Tone of a score: good from 80, fair from 50, poor below. */
export const scoreTone = n => (n == null ? 'none' : n >= 80 ? 'good' : n >= 50 ? 'fair' : 'poor');

/** POST /seo/recalculate with the admin token: { ok, error }. */
export async function recalcAll() {
  const t = getAdminToken();
  try {
    const res = await fetch('/api/admin/seo/recalculate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error || 'The server did not accept this.' };
  } catch { return { ok: false, error: "Can't reach the server. Check your connection and try again." }; }
}

export const n0 = v => Number(v || 0).toLocaleString('en-US');
export const whenOf = (t, tr = s => s) => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : tr('never'));
