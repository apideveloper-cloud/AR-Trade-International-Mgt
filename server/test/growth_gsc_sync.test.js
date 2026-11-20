import test from 'node:test';
import assert from 'node:assert/strict';
import { runGscSync, runGscInspect, gscSummary, inspectNow, inspectionOverview } from '../src/growth/gscSync.js';
import { urlHash } from '../src/growth/gscMap.js';

const NOW = Date.parse('2026-11-20T08:00:00Z'); // 2026-11-20 14:00 in Dhaka
const OK = (data = {}) => ({ ok: true, status: 200, data, error: '' });
const PASS = { inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: '2026-11-18T00:00:00Z', googleCanonical: 'https://shop.test/' } } };

/** In-memory stand-in for the database side + stubbed outside world. */
function rig({ connected = true, siteUrl = 'https://shop.test/', urls = [], products = [], inspected = [], api = {}, rows = [] } = {}) {
  const st = { daily: new Map(), top: new Map(), insp: new Map(inspected.map(([u, at]) => [urlHash(u), { url: u, inspected_at: at }])), integ: [], replaced: [] };
  const store = {
    upsertDaily: async rs => { for (const r of rs) st.daily.set(r.day, r); },
    replaceTop: async (kind, period, rs) => { st.replaced.push([kind, period, rs.length]); st.top.set(kind + period, rs); },
    daily: async from => [...st.daily.values()].filter(r => r.day >= from).sort((a, b) => (a.day < b.day ? -1 : 1)),
    top: async (k, p) => st.top.get(k + p) || [],
    inspected: async () => new Map([...st.insp].filter(([, v]) => v.inspected_at).map(([k, v]) => [k, v.inspected_at])),
    countSince: async d => [...st.insp.values()].filter(v => v.inspected_at && new Date(v.inspected_at) >= d).length,
    saveInspection: async x => { st.insp.set(urlHash(x.url), { url: x.url, product_id: x.productId, verdict: x.verdict, coverage_state: x.coverageState, inspected_at: x.inspectedAt, error: '' }); },
    saveError: async x => { st.insp.set(urlHash(x.url), { ...(st.insp.get(urlHash(x.url)) || {}), url: x.url, product_id: x.productId, error: x.error, inspected_at: x.inspectedAt }); },
    all: async () => [...st.insp.values(), ...rows]
  };
  const calls = { sa: [], insp: [] };
  const deps = {
    store, now: () => NOW,
    connected: async () => connected, siteUrl: async () => siteUrl, cachedSiteUrl: async () => siteUrl, origin: async () => 'https://shop.test',
    sitemapUrls: async () => urls, products: async () => products,
    getIntegration: async () => ({ last_sync: new Date(NOW), meta: {} }),
    setIntegration: async (k, p) => { st.integ.push([k, p]); },
    api: {
      searchAnalytics: async (site, o) => { calls.sa.push({ site, ...o }); return api.sa ? api.sa(o, calls.sa.length) : OK({ rows: [] }); },
      inspectUrl: async (site, u) => { calls.insp.push(u); return api.insp ? api.insp(u, calls.insp.length) : OK(PASS); }
    }
  };
  return { deps, st, calls };
}
const mkRows = (n, base = 100) => Array.from({ length: n }, (_, i) => ({ keys: ['k' + i], clicks: base - i, impressions: 1000, ctr: 0.01, position: 3 }));

