import test from 'node:test';
import assert from 'node:assert/strict';
import { mountGrowthGscRoutes, shapeInspection, filterRows } from '../src/admin/growthGsc.js';
import { fakeDb } from './growth_fake.js';

process.env.SITE_URL = 'https://shop.test';
fakeDb();

const routes = new Map();
const guards = [];
const router = ['get', 'post'].reduce((o, m) => ({ ...o, [m]: (p, ...h) => routes.set(m.toUpperCase() + ' ' + p, h) }), {});
mountGrowthGscRoutes(router, perm => { guards.push(perm); return (req, res, next) => next(); });
const call = async (key, { body = {}, query = {} } = {}) => {
  const h = routes.get(key), out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await h[h.length - 1]({ body, query }, res);
  return out;
};

test('all routes are mounted behind seo.manage', () => {
  for (const k of ['GET /growth/gsc/performance', 'GET /growth/gsc/index-health', 'GET /growth/gsc/inspections', 'POST /growth/gsc/inspect', 'POST /growth/gsc/requested', 'GET /growth/gsc/deeplink', 'POST /growth/gsc/sync', 'POST /growth/gsc/inspect-batch']) assert.ok(routes.has(k), k);
  assert.ok(guards.length > 0 && guards.every(g => g === 'seo.manage'));
});
test('a foreign-host address is rejected with 400 (inspect, requested, deeplink)', async () => {
  for (const key of ['POST /growth/gsc/inspect', 'POST /growth/gsc/requested']) {
    const r = await call(key, { body: { url: 'https://evil.test/product/a' } });
    assert.equal(r.status, 400, key); assert.match(r.body.error, /shop\.test/);
  }
  assert.equal((await call('GET /growth/gsc/deeplink', { query: { url: 'https://evil.test/' } })).status, 400);
  assert.equal((await call('POST /growth/gsc/inspect', { body: {} })).status, 400);
  assert.equal((await call('POST /growth/gsc/inspect', { body: { productId: 'x' } })).status, 400);
});
test('inspections: bad status is a 400', async () => {
  assert.equal((await call('GET /growth/gsc/inspections', { query: { status: 'weird' } })).status, 400);
});
test('shapeInspection and filterRows', () => {
  const idx = shapeInspection({ url: 'https://shop.test/a', productId: 5, productName: 'HP Toner', never: false, row: { verdict: 'PASS', coverage_state: 'Submitted and indexed', inspected_at: new Date('2026-11-19T00:00:00Z') } });
  const bad = shapeInspection({ url: 'https://shop.test/b', productId: null, productName: '', never: false, row: { verdict: 'NEUTRAL', coverage_state: 'Crawled - currently not indexed', inspected_at: new Date('2026-11-19T00:00:00Z') } });
  const nev = shapeInspection({ url: 'https://shop.test/c', productId: null, productName: '', never: true, row: null });
  assert.deepEqual([idx.classification, bad.classification, nev.classification], ['indexed', 'not_indexed', 'never']);
  assert.match(bad.coverageNote, /not to index/i); assert.equal(idx.inspectedAt, '2026-11-19T00:00:00.000Z'); assert.equal(nev.inspectedAt, null);
  const all = [idx, bad, nev];
  assert.equal(filterRows(all, { status: 'never' }).length, 1);
  assert.deepEqual(filterRows(all, { q: 'toner' }).map(r => r.url), ['https://shop.test/a']);
});
