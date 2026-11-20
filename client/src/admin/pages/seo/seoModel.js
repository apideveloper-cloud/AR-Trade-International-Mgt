import { adm, getAdminToken } from '../../adminApi.js';

// The tabs of the SEO page: add a row here (and a branch in SeoPage.jsx) for each later phase (Products, Redirects, 404s).
export const SEO_TABS = [['overview', 'Overview'], ['products', 'Products'], ['brands', 'Brands'], ['redirects', 'Redirects'], ['404', '404s'], ['activity', 'Activity'], ['settings', 'Settings']];

export const PAGE_TYPES = [['product', 'Product'], ['category', 'Category'], ['brand', 'Brand'], ['blog', 'Blog'], ['page', 'Site page'], ['home', 'Home']];
export const TPL_FIELDS = [['title', 'Page title', 60], ['description', 'Meta description', 155], ['ogTitle', 'Social share title', 60], ['ogDescription', 'Social share description', 155]];
export const SEPARATORS = ['|', '-', '–', '·'];
export const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];

/** Sets a value at a path inside a copy of the object (arrays and objects on the path are copied, nothing is changed in place). */
export function setIn(obj, path, value) {
  const [k, ...rest] = path;
  const base = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  base[k] = rest.length ? setIn(base[k], rest, value) : value;
  return base;
}

/** PUT that keeps the list of problems the server sends with a 400 (adm.put only keeps the first message). */
export async function putJson(url, body) {
  const t = getAdminToken();
  let res;
  try { res = await fetch('/api/admin' + url, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) }); } catch { return { ok: false, errors: ["Can't reach the server. Check your connection and try again."] }; }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, data };
  const errors = Array.isArray(data.errors) && data.errors.length ? data.errors : [data.error || 'The server did not accept this.'];
  return { ok: false, errors };
}

export const previewApi = body => adm.post('/seo/preview', body);

/** Filters of the Products tab: [key, select label, summary tile title]. */
export const PRODUCT_FILTERS = [['all', 'All products'], ['missing_title', 'No custom meta title (template used)'], ['missing_desc', 'No custom meta description (template used)'], ['low_score', 'Score < 50'], ['missing_gtin', 'Missing GTIN'], ['alt_missing', 'Images without alt'], ['noindex', 'Noindex'], ['unscored', 'Not scored yet']];
export const PRODUCT_SORTS = [['id', 'Newest ID'], ['name', 'Name'], ['score', 'SEO score'], ['updated', 'Last updated']];

/** POST that keeps the server's 400 message and returns { ok, data } or { ok:false, error } (adm.post throws; callers here want a value). */
export async function postJson(url, body) {
  const t = getAdminToken();
  let res;
  try { res = await fetch('/api/admin' + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) }); } catch { return { ok: false, error: "Can't reach the server. Check your connection and try again." }; }
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, data } : { ok: false, error: data.error || 'The server did not accept this.' };
}

/** Downloads the CSV of the current filter (needs the Authorization header, so fetch, then a blob link). */
export async function exportSeoCsv({ filter, q, cat }) {
  const t = getAdminToken();
  const qs = new URLSearchParams({ filter: filter || 'all', q: q || '', cat: cat || '' }).toString();
  const res = await fetch('/api/admin/seo/export.csv?' + qs, { headers: t ? { Authorization: 'Bearer ' + t } : {} });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await res.blob()), download: 'seo-products-' + new Date().toISOString().slice(0, 10) + '.csv' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
