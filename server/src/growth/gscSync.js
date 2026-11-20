// Search Console sync (daily totals, top queries / pages) and URL Inspection (index status of every public page). Tables are created lazily
// (ensureGsc). All outside dependencies are injectable (deps) so tests never touch the database or Google. Handlers return
// { skipped: true, reason } when not ready, throw on quota (the job retries later) and stop with a 'Reconnect Google' error on 401 / 403.
import { pool } from '../db.js';
import { getIntegration, setIntegration } from './http.js';
import * as api from './gscApi.js';
import {
  BATCH_LIMIT, DAILY_LIMIT, NOT_ADDED, addDays, buildProductMap, classifyFull, deltas, dhakaDayStart, mapInspection, onOrigin, orderUrls,
  productIdForUrl, selectBatch, totals, urlHash, windows
} from './gscMap.js';

export { DAILY_LIMIT, BATCH_LIMIT, NOT_ADDED };
let ready = false;
export async function ensureGsc() {
  if (ready) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS gsc_daily (
    day DATE NOT NULL PRIMARY KEY, clicks INT NOT NULL DEFAULT 0, impressions INT NOT NULL DEFAULT 0, ctr DOUBLE NOT NULL DEFAULT 0, position DOUBLE NOT NULL DEFAULT 0, synced_at DATETIME NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gsc_top (
    kind VARCHAR(8) NOT NULL, period VARCHAR(5) NOT NULL, rank_no SMALLINT NOT NULL, key_text VARCHAR(500) NOT NULL DEFAULT '', clicks INT NOT NULL DEFAULT 0,
    impressions INT NOT NULL DEFAULT 0, ctr DOUBLE NOT NULL DEFAULT 0, position DOUBLE NOT NULL DEFAULT 0, PRIMARY KEY (kind, period, rank_no))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gsc_inspections (
    url_hash CHAR(40) NOT NULL PRIMARY KEY, url VARCHAR(500) NOT NULL, product_id INT NULL, verdict VARCHAR(20) NOT NULL DEFAULT '', coverage_state VARCHAR(160) NOT NULL DEFAULT '',
    indexing_state VARCHAR(60) NOT NULL DEFAULT '', robots_state VARCHAR(40) NOT NULL DEFAULT '', fetch_state VARCHAR(40) NOT NULL DEFAULT '', last_crawl DATETIME NULL,
    google_canonical VARCHAR(500) NOT NULL DEFAULT '', user_canonical VARCHAR(500) NOT NULL DEFAULT '', error VARCHAR(300) NOT NULL DEFAULT '', inspected_at DATETIME NULL, requested_at DATETIME NULL,
    KEY idx_gi_product (product_id), KEY idx_gi_when (inspected_at))`);
  ready = true;
}

/** The database side, replaceable in tests. */
export const dbStore = {
  async upsertDaily(rows) {
    await ensureGsc();
    for (const r of rows) await pool.query('INSERT INTO gsc_daily (day, clicks, impressions, ctr, position, synced_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE clicks = VALUES(clicks), impressions = VALUES(impressions), ctr = VALUES(ctr), position = VALUES(position), synced_at = VALUES(synced_at)', [r.day, r.clicks, r.impressions, r.ctr, r.position, r.syncedAt]);
  },
  async replaceTop(kind, period, rows) {
    await ensureGsc();
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      await c.query('DELETE FROM gsc_top WHERE kind = ? AND period = ?', [kind, period]);
      let n = 0;
      for (const r of rows) await c.query('INSERT INTO gsc_top (kind, period, rank_no, key_text, clicks, impressions, ctr, position) VALUES (?,?,?,?,?,?,?,?)', [kind, period, ++n, r.key, r.clicks, r.impressions, r.ctr, r.position]);
      await c.commit();
    } catch (e) { await c.rollback().catch(() => {}); throw e; } finally { c.release(); }
  },
  async daily(fromDay) { await ensureGsc(); const [r] = await pool.query("SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, clicks, impressions, ctr, position FROM gsc_daily WHERE day >= ? ORDER BY day", [fromDay]); return r; },
  async top(kind, period) { await ensureGsc(); const [r] = await pool.query('SELECT key_text AS `key`, clicks, impressions, ctr, position FROM gsc_top WHERE kind = ? AND period = ? ORDER BY rank_no', [kind, period]); return r; },
  async inspected() { await ensureGsc(); const [r] = await pool.query('SELECT url_hash, inspected_at FROM gsc_inspections WHERE inspected_at IS NOT NULL'); return new Map(r.map(x => [x.url_hash, x.inspected_at])); },
  async countSince(d) { await ensureGsc(); const [r] = await pool.query('SELECT COUNT(*) AS n FROM gsc_inspections WHERE inspected_at >= ?', [d]); return Number(r[0].n) || 0; },
  async saveInspection(x) {
    await ensureGsc();
    await pool.query('INSERT INTO gsc_inspections (url_hash, url, product_id, verdict, coverage_state, indexing_state, robots_state, fetch_state, last_crawl, google_canonical, user_canonical, error, inspected_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE url = VALUES(url), product_id = VALUES(product_id), verdict = VALUES(verdict), coverage_state = VALUES(coverage_state), indexing_state = VALUES(indexing_state), robots_state = VALUES(robots_state), fetch_state = VALUES(fetch_state), last_crawl = VALUES(last_crawl), google_canonical = VALUES(google_canonical), user_canonical = VALUES(user_canonical), error = VALUES(error), inspected_at = VALUES(inspected_at)',
      [urlHash(x.url), x.url, x.productId || null, x.verdict, x.coverageState, x.indexingState, x.robotsState, x.fetchState, x.lastCrawl, x.googleCanonical, x.userCanonical, '', x.inspectedAt]);
  },
  /** A failed inspection keeps the earlier result and only records the error and the time. */
  async saveError(x) {
    await ensureGsc();
    await pool.query('INSERT INTO gsc_inspections (url_hash, url, product_id, error, inspected_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE error = VALUES(error), inspected_at = VALUES(inspected_at), product_id = VALUES(product_id)', [urlHash(x.url), x.url, x.productId || null, String(x.error || '').slice(0, 300), x.inspectedAt]);
  },
  async setRequested(url, productId, at) {
    await ensureGsc();
    await pool.query('INSERT INTO gsc_inspections (url_hash, url, product_id, requested_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE requested_at = VALUES(requested_at)', [urlHash(url), url, productId || null, at]);
  },
  async all() {
    await ensureGsc();
    const [r] = await pool.query('SELECT url, product_id, verdict, coverage_state, indexing_state, last_crawl, google_canonical, user_canonical, error, inspected_at, requested_at FROM gsc_inspections');
    return r;
  },
  async one(url) { await ensureGsc(); const [r] = await pool.query('SELECT * FROM gsc_inspections WHERE url_hash = ?', [urlHash(url)]); return r[0] || null; }
};

const defaults = {
  store: dbStore, api,
  getIntegration, setIntegration,
  async connected() { return (await getIntegration('google')).status === 'connected'; },
  async siteUrl() { return api.resolveSiteUrl(); },
  async cachedSiteUrl() { const m = (await getIntegration('google')).meta || {}; return m.gscSite || ''; },
  async origin() { return (await import('./site.js')).siteOrigin(); },
  async sitemapUrls() { return (await import('../seo.js')).sitemapUrls(); },
  async products() { const [r] = await pool.query('SELECT id, name, slug FROM products'); return r; },
  now: () => Date.now()
};

const msg = r => String(r.error || 'HTTP ' + r.status).slice(0, 300);
const quotaText = r => r.status === 429 || /quota|rate limit|too many requests/i.test(String(r.error || ''));
const quota = () => Object.assign(new Error('Search Console quota reached, will retry later'), { quota: true });

/** Shared gate: { skipped, reason } or { siteUrl }. */
async function gate(d) {
  if (!(await d.connected())) return { skipped: true, reason: 'Google is not connected' };
  const siteUrl = await d.siteUrl();
  if (!siteUrl) return { skipped: true, reason: NOT_ADDED };
  return { siteUrl };
}
async function authStop(d, r) { await d.setIntegration('gsc', { status: 'error', last_error: 'Reconnect Google' }); return { stopped: 'Reconnect Google', status: r.status }; }

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const metric = r => ({ clicks: Math.round(num(r.clicks)), impressions: Math.round(num(r.impressions)), ctr: num(r.ctr), position: num(r.position) });

export async function runGscSync({ now, deps = {} } = {}) {
  const d = { ...defaults, ...deps };
  const g = await gate(d);
  if (g.skipped) return g;
  const t = now ?? d.now(), w = windows(t), at = new Date(t);
  const out = { days: 0, queries: 0, pages: 0 };
  const call = async o => {
    const r = await d.api.searchAnalytics(g.siteUrl, o);
    if (r.ok) return r;
    if (quotaText(r)) throw quota();
    if (r.status === 401 || r.status === 403) return { auth: await authStop(d, r) };
    throw new Error(msg(r));
  };
  const daily = await call({ ...w.daily, dimensions: ['date'], rowLimit: 1000 });
  if (daily.auth) return { ...out, ...daily.auth };
  const days = (daily.data?.rows || []).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.keys?.[0] || '')).map(r => ({ day: r.keys[0], ...metric(r), syncedAt: at }));
  await d.store.upsertDaily(days);
  out.days = days.length;
  for (const kind of ['query', 'page']) {
    for (const period of ['cur', 'prev']) {
      const r = await call({ ...w[period], dimensions: [kind], rowLimit: 100 });
      if (r.auth) return { ...out, ...r.auth };
      const rows = (r.data?.rows || []).filter(x => x.keys?.[0]).slice(0, 100).map(x => ({ key: String(x.keys[0]).slice(0, 500), ...metric(x) }));
      await d.store.replaceTop(kind, period, rows);
      if (period === 'cur') out[kind === 'query' ? 'queries' : 'pages'] = rows.length;
    }
  }
  await d.setIntegration('gsc', { status: 'connected', last_sync: new Date(t), last_error: '', account: g.siteUrl });
  return out;
}

const zero = () => ({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
const nulls = () => ({ clicks: null, impressions: null, ctr: null, position: null });
/** The URLs of the public site: home + sitemap pages moved onto the public origin, product pages first. */
export async function siteUrls(d) {
  const origin = await d.origin();
  if (!origin) return [];
  const list = await d.sitemapUrls().catch(() => []);
  return orderUrls([origin + '/', ...list.map(u => onOrigin(u, origin))].filter(Boolean));
}
/** Every known page with its stored inspection (or null): [{ url, row }], listed pages first (product pages first), then inspected pages not in the list. */
export async function inspectionOverview(deps = {}) {
  const d = { ...defaults, ...deps };
  const [urls, rows, products] = await Promise.all([siteUrls(d).catch(() => []), d.store.all(), d.products().catch(() => [])]);
  const byUrl = new Map(rows.map(r => [r.url, r]));
  const map = buildProductMap(products), names = new Map(products.map(p => [Number(p.id), p.name]));
  const out = urls.map(url => ({ url, row: byUrl.get(url) || null }));
  const listed = new Set(urls);
  for (const r of rows) if (!listed.has(r.url)) out.push({ url: r.url, row: r });
  return out.map(({ url, row }) => {
    const productId = Number(row?.product_id) || productIdForUrl(url, map) || null;
    return { url, row, productId, productName: productId ? names.get(productId) || '' : '', never: !row || !row.inspected_at };
  });
}

/** Counts for the Overview and the index health page. */
export function inspectionCounts(list) {
  const c = { indexed: 0, notIndexed: 0, unknown: 0, neverInspected: 0, total: list.length };
  for (const x of list) {
    if (x.never) { c.neverInspected++; continue; }
    const k = classifyFull({ verdict: x.row.verdict, coverageState: x.row.coverage_state }).classification;
    if (k === 'indexed') c.indexed++; else if (k === 'not_indexed') c.notIndexed++; else c.unknown++;
  }
  return c;
}

/** { connected, siteUrl, lastSyncAt, cur, prev, delta, inspected } for the Overview. Never throws; connected:false with zeros when not connected or empty. */
export async function gscSummary({ now, deps = {} } = {}) {
  const empty = { connected: false, siteUrl: '', lastSyncAt: null, cur: zero(), prev: zero(), delta: nulls(), inspected: { total: 0, indexed: 0, notIndexed: 0, unknown: 0, neverInspected: 0 } };
  try {
    const d = { ...defaults, ...deps };
    if (!(await d.connected())) return empty;
    const siteUrl = await d.cachedSiteUrl();
    if (!siteUrl) return empty;
    const w = windows(now ?? d.now());
    const [daily, gi, list] = await Promise.all([d.store.daily(w.prev.startDate), d.getIntegration('gsc'), inspectionOverview(deps).catch(() => [])]);
    const inRange = (a, b) => daily.filter(r => r.day >= a && r.day <= b);
    const cur = totals(inRange(w.cur.startDate, w.cur.endDate)), prev = totals(inRange(w.prev.startDate, w.prev.endDate));
    const c = inspectionCounts(list);
    return { connected: true, siteUrl, lastSyncAt: gi.last_sync ? new Date(gi.last_sync).toISOString() : null, cur, prev, delta: deltas(cur, prev), inspected: { total: c.total, indexed: c.indexed, notIndexed: c.notIndexed, unknown: c.unknown, neverInspected: c.neverInspected } };
  } catch { return empty; }
}

/** Inspects one URL and stores the answer: { ok, row } | { ok:false, status, error, quota?, auth? }. */
async function inspectAndStore(d, siteUrl, url, map, t) {
  const productId = productIdForUrl(url, map) || null, at = new Date(t);
  const r = await d.api.inspectUrl(siteUrl, url);
  if (r.ok) {
    const m = mapInspection(r.data);
    await d.store.saveInspection({ url, productId, ...m, inspectedAt: at });
    return { ok: true, row: { url, productId, ...m, error: '', inspectedAt: at } };
  }
  if (quotaText(r)) return { ok: false, quota: true, status: r.status, error: msg(r) };
  if (r.status === 401 || r.status === 403) return { ok: false, auth: true, status: r.status, error: msg(r) };
  await d.store.saveError({ url, productId, error: msg(r), inspectedAt: at });
  return { ok: false, status: r.status, error: msg(r) };
}

/** Inspects a rotating batch (never more than 60 per run and 400 per day). */
export async function runGscInspect({ now, limit = BATCH_LIMIT, deps = {} } = {}) {
  const d = { ...defaults, ...deps };
  const g = await gate(d);
  if (g.skipped) return g;
  const t = now ?? d.now();
  const used = await d.store.countSince(dhakaDayStart(t));
  const urls = await siteUrls(d);
  if (!urls.length) return { skipped: true, reason: 'No public pages to inspect (set the preferred domain first)' };
  const batch = selectBatch(urls, await d.store.inspected(), { limit, usedToday: used, now: t });
  const out = { inspected: 0, errors: 0, usedToday: used, candidates: urls.length };
  if (!batch.length) return { ...out, reason: used >= DAILY_LIMIT ? 'Daily inspection limit reached' : 'Everything was inspected recently' };
  const map = buildProductMap(await d.products().catch(() => []));
  for (const url of batch) {
    const r = await inspectAndStore(d, g.siteUrl, url, map, d.now());
    if (r.quota) throw quota();
    if (r.auth) return { ...out, ...(await authStop(d, r)) };
    if (r.ok) out.inspected++; else out.errors++;
    out.usedToday++;
  }
  await d.setIntegration('gsc', { status: 'connected', last_sync: new Date(t), last_error: '', account: g.siteUrl });
  return out;
}

/** Inspects one address now (route use). Throws Error with .status for the caller; returns { row, siteUrl }. */
export async function inspectNow(url, { deps = {} } = {}) {
  const d = { ...defaults, ...deps };
  const g = await gate(d);
  if (g.skipped) throw Object.assign(new Error(g.reason), { status: 400 });
  const map = buildProductMap(await d.products().catch(() => []));
  const r = await inspectAndStore(d, g.siteUrl, url, map, d.now());
  if (r.quota) throw Object.assign(new Error('Search Console quota reached. Try again later.'), { status: 429 });
  if (r.auth) { await authStop(d, r); throw Object.assign(new Error('Reconnect Google'), { status: 400 }); }
  if (!r.ok) throw Object.assign(new Error(r.error), { status: 502 });
  return { row: r.row, siteUrl: g.siteUrl };
}

export { addDays };
