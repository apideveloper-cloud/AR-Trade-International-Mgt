import test from 'node:test';
import assert from 'node:assert/strict';
import { noteCatalogChange, _setDeps, _flushNow, BIG_CHANGE } from '../src/growth/changeHooks.js';

function setup({ flag = true, key = 'k123', domain = 'https://example.com', failing = {} } = {}) {
  const calls = { bust: 0, enqueue: [], urls: [], timers: 0 };
  const settings = { flags: { indexNow: flag }, indexNow: { key }, general: { preferredDomain: domain } };
  _setDeps({
    bust: async () => { calls.bust++; if (failing.bust) throw new Error('bust failed'); },
    getSettings: async () => { if (failing.settings) throw new Error('settings failed'); return settings; },
    query: async (sql, [ids]) => { if (failing.query) throw new Error('db down'); return ids.map(id => ({ id, name: 'Toner ' + id, slug: 'toner-' + id })); },
    enqueue: async (type, payload, opts) => { calls.enqueue.push({ type, payload, opts }); if (failing.enqueue) throw new Error('enqueue failed'); },
    queue: { add: u => calls.urls.push(u) },
    now: () => 1000000,
    setTimer: () => { calls.timers++; return {}; },
    clearTimer: () => {}
  });
  return calls;
}

test('a single change busts once and queues one IndexNow url', async () => {
  const c = setup();
  noteCatalogChange({ productIds: [7], reason: 'order' });
  await _flushNow();
  assert.equal(c.bust, 1);
  assert.equal(c.urls.length, 1);
  assert.match(c.urls[0], /^https:\/\/example\.com\//);
  assert.equal(c.enqueue.length, 0);
});

test('no IndexNow url when the flag is off, but the cache is still purged', async () => {
  const c = setup({ flag: false });
  noteCatalogChange({ productIds: [7], reason: 'order' });
  await _flushNow();
  assert.equal(c.bust, 1);
  assert.equal(c.urls.length, 0);
});

test('ten calls inside the debounce window collapse into one bust and keep every id', async () => {
  const c = setup();
  for (let i = 1; i <= 10; i++) noteCatalogChange({ productIds: [i], reason: 'order' });
  assert.equal(c.timers, 1);
  await _flushNow();
  assert.equal(c.bust, 1);
  assert.equal(c.urls.length, 10);
});

test('25 products enqueue the delayed sitemap job; one product does not', async () => {
  let c = setup();
  noteCatalogChange({ productIds: Array.from({ length: 25 }, (_, i) => i + 1), reason: 'inventory' });
  await _flushNow();
  assert.equal(c.enqueue.length, 1);
  assert.equal(c.enqueue[0].type, 'sitemap_resubmit');
  assert.equal(c.enqueue[0].opts.dedupeKey, 'sitemap_resubmit');
  assert.equal(c.enqueue[0].opts.runAt.getTime(), 1000000 + 15 * 60000);
  assert.ok(25 >= BIG_CHANGE);
  c = setup();
  noteCatalogChange({ productIds: [1], reason: 'order' });
  await _flushNow();
  assert.equal(c.enqueue.length, 0);
});

test('product_added enqueues the sitemap job even for one product', async () => {
  const c = setup();
  noteCatalogChange({ productIds: [1], reason: 'product_added' });
  await _flushNow();
  assert.equal(c.enqueue.length, 1);
});

test('errors in any dependency never propagate', async () => {
  const c = setup({ failing: { bust: 1, settings: 1, query: 1, enqueue: 1 } });
  assert.doesNotThrow(() => noteCatalogChange({ productIds: Array.from({ length: 30 }, (_, i) => i + 1), reason: 'product_added' }));
  await assert.doesNotReject(_flushNow());
  assert.equal(c.bust, 1);
  _setDeps({ setTimer: () => { throw new Error('timer'); } });
  assert.doesNotThrow(() => noteCatalogChange({ productIds: [1] }));
  _setDeps();
});
