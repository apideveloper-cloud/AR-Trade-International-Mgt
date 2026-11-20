// Admin routes of the Search Console tools (Search & Growth, Phase 5): performance, index health, URL Inspection. Reads and writes need seo.manage.
// We never use the Indexing API: "Request indexing" is pressed by the owner in Search Console and only recorded here (POST /growth/gsc/requested).
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { productPath } from '../slug.js';
import { enqueue } from '../growth/jobs.js';
import { getIntegration } from '../growth/http.js';
import { siteOrigin } from '../growth/site.js';
import { getSitemapStatus } from '../growth/gscApi.js';
import { buildProductMap, classifyFull, allow, deepLink, productIdForUrl, validateSiteUrl, windows } from '../growth/gscMap.js';
import { DAILY_LIMIT, dbStore, gscSummary, inspectNow, inspectionCounts, inspectionOverview } from '../growth/gscSync.js';
import { dhakaDayStart } from '../growth/gscMap.js';

const lastManual = new Map();
const calls = []; // timestamps of POST /inspect (20 per 10 minutes per process)
const iso = d => (d ? new Date(d).toISOString() : null);
const page = (q, d, max) => Math.min(max, Math.max(1, parseInt(q, 10) || d));
const STATUS = ['indexed', 'not_indexed', 'unknown', 'never'];