test('sync is skipped when Google is not connected or the site is not in Search Console', async () => {
  assert.deepEqual(await runGscSync({ deps: rig({ connected: false }).deps }), { skipped: true, reason: 'Google is not connected' });
  assert.deepEqual(await runGscSync({ deps: rig({ siteUrl: '' }).deps }), { skipped: true, reason: 'This website is not added in Search Console yet' });
  assert.equal((await runGscInspect({ deps: rig({ siteUrl: '' }).deps })).skipped, true);
});
test('sync asks for the right windows and upserts the daily totals', async () => {
  const r = rig({ api: { sa: o => (o.dimensions[0] === 'date' ? OK({ rows: [{ keys: ['2026-11-17'], clicks: 4, impressions: 80, ctr: 0.05, position: 6.5 }, { keys: ['bad'], clicks: 1 }] }) : OK({ rows: [] })) } });
  const out = await runGscSync({ deps: r.deps });
  assert.equal(out.days, 1);
  assert.equal(r.st.daily.get('2026-11-17').clicks, 4);
  const [d, q, , p] = r.calls.sa;
  assert.deepEqual([d.startDate, d.endDate, d.dimensions, r.calls.sa.length], ['2026-08-21', '2026-11-18', ['date'], 5]);
  assert.deepEqual([q.startDate, q.endDate, q.dimensions, q.rowLimit], ['2026-10-22', '2026-11-18', ['query'], 100]);
  assert.deepEqual(r.calls.sa.slice(1).map(c => `${c.dimensions[0]}:${c.startDate}`), ['query:2026-10-22', 'query:2026-09-24', 'page:2026-10-22', 'page:2026-09-24']);
  assert.equal(p.endDate, '2026-11-18');
  assert.equal(r.st.integ.at(-1)[0], 'gsc'); assert.equal(r.st.integ.at(-1)[1].status, 'connected');
});
test('top lists are replaced, not appended', async () => {
  const r = rig({ api: { sa: (o, n) => OK({ rows: o.dimensions[0] === 'date' ? [] : mkRows(n === 2 ? 100 : 3) }) } });
  await runGscSync({ deps: r.deps });
  assert.deepEqual(r.st.replaced.map(x => x.join(':')), ['query:cur:100', 'query:prev:3', 'page:cur:3', 'page:prev:3']);
  await runGscSync({ deps: { ...r.deps, api: { ...r.deps.api, searchAnalytics: async () => OK({ rows: mkRows(2) }) } } });
  assert.equal(r.st.top.get('querycur').length, 2); // replaced
});
test('sync: 429 is rethrown, 403 stops with a Reconnect Google error', async () => {
  await assert.rejects(runGscSync({ deps: rig({ api: { sa: () => ({ ok: false, status: 429, error: 'Quota exceeded' }) } }).deps }), /quota/i);
  const r = rig({ api: { sa: () => ({ ok: false, status: 403, error: 'forbidden' }) } });
  const out = await runGscSync({ deps: r.deps });
  assert.equal(out.stopped, 'Reconnect Google');
  assert.deepEqual(r.st.integ.at(-1), ['gsc', { status: 'error', last_error: 'Reconnect Google' }]);
  await assert.rejects(runGscSync({ deps: rig({ api: { sa: () => ({ ok: false, status: 500, error: 'boom' }) } }).deps }), /boom/);
});

