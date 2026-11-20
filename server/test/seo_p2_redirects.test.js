import test from 'node:test';
import assert from 'node:assert/strict';
import { followRedirect, makeRedirectLookup, redirectTarget } from '../src/seoHelpers.js';
import { imageEntry, imageLd } from '../src/seoSchema.js';

const rows = o => async s => o[s] || null;

test('redirect lookup: hit, miss, code kept', async () => {
  const r = makeRedirectLookup({ fetch: rows({ '/product/old': { target: '/product/new', code: 302 } }) });
  assert.deepEqual(await r.lookup('/product/old'), { target: '/product/new', code: 302 });
  assert.equal(await r.lookup('/product/none'), null);
});
test('redirect lookup: bad code falls back to 301; absolute https kept', async () => {
  const r = makeRedirectLookup({ fetch: rows({ '/a': { target: 'https://example.com/x', code: 999 } }) });
  assert.deepEqual(await r.lookup('/a'), { target: 'https://example.com/x', code: 301 });
  assert.equal(redirectTarget('https://example.com/a b'), 'https://example.com/a b');
  assert.equal(redirectTarget('/p/a b'), '/p/a%20b');
});
test('redirect lookup: chain of 3 is followed, longer stops after 3 hops', async () => {
  const t = { '/a': { target: '/b', code: 301 }, '/b': { target: '/c', code: 301 }, '/c': { target: '/d', code: 301 }, '/d': { target: '/e', code: 301 }, '/e': { target: '/f', code: 301 } };
  const r = makeRedirectLookup({ fetch: rows(t) });
  assert.equal((await r.lookup('/a')).target, '/d'.replace('/d', '/e')); // a->b->c->d->e: first row + 3 hops
  assert.equal((await r.lookup('/c')).target, '/f');
  assert.equal(followRedirect('/a', s => t[s], 3).target, '/e');
});
test('redirect lookup: loop and self-target give no redirect', async () => {
  const r = makeRedirectLookup({ fetch: rows({ '/a': { target: '/b' }, '/b': { target: '/a' }, '/s': { target: '/s' } }) });
  assert.equal(await r.lookup('/a'), null);
  assert.equal(await r.lookup('/s'), null);
});
test('redirect lookup: memo for the ttl, clear() and ttl expiry re-read', async () => {
  let n = 0, now = 0; const data = { '/a': { target: '/b', code: 301 } };
  const r = makeRedirectLookup({ fetch: async s => { n++; return data[s]; }, now: () => now });
  await r.lookup('/a'); const first = n; await r.lookup('/a');
  assert.equal(n, first);
  r.clear(); await r.lookup('/a'); assert.ok(n > first);
  const before = n; now = 31000; await r.lookup('/a'); assert.ok(n > before);
});
test('redirect lookup: fetch errors propagate to the caller (handler catches => no redirect)', async () => {
  const r = makeRedirectLookup({ fetch: async () => { throw new Error('x'); } });
  await assert.rejects(r.lookup('/a'));
});
test('image JSON-LD: plain URL without alt, ImageObject with alt; sitemap entry escapes', () => {
  assert.deepEqual(imageLd('https://s.bd', [{ path: '/u/a.jpg' }, { path: 'https://c.bd/b.jpg', alt: 'Toner "12A" <x>' }, { path: '' }]),
    ['https://s.bd/u/a.jpg', { '@type': 'ImageObject', url: 'https://c.bd/b.jpg', caption: 'Toner "12A" <x>' }]);
  assert.equal(imageEntry('https://s.bd/a.jpg', ''), '<image:image><image:loc>https://s.bd/a.jpg</image:loc></image:image>');
  const e = imageEntry('https://s.bd/a.jpg', 'A & <B>');
  assert.match(e, /<image:caption>A &amp; &lt;B&gt;<\/image:caption><image:title>A &amp; &lt;B&gt;<\/image:title>/);
});
