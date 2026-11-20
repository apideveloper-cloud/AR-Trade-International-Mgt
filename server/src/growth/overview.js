// Search & Growth overview (Phase 5): one read that gathers the setup state and the health of every part, and the list of things to do next.
// buildActions(data) is pure. loadOverview(deps) wraps every query so a missing table or a failing part gives a default, never an error.
import { pool } from '../db.js';

export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
export const DROP_MIN_PREV_CLICKS = 50, DROP_MIN_PERCENT = 20;

const n0 = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const iso = d => (d ? new Date(d).toISOString() : null);

/** What the overview needs from the Search Console summary, whatever the exact field names are: { connected, clicks, prevClicks, dropPercent|null, notIndexed }. */
export function searchFacts(s) {
  const x = s && typeof s === 'object' ? s : {};
  const pick = (...vals) => { for (const v of vals) if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))) return Number(v); return null; };
  const clicks = pick(x.clicks, x.cur?.clicks, x.last28?.clicks, x.current?.clicks, x.totals?.clicks, x.period?.clicks);
  const prevClicks = pick(x.prevClicks, x.previousClicks, x.prev28?.clicks, x.previous?.clicks, x.prev?.clicks, x.totalsPrev?.clicks);
  const notIndexed = pick(x.notIndexed, x.inspected?.notIndexed, x.indexing?.notIndexed, x.inspection?.notIndexed, x.index?.notIndexed, x.pagesNotIndexed) ?? 0;
  const dropPercent = clicks !== null && prevClicks !== null && prevClicks > 0 ? Math.round(((prevClicks - clicks) / prevClicks) * 100) : null;
  return { connected: x.connected === true, clicks, prevClicks, dropPercent, notIndexed };
}

/** The things to do, most serious first. data = { setup, search, health } as loadOverview returns. */
export function buildActions(data = {}) {
  const setup = data.setup || {}, health = data.health || {}, out = [];
  const add = (id, severity, title, detail, page, count = 1) => out.push({ id, severity, title, detail, page, count });
  const price = health.price?.counts || {}, schema = health.schema || {}, merchant = health.merchant || {}, reviews = health.reviews || {}, jobs = health.jobs || {}, feed = health.feed || {};
  const s = searchFacts(data.search);

  if (setup.domain !== undefined && !setup.preferredDomain) add('preferred_domain', 'high', 'Set the preferred domain', 'Google and Bing need the public address of the shop (https://...) in SEO settings.', 'seo');
  if (setup.googleConnected === false) add('connect_google', 'medium', 'Connect Google so Search Console data can load', 'Without the connection there are no clicks, impressions or indexing results here.', 'growth');

  const badPrice = n0(price.schema_price_mismatch);
  if (badPrice > 0) add('price_invalid', 'high', `${plural(badPrice, 'product has', 'products have')} an invalid price on ${badPrice === 1 ? 'its' : 'their'} page`, 'The price Google reads on the product page differs from the catalogue price.', 'growth-prices', badPrice);
  const mismatch = n0(price.schema_availability_mismatch) + n0(price.feed_price_mismatch) + n0(price.feed_availability_mismatch);
  if (mismatch > 0) add('price_feed_mismatch', 'medium', `${plural(mismatch, 'price or stock difference', 'price or stock differences')} between the catalogue and the page or feed`, 'Rebuild the feed or save the product again, then run the price check.', 'growth-prices', mismatch);
  const zero = n0(price.zero_price_active);
  if (zero > 0) add('zero_price', 'medium', `${plural(zero, 'product has', 'products have')} no price and cannot be shown in Google Shopping`, 'Set a price or make the product inactive.', 'growth-prices', zero);

  const errPages = n0(schema.pagesWithErrors ?? schema.counts?.error);
  if (errPages > 0) add('schema_errors', 'high', `${plural(errPages, 'page has', 'pages have')} structured data errors`, 'These pages cannot show rich results (price, stars, breadcrumbs) in Google.', 'growth-schema', errPages);
  const warns = n0(schema.counts?.warning);
  if (warns > 0) add('schema_warnings', 'low', `${plural(warns, 'structured data suggestion', 'structured data suggestions')}`, 'Optional fields that help Google show richer results.', 'growth-schema', warns);

  if (merchant.syncEnabled && n0(merchant.errors) > 0) add('merchant_errors', 'high', `${plural(n0(merchant.errors), 'Merchant Center product has', 'Merchant Center products have')} errors`, 'Google Merchant Center did not accept these products.', 'growth-merchant', n0(merchant.errors));
  if (feed.flagEnabled === false) add('feed_off', 'medium', 'The product feed is off', 'Switch the Merchant feed on in SEO settings so Google Shopping can read the catalogue.', 'seo');

  if (n0(jobs.failed) > 0) add('jobs_failed', 'high', `${plural(n0(jobs.failed), 'background job has', 'background jobs have')} failed`, 'Open the job list and retry or read the error.', 'growth', n0(jobs.failed));

  if (s.dropPercent !== null && s.prevClicks >= DROP_MIN_PREV_CLICKS && s.dropPercent >= DROP_MIN_PERCENT) {
    add('clicks_drop', s.dropPercent >= 40 ? 'high' : 'medium', `Search clicks dropped ${s.dropPercent}% against the previous 28 days`, `${s.clicks} clicks in the last 28 days against ${s.prevClicks} before.`, 'growth-search', s.dropPercent);
  }
  if (s.notIndexed > 0) add('not_indexed', 'medium', `${plural(s.notIndexed, 'important page is', 'important pages are')} not indexed by Google`, 'Open Search to see which pages and why.', 'growth-search', s.notIndexed);

  if (n0(reviews.pending) > 0) add('reviews_pending', 'medium', `${plural(n0(reviews.pending), 'review is', 'reviews are')} waiting for approval`, 'Approve or reject new customer reviews.', 'reviews', n0(reviews.pending));
  if (n0(reviews.whatsappWaiting) > 0) add('reviews_whatsapp', 'medium', `${plural(n0(reviews.whatsappWaiting), 'review request waits', 'review requests wait')} for you to send them on WhatsApp`, 'Open the list and press the WhatsApp button for each customer.', 'growth-reviews', n0(reviews.whatsappWaiting));

  for (const [k, name, page] of [['google', 'Google', 'growth'], ['bing', 'Bing', 'growth'], ['merchant', 'Merchant Center', 'growth-merchant']]) {
    const i = health.integrations?.[k];
    if (i && i.status === 'error') add('integration_' + k, 'medium', `The ${name} connection reports an error`, String(i.lastError || 'Test the connection again.').slice(0, 200), page);
  }

  const left = (setup.steps || []).filter(x => !x.done).length;
  if (left > 0) add('setup_left', 'low', `${plural(left, 'setup step is', 'setup steps are')} not finished`, 'Follow the setup checklist on the Search & Growth page.', 'growth', left);

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count || a.id.localeCompare(b.id));
}

