// Google OAuth2 + Search Console + Site Verification, hand-rolled on callApi (no googleapis package). Client id / secret and the refresh
// token live in the vault; the access token is kept in memory only. API helpers return { ok, ..., error } and never throw.
import jwt from 'jsonwebtoken';
import { secret } from '../util.js';
import { callApi, setIntegration } from './http.js';
import { getSecret } from './vault.js';

export const SCOPES = ['https://www.googleapis.com/auth/webmasters', 'https://www.googleapis.com/auth/siteverification'];
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const WM = 'https://www.googleapis.com/webmasters/v3/sites';
const SV = 'https://www.googleapis.com/siteVerification/v1';
const REVOKED = 'Google access was removed or has expired. Connect Google again.';

let cache = { token: '', exp: 0 };
export const clearTokenCache = () => { cache = { token: '', exp: 0 }; };

export const signState = staffId => jwt.sign({ sid: staffId, p: 'growth-google' }, secret(), { expiresIn: '10m' });
/** The staff id inside a valid state, or 0. */
export function readState(state) { try { const t = jwt.verify(String(state || ''), secret()); return t.p === 'growth-google' ? Number(t.sid) || 0 : 0; } catch { return 0; } }

export async function authUrl(state, redirectUri) {
  const p = new URLSearchParams({ client_id: await getSecret('google.clientId'), redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
}

const form = o => ({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });

/** Trades the one-time code for tokens. Returns { ok, refreshToken, error }; the refresh token is NOT saved here. */
export async function exchangeCode(code, redirectUri) {
  const [client_id, client_secret] = await Promise.all([getSecret('google.clientId'), getSecret('google.clientSecret')]);
  if (!client_id || !client_secret) return { ok: false, error: 'Save the Google client ID and secret first.' };
  const r = await callApi({ integration: 'google', action: 'exchange_code', url: TOKEN_URL, method: 'POST', retries: 1, ...form({ code, client_id, client_secret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
  if (!r.ok) return { ok: false, error: r.error || 'Google did not accept the code' };
  if (!r.data?.refresh_token) return { ok: false, error: 'Google did not return long-term access. Remove AR Trade from your Google account permissions and connect again.' };
  if (r.data.access_token) cache = { token: r.data.access_token, exp: Date.now() + (Number(r.data.expires_in) || 3600) * 1000 };
  return { ok: true, refreshToken: r.data.refresh_token };
}

/** A valid access token (refreshed when within 60 s of expiry). Throws Error with a plain message when Google access is gone. */
export async function accessToken() {
  if (cache.token && Date.now() < cache.exp - 60000) return cache.token;
  const [refresh_token, client_id, client_secret] = await Promise.all([getSecret('google.refreshToken'), getSecret('google.clientId'), getSecret('google.clientSecret')]);
  if (!refresh_token || !client_id || !client_secret) throw new Error('Google is not connected.');
  const r = await callApi({ integration: 'google', action: 'refresh_token', url: TOKEN_URL, method: 'POST', retries: 2, ...form({ refresh_token, client_id, client_secret, grant_type: 'refresh_token' }) });
  if (!r.ok) {
    if (['invalid_grant', 'invalid_client', 'unauthorized_client'].includes(r.data?.error)) {
      clearTokenCache();
      await setIntegration('google', { status: 'error', last_error: REVOKED }).catch(() => {});
      throw new Error(REVOKED);
    }
    throw new Error(r.error || 'Could not reach Google');
  }
  cache = { token: r.data.access_token, exp: Date.now() + (Number(r.data.expires_in) || 3600) * 1000 };
  return cache.token;
}

async function api(action, url, method = 'GET', body) {
  let tok; try { tok = await accessToken(); } catch (e) { return { ok: false, status: 0, data: null, error: e.message }; }
  const headers = { Authorization: 'Bearer ' + tok, ...(body ? { 'Content-Type': 'application/json' } : {}) };
  const r = await callApi({ integration: 'google', action, url, method, headers, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) clearTokenCache(); // the next call refreshes
  return r;
}
const enc = encodeURIComponent;

export async function listSites() {
  const r = await api('list_sites', WM);
  return r.ok ? { ok: true, sites: (r.data?.siteEntry || []).map(s => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel })) } : { ok: false, sites: [], error: r.error };
}
export async function submitSitemap(siteUrl, feedUrl) {
  const r = await api('submit_sitemap', `${WM}/${enc(siteUrl)}/sitemaps/${enc(feedUrl)}`, 'PUT');
  return { ok: r.ok, status: r.status, error: r.ok ? '' : r.error };
}
export async function getSitemap(siteUrl, feedUrl) {
  const r = await api('get_sitemap', `${WM}/${enc(siteUrl)}/sitemaps/${enc(feedUrl)}`);
  return r.ok ? { ok: true, sitemap: r.data } : { ok: false, error: r.error };
}
export async function siteVerificationToken(siteUrl) {
  const r = await api('verification_token', SV + '/token', 'POST', { site: { type: 'SITE', identifier: siteUrl }, verificationMethod: 'FILE' });
  return r.ok && r.data?.token ? { ok: true, token: r.data.token } : { ok: false, error: r.error || 'Google gave no verification file' };
}
export async function verifySite(siteUrl) {
  const r = await api('verify_site', SV + '/webResource?verificationMethod=FILE', 'POST', { site: { type: 'SITE', identifier: siteUrl } });
  return { ok: r.ok, error: r.ok ? '' : r.error };
}