/** One merged overview entry -> the row the screen shows. Pure. */
export function shapeInspection(x) {
  const r = x.row || {};
  const k = x.never ? { classification: 'never', coverageNote: '' } : classifyFull({ verdict: r.verdict, coverageState: r.coverage_state });
  return {
    url: x.url, productId: x.productId, productName: x.productName, classification: k.classification, verdict: r.verdict || '', coverageState: r.coverage_state || '', coverageNote: k.coverageNote,
    lastCrawl: iso(r.last_crawl), googleCanonical: r.google_canonical || '', userCanonical: r.user_canonical || '', inspectedAt: iso(r.inspected_at), requestedAt: iso(r.requested_at), error: r.error || ''
  };
}
/** Filters shaped rows by status (indexed | not_indexed | unknown | never) and a text search over address and product name. Pure. */
export function filterRows(rows, { status = '', q = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  return rows.filter(r => (!status || r.classification === status) && (!needle || `${r.url} ${r.productName}`.toLowerCase().includes(needle)));
}

export function mountGrowthGscRoutes(router, guard) {
  const R = guard('seo.manage');

  router.get('/growth/gsc/performance', R, wrap(async (req, res) => {
    const s = await gscSummary();
    const base = { connected: s.connected, siteUrl: s.siteUrl, lastSyncAt: s.lastSyncAt, cur: s.cur, prev: s.prev, delta: s.delta, daily: [], topQueries: [], topPages: [] };
    if (!s.connected) return res.json(base);
    const w = windows();
    const [daily, qc, qp, pc, pp, products] = await Promise.all([dbStore.daily(w.daily.startDate), dbStore.top('query', 'cur'), dbStore.top('query', 'prev'), dbStore.top('page', 'cur'), dbStore.top('page', 'prev'), pool.query('SELECT id, name, slug FROM products').then(r => r[0]).catch(() => [])]);
    const prevOf = rows => new Map(rows.map(r => [r.key, Number(r.clicks)]));
    const pq = prevOf(qp), pg = prevOf(pp), map = buildProductMap(products);
    const m = r => ({ clicks: Number(r.clicks), impressions: Number(r.impressions), ctr: Number(r.ctr), position: Number(r.position) });
    res.json({
      ...base,
      daily: daily.map(r => ({ day: r.day, ...m(r) })),
      topQueries: qc.map(r => ({ query: r.key, ...m(r), prevClicks: pq.get(r.key) ?? 0 })),
      topPages: pc.map(r => ({ page: r.key, productId: productIdForUrl(r.key, map) || null, ...m(r), prevClicks: pg.get(r.key) ?? 0 }))
    });
  }));

  router.get('/growth/gsc/index-health', R, wrap(async (req, res) => {
    const gi = await getIntegration('google'), connected = gi.status === 'connected';
    const list = await inspectionOverview();
    const counts = inspectionCounts(list);
    const reasons = new Map();
    for (const x of list) {
      if (x.never) continue;
      const k = classifyFull({ verdict: x.row.verdict, coverageState: x.row.coverage_state });
      if (k.classification !== 'not_indexed') continue;
      const reason = x.row.coverage_state || 'Not indexed';
      const e = reasons.get(reason) || { reason, count: 0, sample: [] };
      e.count++; if (e.sample.length < 3) e.sample.push({ url: x.url, productId: x.productId });
      reasons.set(reason, e);
    }
    let sitemap = null;
    const siteUrl = connected ? (gi.meta || {}).gscSite || '' : '';
    if (siteUrl) {
      try { const origin = await siteOrigin(); const r = origin ? await getSitemapStatus(siteUrl, origin + '/sitemap.xml') : null; if (r?.ok) sitemap = r.data; } catch { sitemap = null; }
    }
    const usedToday = connected ? await dbStore.countSince(dhakaDayStart()) : 0;
    const times = list.map(x => x.row?.inspected_at).filter(Boolean).map(d => new Date(d).getTime());
    res.json({ connected, counts, byReason: [...reasons.values()].sort((a, b) => b.count - a.count).slice(0, 10), sitemap, quota: { usedToday, limitToday: DAILY_LIMIT }, lastRunAt: times.length ? new Date(Math.max(...times)).toISOString() : null });
  }));

  router.get('/growth/gsc/inspections', R, wrap(async (req, res) => {
    const status = String(req.query.status || '');
    if (status && !STATUS.includes(status)) throw fail(400, 'Status must be one of ' + STATUS.join(', '));
    const all = filterRows((await inspectionOverview()).map(shapeInspection), { status, q: req.query.q });
    const limit = page(req.query.limit, 15, 100), pages = Math.max(1, Math.ceil(all.length / limit)), pg = Math.min(page(req.query.page, 1, 1e6), pages);
    res.json({ rows: all.slice((pg - 1) * limit, pg * limit), total: all.length, page: pg, pages });
  }));

  router.post('/growth/gsc/inspect', R, wrap(async (req, res) => {
    const origin = await siteOrigin();
    if (!origin) throw fail(400, 'Set the preferred domain (https://...) in SEO settings first');
    let url = req.body?.url;
    if (!url && req.body?.productId !== undefined) {
      const id = Number(req.body.productId);
      if (!Number.isInteger(id) || id <= 0) throw fail(400, 'Bad product id');
      const [p] = await pool.query('SELECT id, name, slug FROM products WHERE id = ?', [id]);
      if (!p.length) throw fail(404, 'Product not found');
      url = origin + productPath(p[0]);
    }
    const v = validateSiteUrl(url, origin);
    if (!v.ok) throw fail(400, v.error);
    if (!allow(calls)) return res.status(429).json({ error: 'Too many inspections. Wait a few minutes and try again.' });
    const { row, siteUrl } = await inspectNow(v.url);
    const k = classifyFull(row);
    res.json({
      row: { url: row.url, productId: row.productId, classification: k.classification, verdict: row.verdict, coverageState: row.coverageState, coverageNote: k.coverageNote, lastCrawl: iso(row.lastCrawl), googleCanonical: row.googleCanonical, userCanonical: row.userCanonical, inspectedAt: iso(row.inspectedAt), requestedAt: null, error: '' },
      link: deepLink(siteUrl, row.url)
    });
  }));

  router.post('/growth/gsc/requested', R, wrap(async (req, res) => {
    const origin = await siteOrigin();
    if (!origin) throw fail(400, 'Set the preferred domain (https://...) in SEO settings first');
    const v = validateSiteUrl(req.body?.url, origin);
    if (!v.ok) throw fail(400, v.error);
    const at = new Date();
    await dbStore.setRequested(v.url, 0, at);
    res.json({ ok: true, requestedAt: at.toISOString() });
  }));

  router.get('/growth/gsc/deeplink', R, wrap(async (req, res) => {
    const origin = await siteOrigin();
    const v = origin ? validateSiteUrl(req.query.url, origin) : { ok: false, error: 'Set the preferred domain (https://...) in SEO settings first' };
    if (!v.ok) throw fail(400, v.error);
    const site = ((await getIntegration('google')).meta || {}).gscSite || '';
    res.json({ link: deepLink(site, v.url) });
  }));

  const queue = (type, key) => wrap(async (req, res) => {
    if (Date.now() - (lastManual.get(key) || 0) < 60000) return res.status(429).json({ error: 'Wait a minute before starting this again' });
    lastManual.set(key, Date.now());
    res.json({ queued: (await enqueue(type, {}, { dedupeKey: key })) !== null });
  });
  router.post('/growth/gsc/sync', R, queue('gsc_sync', 'gsc_sync_manual'));
  router.post('/growth/gsc/inspect-batch', R, queue('gsc_inspect', 'gsc_inspect_manual'));
}

