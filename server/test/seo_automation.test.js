import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { normaliseSeoSettings, SEO_DEFAULTS } from '../src/seoSettings.js';
import {
  generateIndexNowKey, classifyAdminWrite, urlOf, resolveUrls, pingIndexNow, IndexNowQueue, makeAfterAdminWrite, hostOf
} from '../src/seoAutomation.js';

const n = x => normaliseSeoSettings(x);

// ---------- settings ----------
test('indexNow key validation', () => {
  assert.equal(SEO_DEFAULTS.indexNow.key, '');
  const good = 'a'.repeat(16) + '0123456789abcdef';
  assert.equal(n({ indexNow: { key: good } }).settings.indexNow.key, good);
  assert.equal(n({ indexNow: { key: '' } }).errors.length, 0);
  for (const bad of ['abc', good.toUpperCase(), good + 'a', 'g'.repeat(32), 12345]) assert.equal(n({ indexNow: { key: bad } }).errors.length, 1, String(bad));
});

test('indexNow and merchantFeed flags are editable, aiGenerate stays false with a note', () => {
  const r = n({ flags: { indexNow: true, merchantFeed: 'true', aiGenerate: true } });
  assert.equal(r.settings.flags.indexNow, true);
  assert.equal(r.settings.flags.merchantFeed, true);
  assert.equal(r.settings.flags.aiGenerate, false);
  assert.equal(r.errors.length, 0);
  assert.equal(r.notes.length, 1);
  assert.equal(n({ flags: { indexNow: 'no' } }).settings.flags.indexNow, false);
});