// ---------- gathering ----------
const defaultQuery = async (sql, params) => (await pool.query(sql, params))[0];
async function defaultDeps() {
  const [site, siteFiles, http, auto, schema] = await Promise.all([import('./site.js'), import('./siteFiles.js'), import('./http.js'), import('../seoAutomation.js'), import('./schemaCheck.js')]);
  return {
    query: defaultQuery, readSeo: site.readSeo, siteOrigin: site.siteOrigin, readGrowth: siteFiles.readGrowth, getIntegration: http.getIntegration, hostOf: auto.hostOf,
    schemaSummary: () => schema.schemaSummary(),
    async gscSummary() { const m = await import('./gscSync.js'); return typeof m.gscSummary === 'function' ? m.gscSummary() : { connected: false }; },
    async feedStatus() { const m = await import('../seo.js'); return m.feedStatus(); }
  };
}
const safe = async (fn, dflt) => { try { const v = await fn(); return v === undefined ? dflt : v; } catch { return dflt; } };

/** The overview payload: { setup, search, health, actions, allGood }. deps are injectable for tests; every part is optional and tolerant. */
export async function loadOverview(deps) {
  const d = { ...(await defaultDeps()), ...(deps || {}) };
  const q = (sql, p) => d.query(sql, p || []);
  const [seo, g, gi, bi, origin] = await Promise.all([safe(() => d.readSeo(), {}), safe(() => d.readGrowth(), {}), safe(() => d.getIntegration('google'), {}), safe(() => d.getIntegration('bing'), {}), safe(() => d.siteOrigin(), '')]);
  const mi = await safe(() => d.getIntegration('merchant'), {});
  const host = await safe(() => d.hostOf(seo), '');

  // setup: the same six steps as the wizard of the Search & Growth page
  const flags = seo?.flags || {}, indexNowReady = !!flags.indexNow && !!seo?.indexNow?.key && !!host;
  const submitted = { google: g?.lastSubmit?.google || null, bing: g?.lastSubmit?.bing || null };
  const googleConnected = gi?.status === 'connected', bingConnected = bi?.status === 'connected';
  const googleVerified = gi?.meta?.siteVerified === true, bingVerified = !!(g?.bingAuthCode || seo?.verification?.bing);
  const preferredDomain = String(seo?.general?.preferredDomain || '');
  const setup = {
    domain: !!origin, preferredDomain, googleConnected, googleVerified, bingConnected, bingVerified, indexNowReady, sitemapSubmitted: submitted,
    steps: [
      { id: 'domain', label: 'Set the public domain', done: !!origin, page: 'seo' },
      { id: 'verify', label: 'Prove you own the site (verify)', done: googleVerified, page: 'growth' },
      { id: 'google', label: 'Connect Google', done: googleConnected, page: 'growth' },
      { id: 'bing', label: 'Connect Bing', done: bingConnected, page: 'growth' },
      { id: 'sitemap', label: 'Submit the sitemap', done: !!(submitted.google || submitted.bing), page: 'growth' },
      { id: 'indexnow', label: 'Turn on IndexNow and send all pages', done: indexNowReady, page: 'seo' }
    ]
  };

  const search = await safe(() => d.gscSummary(), { connected: false });

  // health
  const schema = await safe(() => d.schemaSummary(), { lastRun: null, counts: { error: 0, warning: 0 }, byCode: [] });
  const priceRun = (await safe(() => q('SELECT at, checked, issues, ms FROM growth_price_runs ORDER BY id DESC LIMIT 1'), []))[0];
  const counts = {};
  for (const r of await safe(() => q('SELECT code, COUNT(*) AS n FROM growth_price_issues GROUP BY code'), [])) counts[r.code] = n0(r.n);
  const price = { lastRun: priceRun ? { at: iso(priceRun.at), checked: n0(priceRun.checked), issues: n0(priceRun.issues), ms: n0(priceRun.ms) } : null, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };

  const fs = await safe(() => d.feedStatus(), null);
  const sumWarn = a => (Array.isArray(a) ? a.reduce((s, x) => s + n0(x?.count), 0) : 0);
  const feed = { flagEnabled: fs ? fs.enabled === true : flags.merchantFeed === true, itemCount: n0(fs?.items), skipped: sumWarn(fs?.skipped), warnings: sumWarn(fs?.warnings) };

  const syncEnabled = g?.merchant?.syncEnabled === true;
  const by = {};
  for (const r of await safe(() => q('SELECT status, COUNT(*) AS n FROM merchant_sync_state GROUP BY status'), [])) by[r.status] = n0(r.n);
  const merchant = { syncEnabled, errors: n0(by.Error), pending: syncEnabled ? Math.max(0, feed.itemCount - n0(by.Synced) - n0(by.Error)) : 0 };

  const one = async (sql, key) => n0((await safe(() => q(sql), []))[0]?.[key]);
  const reviews = {
    pending: await one("SELECT COUNT(*) AS n FROM reviews WHERE status = 'Pending'", 'n'),
    spam: await one("SELECT COUNT(*) AS n FROM reviews WHERE status = 'Spam'", 'n'),
    whatsappWaiting: await one("SELECT COUNT(*) AS n FROM review_requests WHERE channel = 'whatsapp' AND status = 'Queued'", 'n'),
    requestsEnabled: g?.reviewRequests?.enabled === true
  };

  const jobRows = await safe(() => q("SELECT status, COUNT(*) AS n FROM growth_jobs WHERE status IN ('Queued','Failed') GROUP BY status"), []);
  const jobs = { queued: n0(jobRows.find(r => r.status === 'Queued')?.n), failed: n0(jobRows.find(r => r.status === 'Failed')?.n) };

  const integ = i => ({ status: i?.status || 'not_connected', lastError: String(i?.last_error || ''), lastSync: iso(i?.last_sync) });
  const integrations = { google: integ(gi), bing: integ(bi), merchant: integ(mi) };

  const out = { setup, search, health: { schema, price, feed, merchant, reviews, jobs, integrations } };
  out.actions = buildActions(out);
  out.allGood = out.actions.length === 0;
  return out;
}
