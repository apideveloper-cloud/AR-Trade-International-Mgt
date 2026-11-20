import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSitemapCache } from '../src/seoHelpers.js';
import { buildFeed, feedItem, feedContext, FEED_CAP } from '../src/merchantFeed.js';
import { analyticsSnippet, indexNowKeyOf } from '../src/seoSchema.js';
import { analyticsFor, inject } from '../src/seo.js';

// ---------- sitemap cache ----------
test('cache: valid until markDirty, then rebuilds lazily', async () => {
  let t = 1000, n = 0;
  const c = makeSitemapCache({ now: () => t });
  const build = async () => ({ body: 'x' + ++n, count: 3 });
  assert.equal((await c.get('k', build)).body, 'x1');
  assert.equal((await c.get('k', build)).body, 'x1');
  c.markDirty();
  assert.equal(c.isValid('k'), false);
  assert.equal((await c.get('k', build)).body, 'x2');
  assert.equal(c.isValid('k'), true);
});
test('cache: 10-minute TTL by injected clock', async () => {
  let t = 0, n = 0;
  const c = makeSitemapCache({ now: () => t });
  const build = async () => ({ body: String(++n), count: 1 });
  await c.get('k', build);
  t = 599999; assert.equal((await c.get('k', build)).body, '1');
  t = 600000; const e = await c.get('k', build);
  assert.equal(e.body, '2'); assert.equal(e.at, 600000);
});
test('cache: concurrent requests share one in-flight rebuild; force rebuilds', async () => {
  let n = 0;
  const c = makeSitemapCache();
  const build = async () => { n++; await new Promise(r => setTimeout(r, 10)); return { body: 'b', count: 1 }; };
  const [a, b, d] = await Promise.all([c.get('k', build), c.get('k', build), c.get('k', build)]);
  assert.equal(n, 1); assert.equal(a, b); assert.equal(b, d);
  await c.get('k', build, true);
  assert.equal(n, 2);
});
test('cache: a build that started before markDirty stays stale; failed build is retried', async () => {
  const c = makeSitemapCache();
  const p = c.get('k', async () => { await new Promise(r => setTimeout(r, 10)); return { body: 'old', count: 0 }; });
  c.markDirty();
  await p;
  assert.equal(c.isValid('k'), false);
  let fail = true;
  const f = () => { if (fail) throw new Error('db'); return { body: 'ok', count: 1 }; };
  await assert.rejects(c.get('z', async () => f()));
  fail = false;
  assert.equal((await c.get('z', async () => f())).body, 'ok');
});

// ---------- merchant feed ----------
const NOW = new Date('2026-11-20T00:00:00Z');
const base = 'https://shop.test';
const P = { id: 7, sku: 'HP-230A', name: 'HP 230A Toner', slug: 'hp-230a-toner', img: '/api/uploads/a.jpg', price: 16200, stock: 5, active: 1, category_id: 2, brand: 'HP', part: 'CF230A' };
const settings = { general: { siteName: 'AR Trade' }, shipping: { zones: [{ id: 'dhaka', rate: 120 }, { id: 'outside', rate: null }] } };
const ctx = (s = settings) => feedContext({ base, settings: s, categories: [{ id: 2, title: 'Toner' }], now: NOW });

