import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, allow, buildProductMap, classify, classifyFull, deepLink, deltas, dhakaDate, dhakaDayStart, mapInspection, onOrigin, orderUrls, pickProperty,
  productIdForUrl, selectBatch, totals, urlHash, validateSiteUrl, windows
} from '../src/growth/gscMap.js';

test('Dhaka date: UTC evening is already the next day in Dhaka', () => {
  assert.equal(dhakaDate(Date.parse('2026-11-20T17:59:00Z')), '2026-11-20');
  assert.equal(dhakaDate(Date.parse('2026-11-20T18:00:00Z')), '2026-11-21');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(dhakaDayStart(Date.parse('2026-11-20T18:30:00Z')).toISOString(), '2026-11-20T18:00:00.000Z');
});
test('windows: end = today - 2 (Dhaka), 90 days, 28 + 28 days', () => {
  const w = windows(Date.parse('2026-11-20T20:00:00Z')); // 2026-11-21 in Dhaka
  assert.equal(w.end, '2026-11-19');
  assert.deepEqual(w.daily, { startDate: '2026-08-22', endDate: '2026-11-19' });
  assert.deepEqual(w.cur, { startDate: '2026-10-23', endDate: '2026-11-19' });
  assert.deepEqual(w.prev, { startDate: '2026-09-25', endDate: '2026-10-22' });
  assert.equal((Date.parse(w.cur.endDate) - Date.parse(w.cur.startDate)) / 864e5, 27);
});

test('classify on real-looking coverage states', () => {
  assert.equal(classify({ verdict: 'PASS', coverageState: 'Submitted and indexed' }), 'indexed');
  assert.equal(classify({ verdict: 'PASS', coverageState: 'Indexed, not submitted in sitemap' }), 'indexed');
  const cases = {
    'Crawled - currently not indexed': /visited/, 'Discovered - currently not indexed': /not visited/, 'Excluded by noindex tag': /noindex/, 'Duplicate without user-selected canonical': /copy/,
    'Page with redirect': /redirects/, 'Not found (404)': /404/, 'Alternate page with proper canonical tag': /copy/
  };
  for (const [cs, re] of Object.entries(cases)) {
    const k = classifyFull({ verdict: 'NEUTRAL', coverageState: cs });
    assert.equal(k.classification, 'not_indexed', cs); assert.match(k.coverageNote, re, cs);
  }
  assert.equal(classify({ verdict: 'FAIL', coverageState: 'Something new' }), 'not_indexed');
  assert.equal(classify({ verdict: 'NEUTRAL', coverageState: 'Something new' }), 'unknown');
  assert.equal(classify({ verdict: 'VERDICT_UNSPECIFIED', coverageState: '' }), 'unknown');
  assert.equal(classify({ error: 'x' }), 'unknown');
  assert.equal(classify(null), 'unknown');
  assert.equal(classify({ verdict: 'neutral', coverage_state: 'Crawled - currently not indexed' }), 'not_indexed'); // db column names work too
});

test('URL to product mapping (slug, old id form, trailing slash, encoding)', () => {
  const map = buildProductMap([{ id: 5, name: 'HP 230A Toner', slug: 'hp-230a-toner' }, { id: 9, name: 'Old Thing', slug: null }]);
  assert.equal(productIdForUrl('https://x.test/product/hp-230a-toner', map), 5);
  assert.equal(productIdForUrl('https://x.test/product/hp-230a-toner/', map), 5);
  assert.equal(productIdForUrl('https://x.test/product/old-thing-9', map), 9);
  assert.equal(productIdForUrl('https://x.test/product/nothing', map), 0);
  assert.equal(productIdForUrl('https://x.test/', map), 0);
  assert.equal(productIdForUrl('not a url', map), 0);
});
test('orderUrls puts product pages first and drops duplicates', () => {
  assert.deepEqual(orderUrls(['https://x.test/', 'https://x.test/product/a', 'https://x.test/blog', 'https://x.test/product/a', 'https://x.test/product/b']),
    ['https://x.test/product/a', 'https://x.test/product/b', 'https://x.test/', 'https://x.test/blog']);
});
test('onOrigin moves a dev address onto the public host', () => {
  assert.equal(onOrigin('http://localhost:4000/product/a?x=1', 'https://shop.test'), 'https://shop.test/product/a?x=1');
  assert.equal(onOrigin('mailto:a@b.c', 'https://shop.test'), '');
});

