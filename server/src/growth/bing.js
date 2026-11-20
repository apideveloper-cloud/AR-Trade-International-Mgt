// Bing Webmaster API on callApi. The API key travels in the query string (that is how Bing works); callApi logs host + path only,
// and any error text is scrubbed of the key before it leaves this file.
import { callApi } from './http.js';
import { getSecret } from './vault.js';

const BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

async function call(action, name, method, body) {
  const key = await getSecret('bing.apiKey');
  if (!key) return { ok: false, status: 0, data: null, error: 'Save the Bing API key first.' };
  const r = await callApi({ integration: 'bing', action, url: `${BASE}/${name}?apikey=${encodeURIComponent(key)}`, method, headers: body ? { 'Content-Type': 'application/json; charset=utf-8' } : undefined, body: body ? JSON.stringify(body) : undefined });
  // Bing reports errors as { ErrorCode, Message }
  const error = r.ok ? '' : String(r.data?.Message || r.error || 'Bing did not accept the request').split(key).join('***').slice(0, 300);
  return { ...r, error };
}
export async function getUserSites() {
  const r = await call('get_user_sites', 'GetUserSites', 'GET');
  return r.ok ? { ok: true, sites: (r.data?.d || []).map(s => ({ url: s.Url, verified: !!s.IsVerified })) } : { ok: false, sites: [], error: r.error };
}
export async function submitSitemap(siteUrl, feedUrl) {
  const r = await call('submit_feed', 'SubmitFeed', 'POST', { siteUrl, feedUrl });
  return { ok: r.ok, status: r.status, error: r.error };
}
