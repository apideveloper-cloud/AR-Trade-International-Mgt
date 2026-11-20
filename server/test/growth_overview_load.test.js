import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { loadOverview } from '../src/growth/overview.js';
import { mountGrowthOverviewRoutes } from '../src/admin/growthOverview.js';

const hostOf = s => { const d = String(s?.general?.preferredDomain || ''); return /^https:\/\/[^/]+$/i.test(d) ? d.replace(/^https:\/\//i, '') : ''; };
const base = (o = {}) => ({
  query: async sql => {
    if (sql.includes('growth_price_runs')) return [{ at: new Date('2026-11-19T00:00:00Z'), checked: 50, issues: 3, ms: 10 }];
    if (sql.includes('growth_price_issues')) return [{ code: 'schema_price_mismatch', n: 2 }, { code: 'no_sku', n: 1 }];
    if (sql.includes('merchant_sync_state')) return [{ status: 'Synced', n: 7 }, { status: 'Error', n: 2 }];
    if (sql.includes("status = 'Pending'")) return [{ n: 4 }];
    if (sql.includes("status = 'Spam'")) return [{ n: 1 }];
    if (sql.includes('review_requests')) return [{ n: 3 }];
    if (sql.includes('growth_jobs')) return [{ status: 'Queued', n: 2 }, { status: 'Failed', n: 1 }];
    throw new Error('unexpected ' + sql);
  },
  readSeo: async () => ({ general: { preferredDomain: 'https://x.test' }, flags: { indexNow: true, merchantFeed: true }, indexNow: { key: 'k' }, verification: { bing: 'tag' } }),
  readGrowth: async () => ({ lastSubmit: { google: '2026-11-01T00:00:00Z' }, merchant: { syncEnabled: true }, reviewRequests: { enabled: true } }),
  getIntegration: async k => ({ google: { status: 'connected', meta: { siteVerified: true }, last_error: '', last_sync: null }, bing: { status: 'error', last_error: 'bad key', meta: {} }, merchant: { status: 'not_connected', meta: {} } }[k]),
  siteOrigin: async () => 'https://x.test', hostOf,
  schemaSummary: async () => ({ lastRun: null, counts: { error: 2, warning: 1 }, byCode: [], pagesWithErrors: 2 }),
  gscSummary: async () => ({ connected: true, clicks: 40, prevClicks: 100, notIndexed: 5 }),
  feedStatus: async () => ({ enabled: true, items: 10, skipped: [{ reason: 'x', count: 2 }], warnings: [{ reason: 'y', count: 4 }] }),
  ...o
});

test('loadOverview gathers setup, health and actions', async () => {
  const o = await loadOverview(base());
  assert.equal(o.setup.domain, true); assert.equal(o.setup.preferredDomain, 'https://x.test');
  assert.equal(o.setup.googleConnected, true); assert.equal(o.setup.googleVerified, true); assert.equal(o.setup.bingConnected, false); assert.equal(o.setup.bingVerified, true);
  assert.equal(o.setup.indexNowReady, true); assert.ok(o.setup.sitemapSubmitted.google); assert.equal(o.setup.sitemapSubmitted.bing, null);
  assert.deepEqual(o.setup.steps.map(s => [s.id, s.done]), [['domain', true], ['verify', true], ['google', true], ['bing', false], ['sitemap', true], ['indexnow', true]]);
  assert.equal(o.setup.steps.length, 6); assert.ok(o.setup.steps.every(s => s.label && s.page));
  assert.deepEqual(o.health.price.counts, { schema_price_mismatch: 2, no_sku: 1 }); assert.equal(o.health.price.lastRun.checked, 50);
  assert.deepEqual(o.health.feed, { flagEnabled: true, itemCount: 10, skipped: 2, warnings: 4 });
  assert.deepEqual(o.health.merchant, { syncEnabled: true, errors: 2, pending: 1 });
  assert.deepEqual(o.health.reviews, { pending: 4, spam: 1, whatsappWaiting: 3, requestsEnabled: true });
  assert.deepEqual(o.health.jobs, { queued: 2, failed: 1 });
  assert.equal(o.health.integrations.bing.lastError, 'bad key'); assert.equal(o.health.integrations.bing.status, 'error');
  const ids = o.actions.map(a => a.id);
  for (const id of ['price_invalid', 'schema_errors', 'merchant_errors', 'jobs_failed', 'clicks_drop', 'not_indexed', 'reviews_pending', 'reviews_whatsapp', 'integration_bing']) assert.ok(ids.includes(id), id);
  assert.equal(o.allGood, false); assert.equal(o.search.connected, true);
});

test('every part failing still gives a full payload with defaults', async () => {
  const boom = async () => { throw new Error('down'); };
  const o = await loadOverview({ query: boom, readSeo: boom, readGrowth: boom, getIntegration: boom, siteOrigin: boom, hostOf: boom, schemaSummary: boom, gscSummary: boom, feedStatus: boom });
  assert.equal(o.setup.domain, false); assert.equal(o.setup.steps.length, 6); assert.ok(o.setup.steps.every(s => s.done === false));
  assert.deepEqual(o.search, { connected: false });
  assert.deepEqual(o.health.price, { lastRun: null, counts: {}, total: 0 });
  assert.deepEqual(o.health.jobs, { queued: 0, failed: 0 }); assert.deepEqual(o.health.reviews, { pending: 0, spam: 0, whatsappWaiting: 0, requestsEnabled: false });
  assert.equal(o.health.merchant.errors, 0); assert.equal(o.health.integrations.google.status, 'not_connected');
  assert.ok(Array.isArray(o.actions)); assert.ok(o.actions.some(a => a.id === 'preferred_domain'));
});

test('a missing gscSummary export or module gives { connected:false } and no search actions', async () => {
  const o = await loadOverview(base({ gscSummary: async () => { throw new Error("Cannot find module './gscSync.js'"); } }));
  assert.deepEqual(o.search, { connected: false });
  assert.ok(!o.actions.some(a => a.id === 'clicks_drop' || a.id === 'not_indexed'));
});

test('a fully healthy site is all good with no actions', async () => {
  const o = await loadOverview(base({
    query: async sql => (sql.includes('growth_price_runs') || sql.includes('growth_price_issues') || sql.includes('merchant_sync_state') || sql.includes('growth_jobs') ? [] : [{ n: 0 }]),
    getIntegration: async () => ({ status: 'connected', meta: { siteVerified: true }, last_error: '' }),
    schemaSummary: async () => ({ lastRun: null, counts: { error: 0, warning: 0 }, byCode: [] }),
    gscSummary: async () => ({ connected: true, clicks: 100, prevClicks: 100, notIndexed: 0 }),
    feedStatus: async () => ({ enabled: true, items: 5, skipped: [], warnings: [] }),
    readGrowth: async () => ({ lastSubmit: { google: 'x', bing: 'y' } })
  }));
  assert.deepEqual(o.actions, []); assert.equal(o.allGood, true);
});

test('GET /growth/overview returns the payload', async () => {
  const router = express.Router();
  mountGrowthOverviewRoutes(router, () => (req, res, next) => next(), base());
  const app = express(); app.use(router);
  const srv = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/growth/overview`);
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.ok(b.setup && b.health && Array.isArray(b.actions)); assert.equal(b.setup.steps.length, 6);
  } finally { srv.close(); }
});
