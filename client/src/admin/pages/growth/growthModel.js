import { adm } from '../../adminApi.js';
import { fDateTime } from '../../fieldKit.jsx';

export const NO_CONNECT_NOTE = 'Only the Master Admin or Admin can connect services.';

/** Runs a POST/GET and always returns { ok, data, error } (never throws), so a screen can show the plain message. */
export async function run(method, url, body) {
  try { return { ok: true, data: await (method === 'GET' ? adm.get(url) : adm.post(url, body || {})) }; } catch (e) { return { ok: false, data: null, error: e.message || 'Something went wrong. Please try again.' }; }
}

export const when = iso => (iso ? fDateTime(iso) : 'Never');

/** 'ok' | 'err' | 'off' for the coloured dot. */
export const toneOf = st => (st === 'connected' ? 'ok' : st === 'error' ? 'err' : 'off');
export const LABEL = { ok: 'Connected', err: 'Error', off: 'Not connected' };

/** Wizard steps with done flags, computed from GET /growth/status. */
export function stepsOf(s) {
  const g = s.google || {}, b = s.bing || {}, n = s.indexNow || {};
  const sent = g.sitemapSubmittedAt || b.sitemapSubmittedAt;
  return [
    { key: 'domain', done: !!s.siteUrl, title: 'Set the public domain', fix: s.siteUrl ? 'Domain: ' + s.siteUrl : 'Open SEO > Settings > General and type the Preferred domain (for example https://artradeinternational.com), then Save.', goto: 'seo' },
    { key: 'verify', done: !!g.siteVerified, title: 'Prove you own the site (verify)', fix: g.siteVerified ? 'Google has confirmed the site.' : 'Google: press "Verify site by HTML file" in the Google section below. Bing: put the BingSiteAuth code in "Verify by file" below (or use the tag in SEO > Settings > Verification).', anchor: 'adgr-verify' },
    { key: 'google', done: g.status === 'connected', title: 'Connect Google', fix: g.status === 'connected' ? 'Connected' + (g.account ? ' as ' + g.account : '') + '.' : !g.clientIdSet || !g.clientSecret?.set ? 'Save the Google client ID and secret first (see "How to get them"), then press Connect Google.' : 'Press Connect Google and allow access with your Google account.', anchor: 'adgr-google', needsKey: true },
    { key: 'bing', done: b.status === 'connected', title: 'Connect Bing', fix: b.status === 'connected' ? 'Bing is connected.' : 'Paste the Bing API key in the Bing section below and press Save, then Test.', anchor: 'adgr-bing', needsKey: true },
    { key: 'sitemap', done: !!sent, title: 'Submit the sitemap', fix: sent ? 'Sitemap was sent.' : 'Press "Submit to both" in the Sitemap section below.', anchor: 'adgr-sitemap' },
    { key: 'indexnow', done: !!n.ready, title: 'Turn on IndexNow and send all pages', fix: n.ready ? 'IndexNow is ready. Use Submit all pages in SEO > Settings > Automation if you have not yet.' : !n.enabled ? 'Switch IndexNow on in SEO > Settings > Automation.' : !n.keySet ? 'Press Generate key in SEO > Settings > Automation.' : 'Set the public domain first.', goto: 'seo' }
  ];
}