test('feedItem: basic item', () => {
  const it = feedItem(P, ctx());
  assert.equal(it.id, 'HP-230A');
  assert.equal(it.title, 'HP 230A Toner');
  assert.equal(it.link, base + '/product/hp-230a-toner');
  assert.equal(it.image_link, base + '/api/uploads/a.jpg');
  assert.equal(it.availability, 'in stock');
  assert.equal(it.price, '16200.00 BDT');
  assert.equal(it.sale_price, undefined);
  assert.equal(it.brand, 'HP'); assert.equal(it.mpn, 'CF230A'); assert.equal(it.condition, 'new');
  assert.equal(it.identifier_exists, undefined);
  assert.equal(it.product_type, 'Toner');
  assert.deepEqual(it.shipping, { country: 'BD', service: 'Standard', price: '120.00 BDT' });
  assert.ok(it.description.length > 0);
});
test('feedItem: id falls back to numeric id; description fallbacks', () => {
  const it = feedItem({ ...P, sku: '', description: '', short_desc: '<p>Short <b>text</b></p>' }, ctx());
  assert.equal(it.id, '7'); assert.equal(it.description, 'Short text');
  assert.match(feedItem({ ...P, description: '', short_desc: '' }, ctx()).description, /HP 230A/);
  assert.equal(feedItem({ ...P, description: 'x'.repeat(6000) }, ctx()).description.length <= 5000, true);
  assert.equal(feedItem({ ...P, name: 'n'.repeat(300) }, ctx()).title.length <= 150, true);
});
test('feedItem: sale price and effective date only for a future sale_ends', () => {
  const s = feedItem({ ...P, price: 900, old_price: 1000, sale_ends: '2026-12-01' }, ctx());
  assert.equal(s.price, '1000.00 BDT'); assert.equal(s.sale_price, '900.00 BDT');
  assert.equal(s.sale_price_effective_date, '2026-11-20T00:00:00.000Z/2026-12-01T17:59:59.000Z');
  const past = feedItem({ ...P, price: 900, old_price: 1000, sale_ends: '2026-11-01' }, ctx());
  assert.equal(past.sale_price, '900.00 BDT'); assert.equal(past.sale_price_effective_date, undefined);
  const none = feedItem({ ...P, price: 900, old_price: 1000 }, ctx());
  assert.equal(none.sale_price_effective_date, undefined);
  const noSale = feedItem({ ...P, price: 1000, old_price: 900 }, ctx());
  assert.equal(noSale.price, '1000.00 BDT'); assert.equal(noSale.sale_price, undefined);
});
test('feedItem: availability', () => {
  assert.equal(feedItem({ ...P, stock: 0 }, ctx()).availability, 'out of stock');
  assert.equal(feedItem({ ...P, stock: 0, stock_status: 'preorder' }, ctx()).availability, 'preorder');
  assert.equal(feedItem({ ...P, stock_status: 'backorder' }, ctx()).availability, 'backorder');
  assert.equal(feedItem({ ...P, stock: 0, stock_status: 'in_stock' }, ctx()).availability, 'in stock');
  assert.equal(feedItem({ ...P, stock_status: 'auto', stock: 3 }, ctx()).availability, 'in stock');
});
test('feedItem: gtin validity, identifier_exists, condition', () => {
  assert.equal(feedItem({ ...P, gtin: '12345678' }, ctx()).gtin, '12345678');
  assert.equal(feedItem({ ...P, gtin: '1234567890123' }, ctx()).gtin, '1234567890123');
  assert.equal(feedItem({ ...P, gtin: '123456789' }, ctx()).gtin, undefined);
  assert.equal(feedItem({ ...P, gtin: '12345abc' }, ctx()).gtin, undefined);
  const bare = feedItem({ ...P, part: '', gtin: '' }, ctx());
  assert.equal(bare.identifier_exists, 'no');
  assert.equal(feedItem({ ...P, part: '', gtin: '12345678' }, ctx()).identifier_exists, undefined);
  assert.equal(feedItem({ ...P, item_condition: 'Refurbished' }, ctx()).condition, 'refurbished');
  assert.equal(feedItem({ ...P, item_condition: 'used' }, ctx()).condition, 'used');
});
test('feedItem: shipping omitted without a numeric dhaka rate', () => {
  for (const s of [{}, { shipping: { zones: [{ id: 'dhaka', rate: null }] } }, { shipping: { zones: [{ id: 'outside', rate: 200 }] } }, { shipping: { zones: [{ id: 'dhaka', rate: '' }] } }])
    assert.equal(feedItem(P, ctx(s)).shipping, undefined);
  assert.equal(feedItem(P, ctx({ shipping: { zones: [{ id: 'dhaka', rate: 0 }] } })).shipping.price, '0.00 BDT');
});
test('feedItem: images, additional capped at 10', () => {
  const imgs = Array.from({ length: 15 }, (_, i) => `/g${i}.jpg`);
  const it = feedItem({ ...P, images: ['/api/uploads/a.jpg', ...imgs] }, ctx());
  assert.equal(it.additional_image_link.length, 10);
  assert.equal(it.additional_image_link[0], base + '/g0.jpg');
});
test('feedItem: skip reasons', () => {
  assert.deepEqual(feedItem({ ...P, price: 0 }, ctx()), { skip: 'no price' });
  assert.deepEqual(feedItem({ ...P, img: '' }, ctx()), { skip: 'no image' });
  assert.deepEqual(feedItem({ ...P, active: 0 }, ctx()), { skip: 'not active' });
  assert.deepEqual(feedItem({ ...P, noindex: 1 }, ctx()), { skip: 'noindex' });
  assert.deepEqual(feedItem({ ...P, name: '  ' }, ctx()), { skip: 'name empty' });
});
test('buildFeed: RSS, escaping, control characters, skipped counts, cap', () => {
  const r = buildFeed({ base, site: {}, settings, categories: [{ id: 2, title: 'Toner & Ink' }], now: NOW, products: [
    { ...P, name: 'A & B 5 > 4 <b>"q"</b>\u0001\u0008 end' }, { ...P, id: 8, price: 0 }, { ...P, id: 9, price: 0 }, { ...P, id: 10, img: '' }] });
  assert.match(r.xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0" xmlns:g="http:\/\/base.google.com\/ns\/1.0">/);
  assert.match(r.xml, /<channel>\n<title>AR Trade<\/title>\n<link>https:\/\/shop.test<\/link>/);
  assert.match(r.xml, /<g:title>A &amp; B 5 &gt; 4 &quot;q&quot; end<\/g:title>/);
  assert.match(r.xml, /<g:product_type>Toner &amp; Ink<\/g:product_type>/);
  assert.match(r.xml, /<g:shipping><g:country>BD<\/g:country><g:service>Standard<\/g:service><g:price>120.00 BDT<\/g:price><\/g:shipping>/);
  assert.ok(!/[\u0000-\u0008]/.test(r.xml));
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.skipped, [{ reason: 'no price', count: 2 }, { reason: 'no image', count: 1 }]);
  const many = Array.from({ length: FEED_CAP + 3 }, (_, i) => ({ ...P, id: i + 1, sku: '' }));
  const big = buildFeed({ base, settings, products: many, now: NOW });
  assert.equal(big.items.length, FEED_CAP);
});

