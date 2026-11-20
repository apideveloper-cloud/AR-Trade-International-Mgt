// Search Console API calls (Search Analytics, URL Inspection, sitemap status) on callApi, integration 'gsc'. Every function returns
// { ok, status, data, error } and never throws. The existing Google connection already has the webmasters scope.
import { accessToken, getSitemap } from './google.js';
import { callApi, getIntegration, setIntegration } from './http.js';
import { pickProperty } from './gscMap.js';

const SA = 'https://www.googleapis.com/webmasters/v3/sites';
const INSPECT = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

async function post(action, url, body, retries) {
  let tok; try { tok = await accessToken(); } catch (e) { return { ok: false, status: 0, data: null, error: e.message }; }
  try {
    const r = await callApi({ integration: 'gsc', action, url, method: 'POST', retries, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, data: r.data, error: r.ok ? '' : r.error };
  } catch (e) { return { ok: false, status: 0, data: null, error: String(e.message || e) }; }
}

/** opts: { startDate, endDate, dimensions, rowLimit, startRow, dimensionFilterGroups? } (dates 'YYYY-MM-DD'). data.rows = [{ keys, clicks, impressions, ctr, position }]. */
export function searchAnalytics(siteUrl, opts = {}) {
  const { startDate, endDate, dimensions, rowLimit, startRow, dimensionFilterGroups } = opts;
  const body = { startDate, endDate, dimensions: dimensions || [], rowLimit: rowLimit || 1000, startRow: startRow || 0 };
  if (dimensionFilterGroups) body.dimensionFilterGroups = dimensionFilterGroups;
  return post('search_analytics', `${SA}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, body, 2);
}
/** data.inspectionResult.indexStatusResult has verdict, coverageState, robotsTxtState, indexingState, lastCrawlTime, pageFetchState, googleCanonical, userCanonical. */
export function inspectUrl(siteUrl, inspectionUrl) {
  return post('inspect_url', INSPECT, { inspectionUrl, siteUrl, languageCode: 'en-US' }, 1);
}
/** Pure: a sitemap resource -> { submitted, indexed (null when Google gives no count), lastDownloaded, errors, warnings, isPending }. */
export function sitemapSummary(sm) {
  const c = Array.isArray(sm?.contents) ? sm.contents : [];
  const sum = k => (c.some(x => x[k] !== undefined) ? c.reduce((a, x) => a + (Number(x[k]) || 0), 0) : null);
  return { submitted: sum('submitted'), indexed: sum('indexed'), lastDownloaded: sm?.lastDownloaded || null, errors: Number(sm?.errors) || 0, warnings: Number(sm?.warnings) || 0, isPending: !!sm?.isPending };
}
export async function getSitemapStatus(siteUrl, feedUrl) {
  try {
    const r = await getSitemap(siteUrl, feedUrl);
    return r.ok ? { ok: true, status: 200, data: sitemapSummary(r.sitemap), error: '' } : { ok: false, status: 0, data: null, error: r.error || 'Could not read the sitemap status' };
  } catch (e) { return { ok: false, status: 0, data: null, error: String(e.message || e) }; }
}

const defaultDeps = { async listSites() { return (await import('./google.js')).listSites(); }, async siteOrigin() { return (await import('./site.js')).siteOrigin(); }, getIntegration, setIntegration };
/** The Search Console property of the public site ('https://host/' or 'sc-domain:host'), cached in the google integration meta (gscSite); '' when none matches. */
export async function resolveSiteUrl({ deps = {} } = {}) {
  const d = { ...defaultDeps, ...deps };
  try {
    const origin = await d.siteOrigin();
    if (!origin) return '';
    const host = new URL(origin).host.toLowerCase();
    const meta = (await d.getIntegration('google')).meta || {};
    if (meta.gscSite && meta.gscSiteHost === host) return meta.gscSite;
    const l = await d.listSites();
    if (!l.ok) return '';
    const site = pickProperty(l.sites, host);
    if (site) await d.setIntegration('google', { meta: { ...meta, gscSite: site, gscSiteHost: host } });
    return site;
  } catch { return ''; }
}
