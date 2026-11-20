// Sends the sitemap address to Google Search Console and Bing Webmaster, records the outcome (integration_logs via callApi, plus the
// status cards and growth settings) and answers per engine { ok, error, skipped }.
import { getIntegration, setIntegration } from './http.js';
import { getSecret } from './vault.js';
import { siteOrigin } from './site.js';
import { readGrowth, saveGrowth } from './siteFiles.js';
import * as google from './google.js';
import * as bing from './bing.js';

export const ENGINES = ['google', 'bing'];
/** Pure: why an engine is skipped ('' when it can be used). */
export function shouldSkip(engine, { googleConnected, bingKey }) {
  if (engine === 'google') return googleConnected ? '' : 'Google is not connected.';
  if (engine === 'bing') return bingKey ? '' : 'The Bing API key is not set.';
  return 'Unknown search engine.';
}

export async function submitSitemapAll({ engines } = {}) {
  const origin = await siteOrigin();
  if (!origin) throw new Error('Set the preferred domain (https://...) in SEO settings first.');
  const want = (Array.isArray(engines) && engines.length ? engines : ENGINES).filter(e => ENGINES.includes(e));
  const feedUrl = origin + '/sitemap.xml';
  const [gi, refresh, bingKey] = await Promise.all([getIntegration('google'), getSecret('google.refreshToken'), getSecret('bing.apiKey')]);
  const state = { googleConnected: gi.status !== 'not_connected' && !!refresh, bingKey: !!bingKey };
  const results = {}, sent = {};
  for (const e of want) {
    const why = shouldSkip(e, state);
    if (why) { results[e] = { ok: false, skipped: true, error: why }; continue; }
    const r = e === 'google' ? await google.submitSitemap(origin + '/', feedUrl) : await bing.submitSitemap(origin, feedUrl);
    results[e] = { ok: !!r.ok, skipped: false, error: r.ok ? '' : r.error || 'Failed' };
    if (r.ok) { sent[e] = new Date().toISOString(); await setIntegration(e, { status: 'connected', last_sync: new Date(), last_error: '' }).catch(() => {}); }
    else if ((await getIntegration(e)).status !== 'error') await setIntegration(e, { last_error: results[e].error }).catch(() => {}); // an 'error' status keeps its own (clearer) message
  }
  if (Object.keys(sent).length) { const g = await readGrowth(); await saveGrowth({ lastSubmit: { ...(g.lastSubmit || {}), ...sent } }); }
  return results;
}