// ---------- indexnow key ----------
test('indexNowKeyOf: only 32 lower-case hex', () => {
  const k = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  assert.equal(indexNowKeyOf({ indexNow: { key: k } }), k);
  for (const bad of ['', 'A1B2C3D4E5F60718293A4B5C6D7E8F90', k + 'a', k.slice(1), 'g'.repeat(32), undefined]) assert.equal(indexNowKeyOf({ indexNow: { key: bad } }), '');
  assert.equal(indexNowKeyOf({}), ''); assert.equal(indexNowKeyOf(undefined), '');
});

// ---------- analytics ----------
test('analyticsSnippet: GA4, GTM, both, none, invalid', () => {
  const g = analyticsSnippet({ ga4: 'G-ABC1234567' });
  assert.match(g, /^<script>window.addEventListener\('load',function\(\)\{setTimeout\(/);
  assert.match(g, /,2000\)\}\);<\/script>$/);
  assert.ok(g.includes('"G-ABC1234567"') && g.includes('anonymize_ip:true') && g.includes('gtag/js') && !g.includes('gtm.js'));
  const t = analyticsSnippet({ gtm: 'GTM-ABCD12' });
  assert.ok(t.includes('"GTM-ABCD12"') && t.includes('gtm.js') && !t.includes('gtag/js'));
  const both = analyticsSnippet({ ga4: 'G-ABC1234567', gtm: 'GTM-ABCD12' });
  assert.equal((both.match(/<script>/g) || []).length, 1); assert.ok(both.includes('gtag/js') && both.includes('gtm.js'));
  assert.equal(analyticsSnippet({}), ''); assert.equal(analyticsSnippet(undefined), '');
  for (const bad of ['g-ABC1234567', 'G-abc1234567', 'G-AB', "G-ABCD');alert(1)//", 'G-ABCDEFGHIJKLM'])
    assert.equal(analyticsSnippet({ ga4: bad }), '');
  assert.equal(analyticsSnippet({ gtm: 'GTM-</script>' }), '');
});
test('analyticsFor / inject: public indexable pages only', () => {
  const v = { ga4: 'G-ABC1234567' };
  assert.ok(analyticsFor({ path: '/shop', verification: v }).includes('G-ABC1234567'));
  assert.equal(analyticsFor({ path: '/shop', noindex: true, verification: v }), '');
  for (const p of ['/admin', '/admin/x', '/hub', '/email', '/field', '/account', '/cart', '/checkout', '/track', '/success/1', '/wishlist', '/compare', '/login'])
    assert.equal(analyticsFor({ path: p, verification: v }), '', p);
  assert.equal(analyticsFor({ path: '/nope', verification: v }, 404), '');
  const html = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';
  const on = inject(html, base, { path: '/shop', title: 'T', desc: 'D', verification: v });
  assert.ok(on.includes("addEventListener('load'") && on.indexOf("addEventListener('load'") < on.indexOf('</head>'));
  const off = inject(html, base, { path: '/shop', title: 'T', desc: 'D', verification: {} });
  assert.ok(!off.includes('addEventListener'));
  assert.equal(off, inject(html, base, { path: '/shop', title: 'T', desc: 'D' }));
});
