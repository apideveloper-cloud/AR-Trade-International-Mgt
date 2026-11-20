import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActions, searchFacts } from '../src/growth/overview.js';

const ok = () => ({
  setup: { domain: true, preferredDomain: 'https://x.test', googleConnected: true, steps: [{ id: 'domain', done: true }] },
  search: { connected: true, clicks: 500, prevClicks: 500, notIndexed: 0 },
  health: { schema: { counts: { error: 0, warning: 0 } }, price: { counts: {} }, feed: { flagEnabled: true }, merchant: { syncEnabled: true, errors: 0 }, reviews: { pending: 0, whatsappWaiting: 0 }, jobs: { failed: 0 }, integrations: { google: { status: 'connected' } } }
});
const ids = a => a.map(x => x.id);

test('a healthy shop has no actions', () => { assert.deepEqual(buildActions(ok()), []); assert.deepEqual(buildActions({}), []); assert.deepEqual(buildActions(), []); });

test('each rule produces its action with title, page and count', () => {
  const d = ok();
  d.setup = { domain: true, preferredDomain: '', googleConnected: false, steps: [{ done: false }, { done: false }, { done: true }] };
  d.health.price.counts = { schema_price_mismatch: 4, zero_price_active: 2, feed_price_mismatch: 1, schema_availability_mismatch: 1 };
  d.health.schema = { counts: { error: 9, warning: 5 }, pagesWithErrors: 3 };
  d.health.merchant = { syncEnabled: true, errors: 6 };
  d.health.feed = { flagEnabled: false };
  d.health.jobs = { failed: 2 };
  d.health.reviews = { pending: 1, whatsappWaiting: 7 };
  d.search = { connected: true, clicks: 60, prevClicks: 100, notIndexed: 8 };
  const a = Object.fromEntries(buildActions(d).map(x => [x.id, x]));
  assert.equal(a.preferred_domain.title, 'Set the preferred domain'); assert.equal(a.preferred_domain.page, 'seo');
  assert.equal(a.connect_google.title, 'Connect Google so Search Console data can load');
  assert.equal(a.price_invalid.title, '4 products have an invalid price on their page'); assert.equal(a.price_invalid.page, 'growth-prices'); assert.equal(a.price_invalid.count, 4);
  assert.equal(a.zero_price.title, '2 products have no price and cannot be shown in Google Shopping');
  assert.equal(a.price_feed_mismatch.count, 2);
  assert.equal(a.schema_errors.title, '3 pages have structured data errors'); assert.equal(a.schema_errors.page, 'growth-schema');
  assert.equal(a.schema_warnings.severity, 'low');
  assert.equal(a.merchant_errors.title, '6 Merchant Center products have errors'); assert.equal(a.merchant_errors.page, 'growth-merchant');
  assert.equal(a.feed_off.title, 'The product feed is off');
  assert.equal(a.jobs_failed.title, '2 background jobs have failed');
  assert.equal(a.reviews_pending.title, '1 review is waiting for approval'); assert.equal(a.reviews_pending.page, 'reviews');
  assert.equal(a.reviews_whatsapp.title, '7 review requests wait for you to send them on WhatsApp'); assert.equal(a.reviews_whatsapp.page, 'growth-reviews');
  assert.equal(a.clicks_drop.title, 'Search clicks dropped 40% against the previous 28 days'); assert.equal(a.clicks_drop.severity, 'high');
  assert.equal(a.not_indexed.title, '8 important pages are not indexed by Google');
  assert.equal(a.setup_left.count, 2);
});

test('sorted by severity, then count, then id', () => {
  const d = ok();
  d.health.jobs = { failed: 1 }; d.health.merchant = { syncEnabled: true, errors: 9 };
  d.health.reviews = { pending: 20, whatsappWaiting: 3 };
  d.health.schema = { counts: { error: 2, warning: 40 } };
  const a = buildActions(d);
  assert.deepEqual(ids(a), ['merchant_errors', 'schema_errors', 'jobs_failed', 'reviews_pending', 'reviews_whatsapp', 'schema_warnings']);
  const rank = { high: 0, medium: 1, low: 2 };
  for (let i = 1; i < a.length; i++) assert.ok(rank[a[i - 1].severity] <= rank[a[i].severity]);
});

test('click drop thresholds: previous >= 50 and drop >= 20%', () => {
  const run = (clicks, prevClicks) => { const d = ok(); d.search = { connected: true, clicks, prevClicks }; return buildActions(d).find(x => x.id === 'clicks_drop'); };
  assert.equal(run(80, 100)?.title, 'Search clicks dropped 20% against the previous 28 days'); // exactly 20%
  assert.equal(run(81, 100), undefined); // 19%
  assert.equal(run(10, 49), undefined); // previous too small
  assert.ok(run(30, 50)); // previous exactly 50, 40% drop
  assert.equal(run(30, 50).severity, 'high'); assert.equal(run(75, 100).severity, 'medium');
  assert.equal(run(200, 100), undefined); // growth
  assert.equal(run(0, 100).title, 'Search clicks dropped 100% against the previous 28 days');
});

test('other field names of the search summary are understood; disconnected search adds nothing', () => {
  assert.deepEqual(searchFacts({ last28: { clicks: 50 }, prev28: { clicks: 100 }, indexing: { notIndexed: 2 } }), { connected: false, clicks: 50, prevClicks: 100, dropPercent: 50, notIndexed: 2 });
  assert.equal(searchFacts(null).dropPercent, null); assert.equal(searchFacts({ connected: false }).notIndexed, 0);
  const d = ok(); d.search = { connected: false };
  assert.deepEqual(buildActions(d), []);
  d.search = undefined; assert.deepEqual(buildActions(d), []);
});

test('merchant errors are ignored while sync is off; integration errors and singular wording', () => {
  const d = ok(); d.health.merchant = { syncEnabled: false, errors: 5 }; assert.deepEqual(buildActions(d), []);
  d.health.integrations = { google: { status: 'error', lastError: 'invalid_grant' }, bing: { status: 'connected' } };
  const a = buildActions(d); assert.deepEqual(ids(a), ['integration_google']); assert.match(a[0].detail, /invalid_grant/);
  const e = ok(); e.health.jobs = { failed: 1 }; e.health.price.counts = { schema_price_mismatch: 1 };
  assert.deepEqual(buildActions(e).map(x => x.title), ['1 background job has failed', '1 product has an invalid price on its page']);
});

test('searchFacts reads the real gscSummary shape (cur / prev / inspected)', async () => {
  const { searchFacts } = await import('../src/growth/overview.js');
  const f = searchFacts({ connected: true, cur: { clicks: 40 }, prev: { clicks: 100 }, inspected: { notIndexed: 7 } });
  assert.equal(f.clicks, 40); assert.equal(f.prevClicks, 100); assert.equal(f.dropPercent, 60); assert.equal(f.notIndexed, 7);
});