test('mapInspection reads indexStatusResult', () => {
  const m = mapInspection({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', robotsTxtState: 'ALLOWED', indexingState: 'INDEXING_ALLOWED', lastCrawlTime: '2026-11-18T03:04:05Z', pageFetchState: 'SUCCESSFUL', googleCanonical: 'https://x.test/a', userCanonical: 'https://x.test/a' } } });
  assert.deepEqual({ ...m, lastCrawl: m.lastCrawl.toISOString() }, { verdict: 'PASS', coverageState: 'Submitted and indexed', indexingState: 'INDEXING_ALLOWED', robotsState: 'ALLOWED', fetchState: 'SUCCESSFUL', lastCrawl: '2026-11-18T03:04:05.000Z', googleCanonical: 'https://x.test/a', userCanonical: 'https://x.test/a' });
  const e = mapInspection({});
  assert.equal(e.verdict, ''); assert.equal(e.lastCrawl, null);
});

test('batch selection: never inspected first, then oldest; daily cap and batch limit', () => {
  const urls = ['a', 'b', 'c', 'd', 'e'], now = Date.parse('2026-11-20T00:00:00Z'), h = n => new Date(now - n * 3600e3);
  const done = new Map([[urlHash('a'), h(100)], [urlHash('b'), h(50)], [urlHash('c'), h(2)]]); // c is too recent
  assert.deepEqual(selectBatch(urls, done, { now }), ['d', 'e', 'a', 'b']);
  assert.deepEqual(selectBatch(urls, done, { now, limit: 3 }), ['d', 'e', 'a']);
  assert.deepEqual(selectBatch(urls, done, { now, usedToday: 399 }), ['d']);
  assert.deepEqual(selectBatch(urls, done, { now, usedToday: 400 }), []);
  assert.deepEqual(selectBatch(urls, new Map(), { now, limit: 2 }), ['a', 'b']);
  const many = Array.from({ length: 200 }, (_, i) => 'u' + i);
  assert.equal(selectBatch(many, new Map(), { now }).length, 60);
});

test('property choice: URL-prefix first, then domain property, never unverified', () => {
  const sites = [{ siteUrl: 'sc-domain:shop.test', permissionLevel: 'siteOwner' }, { siteUrl: 'https://shop.test/', permissionLevel: 'siteFullUser' }];
  assert.equal(pickProperty(sites, 'shop.test'), 'https://shop.test/');
  assert.equal(pickProperty(sites.slice(0, 1), 'www.shop.test'), 'sc-domain:shop.test');
  assert.equal(pickProperty([{ siteUrl: 'https://shop.test/', permissionLevel: 'siteUnverifiedUser' }], 'shop.test'), '');
  assert.equal(pickProperty(sites, 'other.test'), '');
});

test('validators, rate limit, deep link, totals and deltas', () => {
  assert.equal(validateSiteUrl('https://shop.test/product/a?x=1#frag', 'https://shop.test').url, 'https://shop.test/product/a?x=1');
  assert.equal(validateSiteUrl('https://evil.test/x', 'https://shop.test').ok, false);
  assert.equal(validateSiteUrl('https://shop.test.evil.com/', 'https://shop.test').ok, false);
  assert.equal(validateSiteUrl('ftp://shop.test/x', 'https://shop.test').ok, false);
  assert.equal(validateSiteUrl('', 'https://shop.test').ok, false);
  const l = []; let n = 0; for (let i = 0; i < 25; i++) if (allow(l, 1000)) n++;
  assert.equal(n, 20); assert.equal(allow(l, 1000 + 600e3), true);
  assert.equal(deepLink('https://shop.test/', 'https://shop.test/a b'), 'https://search.google.com/search-console/inspect?resource_id=https%3A%2F%2Fshop.test%2F&id=https%3A%2F%2Fshop.test%2Fa%20b');
  assert.equal(deepLink('', 'x'), 'https://search.google.com/search-console');
  const cur = totals([{ clicks: 10, impressions: 100, position: 2 }, { clicks: 0, impressions: 300, position: 6 }]);
  assert.deepEqual(cur, { clicks: 10, impressions: 400, ctr: 0.025, position: 5 });
  assert.deepEqual(deltas(cur, { clicks: 5, impressions: 0, ctr: 0, position: 8 }), { clicks: 100, impressions: null, ctr: null, position: -3 });
});
