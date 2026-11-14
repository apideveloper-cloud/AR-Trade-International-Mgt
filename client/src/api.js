
// The customer session is an HttpOnly cookie set by the server (JavaScript can't read it). This flag only remembers
// that someone is signed in, so the app knows whether to ask the server "who am I?" on load.
const FLAG = 'ar_signed_in';
export const getToken = () => { try { return localStorage.getItem(FLAG); } catch { return null; } };
export const setToken = on => { try { on ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch { /* storage unavailable */ } };

async function call(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  let res;
  try {
    res = await fetch('/api' + url, { method, headers, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw Object.assign(e instanceof Error ? e : new Error('Network error'), { status: 0 }); // offline / DNS / CORS: same shape as an HTTP error
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
  return data;
}

const get = url => call('GET', url);
const write = (method, url, body) => call(method, url, body);

export const api = {
  get,
  post: (url, body) => write('POST', url, body),
  put: (url, body) => write('PUT', url, body)
};

/** Copies text to the clipboard; resolves true/false and never rejects (the Clipboard API is missing or refused on plain http and some browsers). */
export const copyText = text => { try { return Promise.resolve(navigator.clipboard.writeText(text)).then(() => true, () => false); } catch { return Promise.resolve(false); } };
export const fmt = n => '৳ ' + Math.round(n || 0).toLocaleString('en-US');
export const fmtDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const offPct = p => (p.old && p.price ? Math.round((1 - p.price / p.old) * 100) : 0);
export const tk = (s, site) => String(s == null ? '' : s)
  .replace(/\{fmt (\w+)\}/g, (_, k) => (site[k] ? fmt(site[k]) : 'free'))
  .replace(/\{(\w+)\}/g, (m, k) => (site[k] != null ? site[k] : m));
export const waLink = (site, text) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
