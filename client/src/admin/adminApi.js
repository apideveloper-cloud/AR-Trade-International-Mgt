import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'ar_admin_token';
export const getAdminToken = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const setAdminToken = t => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

/** Does the signed-in staff member hold the permission (or any one of a list)? The server enforces it too; this only decides what to show. */
export const can = (staff, perm) => [].concat(perm).some(p => staff?.perms?.includes(p));

let onUnauthorized = () => {};
export const setUnauthorizedHandler = fn => { onUnauthorized = fn; };

async function call(method, url, body, base = '/api/admin') {
  const headers = { 'Content-Type': 'application/json' };
  const t = getAdminToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  let res;
  try { res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined }); } catch { throw Object.assign(new Error("Can't reach the server. Check your internet connection and try again."), { status: 0 }); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && t) onUnauthorized();
  if (!res.ok) {
    const fallback = res.status >= 502 && res.status <= 504 ? 'The server is restarting or busy. Please try again in a moment.' : res.status >= 500 ? 'The server had a problem with this request. Please try again.' : res.status === 404 ? 'We could not find what you asked for.' : 'Something went wrong';
    throw Object.assign(new Error(data.error || fallback), { status: res.status });
  }
  return data;
}

export const adm = {
  get: url => call('GET', url),
  post: (url, body) => call('POST', url, body),
  put: (url, body) => call('PUT', url, body),
  del: url => call('DELETE', url)
};

/** Downloads a private file (e.g. an applicant's CV) with the staff token, then hands it to the browser as a normal download. */
export async function downloadFile(url, fallbackName = 'download') {
  const t = getAdminToken();
  const res = await fetch('/api/admin' + url, { headers: t ? { Authorization: 'Bearer ' + t } : {} });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Download failed');
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await res.blob()), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/** Opens a private PDF in a new tab (fetched with the staff token). */
export async function viewFile(url) {
  const w = window.open('', '_blank'); // opened first so the browser does not treat it as a blocked pop-up
  try {
    const t = getAdminToken();
    const res = await fetch('/api/admin' + url, { headers: t ? { Authorization: 'Bearer ' + t } : {} });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not open the file');
    const href = URL.createObjectURL(await res.blob());
    if (w) w.location.href = href; else window.location.href = href;
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  } catch (e) { if (w) w.close(); throw e; }
}

/** The field-app API (attendance, tracking, approvals): the web console signs in with the same staff token. */
export const fld = {
  get: url => call('GET', url, undefined, '/api/field'),
  post: (url, body) => call('POST', url, body, '/api/field'),
  put: (url, body) => call('PUT', url, body, '/api/field')
};

/** Opens a private field-app file (an expense voucher photo) in a new tab, fetched with the staff token. */
export async function viewFieldFile(url) {
  const w = window.open('', '_blank');
  try {
    const t = getAdminToken();
    const res = await fetch(url, { headers: t ? { Authorization: 'Bearer ' + t } : {} });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not open the file');
    const href = URL.createObjectURL(await res.blob());
    if (w) w.location.href = href; else window.location.href = href;
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  } catch (e) { if (w) w.close(); throw e; }
}

/** Fetches a private PDF with the staff token and returns a temporary address the page can show in a frame (the caller revokes it). */
export async function fetchBlobUrl(url) {
  const t = getAdminToken();
  const res = await fetch(url, { headers: t ? { Authorization: 'Bearer ' + t } : {} });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not open the document');
  return URL.createObjectURL(await res.blob());
}

export const mktApi = {
  get: url => call('GET', url, undefined, '/api/mkt'),
  post: (url, body) => call('POST', url, body, '/api/mkt'),
  put: (url, body) => call('PUT', url, body, '/api/mkt'),
  del: url => call('DELETE', url, undefined, '/api/mkt')
};

export const hubApi = {
  get: url => call('GET', url, undefined, '/api/hub'),
  post: (url, body) => call('POST', url, body, '/api/hub'),
  put: (url, body) => call('PUT', url, body, '/api/hub')
};

/** Server-side paged list with search/filters, the way the design's "G_*" grids work. */
export function useTable(path, initial = {}, deps = []) {
  const [params, setParams] = useState({ q: '', page: 1, size: 10, ...initial });
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
    adm.get(`${path}?${qs}`)
      .then(d => { if (id === seq.current) { setData(d); setError(''); } })
      .catch(e => { if (id === seq.current) setError(e.message); })
      .finally(() => { if (id === seq.current) setLoading(false); });
  }, [path, params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = patch => setParams(p => ({ ...p, page: 1, ...patch }));
  const go = page => setParams(p => ({ ...p, page }));
  return { params, set, go, data, loading, error, reload: load };
}

/** Serial number (SL) of row `i` on the current page of a server-paged grid: continues across pages. */
export const slNo = (t, i) => (t.params.page - 1) * t.params.size + i + 1;
export const fmtMoney = n => '৳ ' + Math.round(n || 0).toLocaleString('en-US');
export const dateF = t => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTimeF = t => (t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const STATUS_COLORS = {
  Pending: ['oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'], Confirmed: ['oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)'], Packed: ['oklch(0.95 0.03 300)', 'oklch(0.42 0.14 300)'],
  Shipped: ['oklch(0.95 0.04 200)', 'oklch(0.42 0.12 210)'], Delivered: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'], Cancelled: ['oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'],
  New: ['oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'], Scheduled: ['oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)'], 'In progress': ['oklch(0.95 0.03 300)', 'oklch(0.42 0.14 300)'], Completed: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'],
  Approved: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'], Rejected: ['oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'],
  Active: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'], Disabled: ['oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'],
  Shortlisted: ['oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)'], Interview: ['oklch(0.95 0.03 300)', 'oklch(0.42 0.14 300)'], Offered: ['oklch(0.95 0.04 200)', 'oklch(0.42 0.12 210)'], Hired: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'], Rejected: ['oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'],
  Confirmed_: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'], Unsubscribed: ['oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)']
};