test('inspect: product pages first, store results, map product ids', async () => {
  const urls = ['https://shop.test/about', 'https://shop.test/product/hp-230a', 'https://shop.test/product/other'];
  const r = rig({ urls, products: [{ id: 5, name: 'HP', slug: 'hp-230a' }] });
  const out = await runGscInspect({ deps: r.deps });
  assert.equal(out.inspected, 4);
  assert.deepEqual(r.calls.insp, ['https://shop.test/product/hp-230a', 'https://shop.test/product/other', 'https://shop.test/', 'https://shop.test/about'].sort((a, b) => r.calls.insp.indexOf(a) - r.calls.insp.indexOf(b)));
  assert.equal(r.calls.insp[0], 'https://shop.test/product/hp-230a');
  assert.equal(r.st.insp.get(urlHash('https://shop.test/product/hp-230a')).product_id, 5);
  assert.equal(r.st.insp.get(urlHash('https://shop.test/about')).verdict, 'PASS');
  assert.deepEqual(r.calls.insp.slice(-2).sort(), ['https://shop.test/', 'https://shop.test/about']);
});
test('inspect: batch of 60 and never over 400 a day', async () => {
  const urls = Array.from({ length: 500 }, (_, i) => 'https://shop.test/p' + i);
  const r = rig({ urls });
  assert.equal((await runGscInspect({ deps: r.deps })).inspected, 60);
  // 390 already inspected today -> only 10 left
  const today = new Date(NOW - 3600e3);
  const r2 = rig({ urls, inspected: urls.slice(0, 390).map(u => [u, today]) });
  assert.equal((await runGscInspect({ deps: r2.deps })).inspected, 10);
  const r3 = rig({ urls, inspected: urls.slice(0, 400).map(u => [u, today]) });
  const o3 = await runGscInspect({ deps: r3.deps });
  assert.equal(o3.inspected, 0); assert.match(o3.reason, /limit/i); assert.equal(r3.calls.insp.length, 0);
});
test('inspect: a per-URL error is stored and the run goes on; 429 throws; 403 stops', async () => {
  const urls = ['https://shop.test/a', 'https://shop.test/b', 'https://shop.test/c'];
  const r = rig({ urls, api: { insp: u => (u.endsWith('/a') ? { ok: false, status: 500, error: 'Internal error' } : OK(PASS)) } });
  const out = await runGscInspect({ deps: r.deps });
  assert.deepEqual([out.inspected, out.errors], [3, 1]); // home + b + c ok, a failed
  assert.equal(r.st.insp.get(urlHash('https://shop.test/a')).error, 'Internal error');
  await assert.rejects(runGscInspect({ deps: rig({ urls, api: { insp: (u, n) => (n === 2 ? { ok: false, status: 429, error: 'Quota exceeded for quota metric' } : OK(PASS)) } }).deps }), /quota/i);
  const r403 = rig({ urls, api: { insp: () => ({ ok: false, status: 403, error: 'denied' }) } });
  const o = await runGscInspect({ deps: r403.deps });
  assert.equal(o.stopped, 'Reconnect Google'); assert.equal(r403.calls.insp.length, 1);
  assert.deepEqual(r403.st.integ.at(-1)[1], { status: 'error', last_error: 'Reconnect Google' });
});
test('inspect rotates: old inspections come after never-inspected ones and recent ones are skipped', async () => {
  const urls = ['https://shop.test/a', 'https://shop.test/b', 'https://shop.test/c'];
  const r = rig({ urls, inspected: [['https://shop.test/a', new Date(NOW - 30 * 3600e3)], ['https://shop.test/b', new Date(NOW - 60 * 3600e3)], ['https://shop.test/c', new Date(NOW - 3600e3)]] });
  await runGscInspect({ deps: r.deps });
  assert.deepEqual(r.calls.insp, ['https://shop.test/', 'https://shop.test/b', 'https://shop.test/a']);
});
test('inspectNow returns the stored row; a 429 becomes a 429 error', async () => {
  const r = rig({ products: [{ id: 5, name: 'HP', slug: 'hp-230a' }] });
  const x = await inspectNow('https://shop.test/product/hp-230a', { deps: r.deps });
  assert.equal(x.row.productId, 5); assert.equal(x.row.verdict, 'PASS'); assert.equal(x.siteUrl, 'https://shop.test/');
  const q = rig({ api: { insp: () => ({ ok: false, status: 429, error: 'Quota exceeded' }) } });
  await assert.rejects(inspectNow('https://shop.test/', { deps: q.deps }), e => e.status === 429);
  await assert.rejects(inspectNow('https://shop.test/', { deps: rig({ connected: false }).deps }), e => e.status === 400);
});

test('summary: not connected gives zeros and never throws', async () => {
  const s = await gscSummary({ deps: rig({ connected: false }).deps });
  assert.deepEqual(s, { connected: false, siteUrl: '', lastSyncAt: null, cur: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, prev: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, delta: { clicks: null, impressions: null, ctr: null, position: null }, inspected: { total: 0, indexed: 0, notIndexed: 0, unknown: 0, neverInspected: 0 } });
  const broken = rig(); broken.deps.store.daily = async () => { throw new Error('db down'); };
  assert.equal((await gscSummary({ deps: broken.deps })).connected, false);
});
test('summary: totals, deltas and inspection counts', async () => {
  const urls = ['https://shop.test/a', 'https://shop.test/b', 'https://shop.test/c'];
  const r = rig({ urls });
  // window end 2026-11-18: cur 10-22..11-18, prev 09-24..10-21
  await r.deps.store.upsertDaily([{ day: '2026-11-10', clicks: 30, impressions: 300, position: 4 }, { day: '2026-10-01', clicks: 20, impressions: 400, position: 5 }, { day: '2026-07-01', clicks: 999, impressions: 999, position: 1 }]);
  r.st.insp.set(urlHash('https://shop.test/a'), { url: 'https://shop.test/a', verdict: 'PASS', inspected_at: new Date(NOW) });
  r.st.insp.set(urlHash('https://shop.test/b'), { url: 'https://shop.test/b', verdict: 'NEUTRAL', coverage_state: 'Crawled - currently not indexed', inspected_at: new Date(NOW) });
  const s = await gscSummary({ deps: r.deps });
  assert.equal(s.connected, true); assert.equal(s.cur.clicks, 30); assert.equal(s.prev.clicks, 20);
  assert.deepEqual(s.delta, { clicks: 50, impressions: -25, ctr: 100, position: -1 });
  assert.deepEqual(s.inspected, { total: 4, indexed: 1, notIndexed: 1, unknown: 0, neverInspected: 2 }); // home + c never
  assert.equal((await inspectionOverview(r.deps)).length, 4);
});
