import test from 'node:test';
import assert from 'node:assert/strict';
import { logNotFound, flushNow, buildUpsert, buildPrune, peekPending, resetPending, pendingSize, normalisePath, startNotFoundFlush, stopNotFoundFlush, isFlushing } from '../src/notFoundLog.js';

const fakePool = () => { const calls = []; return { calls, query: async (sql, params) => { calls.push({ sql, params }); return [{}]; } }; };

test('normalisePath', () => {
  assert.equal(normalisePath('/Old/Page/?a=1#x'), '/Old/Page');
  assert.equal(normalisePath('/'), '/');
  assert.equal(normalisePath('nope'), '');
  assert.equal(normalisePath('/' + 'a'.repeat(600)).length, 500);
});
test('aggregates hits, keeps the first referrer, keeps case', () => {
  resetPending();
  assert.equal(logNotFound('/Gone?x=1', 'https://a.com/p?q=1'), true);
  logNotFound('/Gone/', 'https://b.com/');
  logNotFound('/gone', '');
  const m = peekPending();
  assert.equal(m.get('/Gone').hits, 2);
  assert.equal(m.get('/Gone').referrer, 'https://a.com/p');
  assert.equal(m.get('/gone').hits, 1);
  resetPending();
});
test('referrer is cut to 300 characters and a later one fills an empty first', () => {
  resetPending();
  logNotFound('/x', '');
  logNotFound('/x', 'https://r.com/' + 'z'.repeat(400));
  assert.equal(peekPending().get('/x').referrer.length, 300);
  resetPending();
});
test('probe paths are ignored', () => {
  resetPending();
  for (const p of ['/favicon.ico', '/robots.txt', '/sitemap.xml', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/apple-touch-icon-120x120.png']) assert.equal(logNotFound(p, ''), false, p);
  assert.equal(logNotFound('/favicon.ico/x', ''), true);
  assert.equal(logNotFound('/other.png', ''), true);
  assert.equal(logNotFound('', ''), false);
  resetPending();
});
test('cap of 2000 distinct paths drops the oldest', () => {
  resetPending();
  for (let i = 0; i < 2005; i++) logNotFound('/p' + i, '');
  assert.equal(pendingSize(), 2000);
  const m = peekPending();
  assert.ok(!m.has('/p0') && !m.has('/p4') && m.has('/p5') && m.has('/p2004'));
  resetPending();
});
test('flush writes one multi-row upsert and clears the map', async () => {
  resetPending();
  logNotFound('/a', 'https://r.com/');
  logNotFound('/a', '');
  logNotFound('/b', '');
  const pool = fakePool();
  assert.equal(await flushNow(pool), 2);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].sql, /INSERT INTO seo_404_log \(path, hits, referrer\) VALUES \(\?,\?,\?\),\(\?,\?,\?\) ON DUPLICATE KEY UPDATE hits = hits \+ VALUES\(hits\), last_seen = NOW\(\)/);
  assert.deepEqual(pool.calls[0].params, ['/a', 2, 'https://r.com/', '/b', 1, '']);
  assert.equal(pendingSize(), 0);
  assert.equal(await flushNow(pool), 0);
  assert.equal(pool.calls.length, 1);
});
test('flush never throws when the database fails', async () => {
  resetPending();
  logNotFound('/a', '');
  const orig = console.error; console.error = () => {};
  try { assert.equal(await flushNow({ query: async () => { throw new Error('down'); } }), 0); } finally { console.error = orig; }
  assert.equal(pendingSize(), 0);
});
test('buildUpsert / buildPrune', () => {
  assert.equal(buildUpsert(new Map()), null);
  const p = buildPrune(9000);
  assert.equal(p.length, 1);
  assert.match(p[0].sql, /last_seen < \(NOW\(\) - INTERVAL \? DAY\)/);
  assert.deepEqual(p[0].params, [90]);
  const q = buildPrune(10250);
  assert.equal(q.length, 2);
  assert.match(q[1].sql, /ORDER BY hits ASC, last_seen ASC LIMIT \?/);
  assert.deepEqual(q[1].params, [250]);
});
test('flusher is idempotent and can be stopped', () => {
  assert.equal(isFlushing(), false);
  const t = startNotFoundFlush(fakePool());
  assert.equal(startNotFoundFlush(fakePool()), t);
  assert.equal(isFlushing(), true);
  stopNotFoundFlush();
  assert.equal(isFlushing(), false);
});
