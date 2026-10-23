import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'ar_admin_token';
export const getAdminToken = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const setAdminToken = t => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = fn => { onUnauthorized = fn; };

async function call(method, url, body, base = '/api/admin') {
  const headers = { 'Content-Type': 'application/json' };
  const t = getAdminToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && t) onUnauthorized();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
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

export const fmtMoney = n => '৳ ' + Math.round(n || 0).toLocaleString('en-US');
export const ago = t => {
  const m = Math.floor((Date.now() - new Date(t)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  if (m < 1440) return Math.floor(m / 60) + ' h ago';
  return Math.floor(m / 1440) + ' d ago';
};
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
