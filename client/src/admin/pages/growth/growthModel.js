import { adm } from '../../adminApi.js';
import { fDateTime } from '../../fieldKit.jsx';

export const NO_CONNECT_NOTE = 'Only the Master Admin or Admin can connect services.';

/** Runs a POST/GET and always returns { ok, data, error } (never throws), so a screen can show the plain message. */
export async function run(method, url, body) {
  try { return { ok: true, data: await (method === 'GET' ? adm.get(url) : adm.post(url, body || {})) }; } catch (e) { return { ok: false, data: null, error: e.message || 'Something went wrong. Please try again.' }; }
}

/** tr is optional: pass it from a component to get 'Never' in the chosen language. */
export const when = (iso, tr) => (iso ? fDateTime(iso) : tr ? tr('Never') : 'Never');

/** 'ok' | 'err' | 'off' for the coloured dot. */
export const toneOf = st => (st === 'connected' ? 'ok' : st === 'error' ? 'err' : 'off');
export const LABEL = { ok: 'Connected', err: 'Error', off: 'Not connected' };

/** Wizard steps with done flags, computed from GET /growth/status. */
/** tr = the translate function of the component (optional). */
export function stepsOf(s, tr = x => x) {
  const g = s.google || {}, b = s.bing || {}, n = s.indexNow || {};
  const sent = g.sitemapSubmittedAt || b.sitemapSubmittedAt;
  return [
    { key: 'domain', done: !!s.siteUrl, title: tr('Set the public domain'), fix: s.siteUrl ? tr('Domain: {d}', { d: s.siteUrl }) : tr('Open SEO > Settings > General and type the Preferred domain (for example https://artradeinternational.com), then Save.'), goto: 'seo' },
    { key: 'verify', done: !!g.siteVerified, title: tr('Prove you own the site (verify)'), fix: g.siteVerified ? tr('Google has confirmed the site.') : tr('Google: press "Verify site by HTML file" in the Google section below. Bing: put the BingSiteAuth code in "Verify by file" below (or use the tag in SEO > Settings > Verification).'), anchor: 'adgr-verify' },
    { key: 'google', done: g.status === 'connected', title: tr('Connect Google'), fix: g.status === 'connected' ? (g.account ? tr('Connected as {a}.', { a: g.account }) : tr('Connected.')) : !g.clientIdSet || !g.clientSecret?.set ? tr('Save the Google client ID and secret first (see "How to get them"), then press Connect Google.') : tr('Press Connect Google and allow access with your Google account.'), anchor: 'adgr-google', needsKey: true },
    { key: 'bing', done: b.status === 'connected', title: tr('Connect Bing'), fix: b.status === 'connected' ? tr('Bing is connected.') : tr('Paste the Bing API key in the Bing section below and press Save, then Test.'), anchor: 'adgr-bing', needsKey: true },
    { key: 'sitemap', done: !!sent, title: tr('Submit the sitemap'), fix: sent ? tr('Sitemap was sent.') : tr('Press "Submit to both" in the Sitemap section below.'), anchor: 'adgr-sitemap' },
    { key: 'indexnow', done: !!n.ready, title: tr('Turn on IndexNow and send all pages'), fix: n.ready ? tr('IndexNow is ready. Use Submit all pages in SEO > Settings > Automation if you have not yet.') : !n.enabled ? tr('Switch IndexNow on in SEO > Settings > Automation.') : !n.keySet ? tr('Press Generate key in SEO > Settings > Automation.') : tr('Set the public domain first.'), goto: 'seo' }
  ];
}
