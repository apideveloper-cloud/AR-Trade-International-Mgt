import test from 'node:test';
import assert from 'node:assert/strict';
import { callApi, setFetch, setSleep } from '../src/growth/http.js';
import { fakeDb, res, scriptedFetch } from './growth_fake.js';

const setup = answers => { const db = fakeDb(), f = scriptedFetch(answers), waits = []; setFetch(f); setSleep(async ms => { waits.push(ms); }); return { db, f, waits }; };
test.after(() => { setFetch(null); setSleep(null); });

test('retries a 500 and a 429 then succeeds; logs every attempt', async () => {
  const { db, f, waits } = setup([res(500, 'boom'), res(429, '', { 'retry-after': '2' }), res(200, { a: 1 })]);
  const r = await callApi({ integration: 'x', action: 'act', url: 'https://h.test/p/q?apikey=SECRET', method: 'get' });
  assert.equal(r.ok, true); assert.deepEqual(r.data, { a: 1 }); assert.equal(f.calls.length, 3);
  assert.deepEqual(waits, [500, 2000]);
  assert.equal(db.logs.length, 3);
  assert.deepEqual(db.logs.map(l => [l.attempt, l.status, l.ok]), [[1, 500, 0], [2, 429, 0], [3, 200, 1]]);
});
test('log row has host + path only, never the query string', async () => {
  const { db } = setup([res(200, {})]);
  await callApi({ integration: 'bing', action: 'a', url: 'https://ssl.bing.com/x/y?apikey=SECRET123', method: 'POST', body: '{"k":"SECRET123"}' });
  const l = db.logs[0];
  assert.equal(l.target, 'ssl.bing.com/x/y'); assert.equal(l.method, 'POST'); assert.equal(l.integration, 'bing');
  assert.ok(!JSON.stringify(db.logs).includes('SECRET123'));
});
test('does not retry a 400 and reports the API message', async () => {
  const { f } = setup([res(400, { error: { message: 'bad thing' } }), res(200, {})]);
  const r = await callApi({ integration: 'x', action: 'a', url: 'https://h.test/' });
  assert.equal(r.ok, false); assert.equal(r.status, 400); assert.equal(r.error, 'bad thing'); assert.equal(f.calls.length, 1);
});
test('gives up after the retries and never throws', async () => {
  const { f } = setup(() => res(503, 'down'));
  const r = await callApi({ integration: 'x', action: 'a', url: 'https://h.test/', retries: 1 });
  assert.equal(r.ok, false); assert.equal(f.calls.length, 2);
});
test('a network error is retried, a timeout is reported plainly', async () => {
  const { f } = setup([new Error('socket hang up'), res(200, 'ok')]);
  const r = await callApi({ integration: 'x', action: 'a', url: 'https://h.test/' });
  assert.equal(r.ok, true); assert.equal(f.calls.length, 2);
  setFetch((u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
  const t = await callApi({ integration: 'x', action: 'a', url: 'https://h.test/', timeoutMs: 20, retries: 0 });
  assert.equal(t.ok, false); assert.match(t.error, /Timed out/);
});
