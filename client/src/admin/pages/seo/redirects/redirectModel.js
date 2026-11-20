import { getAdminToken } from '../../../adminApi.js';

export const REDIRECT_CODES = [
  [301, '301 Permanent', 'Permanent move. Google passes the old page ranking to the new one (best choice).'],
  [302, '302 Temporary', 'Temporary detour. Google keeps the old address in its index.'],
  [307, '307 Temporary (strict)', 'Like 302, and the request method (POST) is kept.'],
  [308, '308 Permanent (strict)', 'Like 301, and the request method (POST) is kept.']
];

/** Default suggestion when the target box is empty. */
export const DEFAULT_TARGETS = [{ type: 'Page', label: 'All products', path: '/shop/all' }];

/** Request with a body that keeps the server's message with a 400 or 409. Returns { ok, data } or { ok:false, error }. */
export async function sendJson(method, url, body) {
  const t = getAdminToken();
  let res;
  try { res = await fetch('/api/admin' + url, { method, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body || {}) }); } catch { return { ok: false, error: "Can't reach the server. Check your connection and try again." }; }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, data };
  const list = Array.isArray(data.errors) && data.errors.length ? data.errors.join(' ') : '';
  return { ok: false, error: data.error || list || 'The server did not accept this.' };
}

/** Live address of a path on the public site. */
export const liveUrl = p => (/^https?:\/\//i.test(p) ? p : window.location.origin + (p.startsWith('/') ? p : '/' + p));