// ---------- key ----------
test('generated key is 32 lowercase hex and varies', () => {
  const a = generateIndexNowKey(), b = generateIndexNowKey();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

// ---------- classify ----------
test('classifyAdminWrite covers every route family', () => {
  const c = (m, p) => classifyAdminWrite(m, p);
  assert.deepEqual(c('PUT', '/api/admin/products/12'), { kind: 'product', id: '12' });
  assert.deepEqual(c('POST', '/api/admin/products'), { kind: 'product', id: '' });
  assert.deepEqual(c('PUT', '/api/admin/products/12/specs?x=1'), { kind: 'product', id: '12' });
  assert.deepEqual(c('DELETE', '/api/admin/products/12'), { kind: 'product', id: '12' });
  assert.deepEqual(c('POST', '/api/admin/categories'), { kind: 'category', id: '' });
  assert.deepEqual(c('PUT', '/api/admin/categories/7'), { kind: 'category', id: '7' });
  assert.deepEqual(c('DELETE', '/api/admin/categories/7'), { kind: 'category', id: '7' });
  assert.deepEqual(c('PUT', '/api/admin/blog/3'), { kind: 'blog', id: '3' });
  assert.deepEqual(c('POST', '/api/admin/blog'), { kind: 'blog', id: '' });
  assert.deepEqual(c('DELETE', '/api/admin/pages/4'), { kind: 'page', id: '4' });
  assert.deepEqual(c('PUT', '/api/admin/content/home'), { kind: 'other', id: 'home' });
  assert.deepEqual(c('PUT', '/api/admin/settings'), { kind: 'settings', id: '' });
  assert.deepEqual(c('PUT', '/api/admin/seo/settings'), { kind: 'settings', id: '' });
  assert.deepEqual(c('PUT', '/api/admin/seo/robots'), { kind: 'settings', id: '' });
  assert.deepEqual(c('PUT', '/api/admin/seo/brands/hp'), { kind: 'brand', id: 'hp' });
  assert.deepEqual(c('PUT', '/api/admin/seo/item/product/9'), { kind: 'product', id: '9' });
  assert.deepEqual(c('PUT', '/api/admin/seo/item/blog/my-post'), { kind: 'blog', id: 'my-post' });
  assert.deepEqual(c('PUT', '/api/admin/seo/product/9/slug'), { kind: 'product', id: '9' });
  assert.deepEqual(c('PUT', '/api/admin/seo/page/faq/slug'), { kind: 'page', id: 'faq' });
  assert.deepEqual(c('POST', '/api/admin/seo/product/9/alt-autofill'), { kind: 'product', id: '9' });
  for (const p of ['bulk', 'recalculate', 'redirects', 'import/apply', 'history/3/revert']) assert.equal(c('POST', '/api/admin/seo/' + p).kind, 'seo', p);
  assert.equal(c('PUT', '/seo/redirects/4').kind, 'seo'); // prefix is optional
});

test('classifyAdminWrite ignores reads and unrelated writes', () => {
  assert.equal(classifyAdminWrite('GET', '/api/admin/products/1'), null);
  assert.equal(classifyAdminWrite('POST', '/api/admin/orders/5/status'), null);
  assert.equal(classifyAdminWrite('POST', '/api/admin/login'), null);
  assert.equal(classifyAdminWrite('POST', '/api/admin/seo/preview'), null);
  assert.equal(classifyAdminWrite('POST', '/api/admin/seo/import/preview'), null);
  assert.equal(classifyAdminWrite('POST', '/api/admin/seo/automation/indexnow/test'), null);
  assert.equal(classifyAdminWrite('DELETE', '/api/admin/seo/404/3'), null);
  assert.equal(classifyAdminWrite('PUT', '/api/admin/staff/3'), null);
  assert.equal(classifyAdminWrite('POST', ''), null);
});

// ---------- urlOf ----------
test('urlOf builds absolute URLs', () => {
  const b = 'https://shop.example.com/';
  assert.equal(urlOf('product', { id: 5, name: 'HP 230A Toner', slug: 'hp-230a-toner' }, b), 'https://shop.example.com/product/hp-230a-toner');
  assert.equal(urlOf('product', { id: 5, name: 'HP 230A Toner' }, b), 'https://shop.example.com/product/hp-230a-toner-5'); // legacy form
  assert.equal(urlOf('category', { id: 7 }, b), 'https://shop.example.com/shop/7');
  assert.equal(urlOf('brand', { slug: 'hp' }, b), 'https://shop.example.com/brand/hp');
  assert.equal(urlOf('blog', { slug: 'a-post' }, b), 'https://shop.example.com/blog/a-post');
  assert.equal(urlOf('page', { slug: 'printer-repair' }, b), 'https://shop.example.com/services/printer-repair');
  assert.equal(urlOf('blog', {}, b), '');
  assert.equal(urlOf('blog', { slug: 'x' }, ''), '');
  assert.equal(urlOf('nope', { slug: 'x' }, b), '');
});

test('resolveUrls does one batched lookup', async () => {
  const calls = [];
  const query = async (sql, params) => { calls.push([sql, params]); return [{ id: 5, name: 'X Y', slug: 'x-y', }]; };
  assert.deepEqual(await resolveUrls({ kind: 'product', id: '5' }, null, 'https://h.com', query), ['https://h.com/product/x-y']);
  assert.equal(calls.length, 1);
  assert.deepEqual(await resolveUrls({ kind: 'settings', id: '' }, null, 'https://h.com', query), ['https://h.com/']);
  assert.deepEqual(await resolveUrls({ kind: 'category', id: '3' }, null, 'https://h.com', query), ['https://h.com/shop/3']);
  assert.equal(calls.length, 1); // no further queries
  const blog = await resolveUrls({ kind: 'blog', id: '' }, { id: 9, slug: 'new-post' }, 'https://h.com', async (s, p) => { calls.push([s, p]); return [{ slug: 'new-post' }]; });
  assert.deepEqual(blog, ['https://h.com/blog/new-post']);
  assert.match(calls.at(-1)[0], /blog_posts WHERE id = \?/);
  assert.deepEqual(await resolveUrls({ kind: 'product', id: '' }, null, 'https://h.com', query), []);
  assert.deepEqual(await resolveUrls({ kind: 'product', id: '5' }, null, '', query), []);
});

// ---------- pingIndexNow ----------
const fakeFetch = (status, seen = []) => async (url, init) => { seen.push({ url, init }); return { status }; };

test('pingIndexNow sends the documented payload; 200 and 202 are ok', async () => {
  for (const st of [200, 202]) {
    const seen = [];
    const r = await pingIndexNow({ fetchImpl: fakeFetch(st, seen), host: 'shop.example.com', key: 'k'.repeat(32), urls: ['https://shop.example.com/a'] });
    assert.deepEqual(r, { ok: true, status: st, error: '' });
    assert.equal(seen[0].url, 'https://api.indexnow.org/indexnow');
    assert.equal(seen[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(seen[0].init.body), { host: 'shop.example.com', key: 'k'.repeat(32), keyLocation: `https://shop.example.com/${'k'.repeat(32)}.txt`, urlList: ['https://shop.example.com/a'] });
  }
});

test('pingIndexNow reports 400, network errors and timeouts without throwing', async () => {
  const base = { host: 'h.com', key: 'a'.repeat(32), urls: ['https://h.com/'] };
  const bad = await pingIndexNow({ ...base, fetchImpl: fakeFetch(400) });
  assert.equal(bad.ok, false); assert.equal(bad.status, 400); assert.match(bad.error, /400/);
  const net = await pingIndexNow({ ...base, fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.deepEqual(net, { ok: false, status: 0, error: 'ECONNRESET' });
  const slow = await pingIndexNow({ ...base, timeoutMs: 20, fetchImpl: (u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))) });
  assert.equal(slow.ok, false); assert.match(slow.error, /Timed out/);
  assert.equal((await pingIndexNow({ ...base, urls: [], fetchImpl: fakeFetch(200) })).ok, false);
});

// ---------- queue ----------
function fakeTimer() {
  const t = { fn: null, ms: 0, sets: 0, cleared: 0, set(fn, ms) { t.fn = fn; t.ms = ms; t.sets++; return 1; }, clear() { t.cleared++; t.fn = null; } };
  return t;
}

test('IndexNowQueue debounces 60 s, de-duplicates and batches of 100', async () => {
  const timer = fakeTimer(), sent = [];
  const q = new IndexNowQueue({ timer, send: async urls => { sent.push(urls); return { ok: true, status: 200, error: '' }; }, now: () => 0 });
  q.add('https://h.com/a'); q.add('https://h.com/a'); q.add('https://h.com/b');
  assert.equal(timer.ms, 60000); assert.equal(timer.sets, 1);
  assert.equal(q.queued, 2); assert.equal(sent.length, 0);
  for (let i = 0; i < 250; i++) q.add('https://h.com/p' + i);
  assert.equal(q.queued, 252);
  timer.fn(); // the debounce fires
  await new Promise(r => setImmediate(r));
  assert.deepEqual(sent.map(s => s.length), [100, 100, 52]);
  assert.equal(new Set(sent.flat()).size, 252);
  assert.equal(q.queued, 0);
  assert.deepEqual(q.last, { at: new Date(0).toISOString(), count: 52, ok: true, status: 200, error: '' });
  q.add('https://h.com/z'); assert.equal(timer.sets, 2); // a new window opens after the flush
});

test('IndexNowQueue keeps the failure status and never throws', async () => {
  const q = new IndexNowQueue({ timer: fakeTimer(), send: async () => { throw new Error('boom'); } });
  q.add('https://h.com/a');
  await q.flush();
  assert.equal(q.last.ok, false); assert.equal(q.last.error, 'boom'); assert.equal(q.last.count, 1);
  q.add(''); q.add(null); assert.equal(q.queued, 0);
});

// ---------- middleware ----------
const mkReq = (method, url) => ({ method, originalUrl: url, url });
function mkRes(status = 200) { const r = new EventEmitter(); r.statusCode = status; r.json = b => b; return r; }
const settle = () => new Promise(r => setTimeout(r, 15));
const on = { general: { preferredDomain: 'https://shop.example.com' }, flags: { indexNow: true }, indexNow: { key: 'a'.repeat(32) } };

function harness(rawSettings, rows = [{ id: 5, name: 'X', slug: 'x' }]) {
  const adds = [], bust = { n: 0 }, queries = [];
  const settings = normaliseSeoSettings(rawSettings).settings;
  const mw = makeAfterAdminWrite({
    bust: async () => { bust.n++; }, getSettings: async () => settings,
    query: async (sql, p) => { queries.push([sql, p]); return rows; }, queue: { add: u => adds.push(u) }
  });
  return { mw, adds, bust, queries };
}

test('middleware always purges, then queues the URL when IndexNow is ready', async () => {
  const h = harness(on);
  const res = mkRes(), req = mkReq('PUT', '/api/admin/products/5');
  let nexted = 0;
  h.mw(req, res, () => nexted++);
  assert.equal(nexted, 1);
  res.emit('finish'); await settle();
  assert.equal(h.bust.n, 1);
  assert.deepEqual(h.adds, ['https://shop.example.com/product/x']);
  assert.equal(h.queries.length, 1);
});

test('middleware purges but does not queue when flag off, key missing or domain missing; ignores failures and reads', async () => {
  for (const raw of [{ ...on, flags: { indexNow: false } }, { ...on, indexNow: { key: '' } }, { ...on, general: { preferredDomain: '' } }]) {
    const h = harness(raw), res = mkRes();
    h.mw(mkReq('PUT', '/api/admin/categories/2'), res, () => {}); res.emit('finish'); await settle();
    assert.equal(h.bust.n, 1); assert.deepEqual(h.adds, []); assert.equal(h.queries.length, 0);
  }
  const h = harness(on); let res = mkRes(500);
  h.mw(mkReq('PUT', '/api/admin/products/5'), res, () => {}); res.emit('finish'); await settle();
  assert.equal(h.bust.n, 0);
  res = mkRes(); h.mw(mkReq('GET', '/api/admin/products/5'), res, () => {}); res.emit('finish'); await settle();
  assert.equal(h.bust.n, 0);
});

test('middleware uses the created id of a POST and never throws on a failing purge or settings', async () => {
  const h = harness(on, [{ slug: 'new-post' }]);
  const res = mkRes();
  h.mw(mkReq('POST', '/api/admin/blog'), res, () => {});
  res.json({ id: 9, slug: 'new-post' });
  res.emit('finish'); await settle();
  assert.deepEqual(h.adds, ['https://shop.example.com/blog/new-post']);
  const bad = makeAfterAdminWrite({ bust: async () => { throw new Error('x'); }, getSettings: async () => { throw new Error('db down'); }, query: async () => [] });
  const r2 = mkRes();
  assert.doesNotThrow(() => bad(mkReq('PUT', '/api/admin/products/1'), r2, () => {}));
  assert.doesNotThrow(() => r2.emit('finish'));
  await settle();
});

test('middleware looks a deleted blog post up before the delete runs', async () => {
  const h = harness(on, [{ slug: 'gone' }]);
  const res = mkRes();
  h.mw(mkReq('DELETE', '/api/admin/blog/4'), res, () => {});
  await settle(); // lookup done while the handler would still be running
  assert.equal(h.queries.length, 1);
  res.emit('finish'); await settle();
  assert.deepEqual(h.adds, ['https://shop.example.com/blog/gone']);
});

test('hostOf accepts only an https origin', () => {
  assert.equal(hostOf({ general: { preferredDomain: 'https://a.com' } }), 'a.com');
  assert.equal(hostOf({ general: { preferredDomain: '' } }), '');
  assert.equal(hostOf({ general: { preferredDomain: 'http://a.com' } }), '');
  assert.equal(hostOf(null), '');
});

test('submitAllBatches moves every sitemap URL onto the public host, drops duplicates and bad values, and cuts batches', async () => {
  const { submitAllBatches } = await import('../src/seoAutomation.js');
  const r = submitAllBatches([
    'http://localhost:4000/product/a', 'https://other.example/product/a', 'https://x.test/shop/toner?page=2', 'https://x.test/shop/toner?page=2',
    'ftp://x.test/nope', 'not a url', '', null, 'https://x.test/'
  ], 'artradeinternational.com');
  assert.equal(r.total, 3);
  assert.deepEqual(r.batches[0], ['https://artradeinternational.com/product/a', 'https://artradeinternational.com/shop/toner?page=2', 'https://artradeinternational.com/']);
  const many = Array.from({ length: 12001 }, (_, i) => `https://x.test/p/${i}`);
  const b = submitAllBatches(many, 'a.com', 5000);
  assert.equal(b.total, 12001);
  assert.deepEqual(b.batches.map(x => x.length), [5000, 5000, 2001]);
  assert.deepEqual(submitAllBatches([], 'a.com'), { total: 0, batches: [] });
});
