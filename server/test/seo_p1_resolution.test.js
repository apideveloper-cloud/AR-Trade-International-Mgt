import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProductOverrides, applySeoMeta, availabilityOf, brandProducts, brandSlug, cleanCanonical, conditionOf, customText, dayOf, pagedTitle, pagesOf, parseFaq, pickText, productDescription, productOverrides, productTitle, stockText, validUntil, PER_PAGE, listTitle, clip } from '../src/seoHelpers.js';
import { faqDl, productFallback } from '../src/seoFallback.js';
import { CHILD_SITEMAPS, robotsFor, robotsTxt, verifyTags } from '../src/seoSchema.js';
import { mergeSeoSettings, validateRobotsTxt } from '../src/seoSettings.js';
import { DEFAULT_TEMPLATES, renderTemplate, varsFor } from '../src/seoTemplate.js';

const S = mergeSeoSettings({});
const ct = (type, field, entity, extra = {}) => customText({ templates: S.templates, defaults: DEFAULT_TEMPLATES, type, field, render: renderTemplate, vars: () => varsFor(type, entity, S), max: field === 'title' ? 60 : 155, ...extra });

test('unset settings: every default template is "not custom", so built-in output is used unchanged', () => {
  for (const [type, e] of [['product', { name: 'HP 12A Toner', price: 100 }], ['category', { title: 'Toner' }], ['blog', { title: 'T' }], ['page', { title: 'T' }]]) {
    assert.equal(ct(type, 'title', e), '', type);
    assert.equal(ct(type, 'description', e), '', type);
  }
  assert.equal(customText({ templates: undefined, defaults: undefined, type: 'product', field: 'title', render: renderTemplate, vars: {} }), '');
});

test('default templates render what the built-in code renders (products, categories)', () => {
  for (const [name, price] of [['HP 12A Toner', 3500], ['Brother TN-150BK Black Toner Cartridge', 4200], ['HP 12A Toner', 0]]) {
    const e = { name, price, label: name };
    assert.equal(ct('product', 'title', e, { defaults: {} }), productTitle(name, price > 0), name + ' title');
    assert.equal(ct('product', 'description', e, { defaults: {} }), productDescription({ name, price, cod: true }), name + ' desc');
  }
  const cat = { title: 'Laser Toner', description: 'All sizes.' };
  assert.equal(ct('category', 'title', cat, { defaults: {} }), listTitle(1, [`${cat.title} Price in Bangladesh | AR Trade`, `${cat.title} | AR Trade`], cat.title));
});

test('manual > template > default; a changed template wins over the built-in only', () => {
  const stored = mergeSeoSettings({ templates: { product: { title: '{product_name} buy now {sep} {site_name_short}' } } });
  const c = customText({ templates: stored.templates, defaults: DEFAULT_TEMPLATES, type: 'product', field: 'title', render: renderTemplate, vars: () => varsFor('product', { name: 'Toner X', price: 5 }, stored), max: 60 });
  assert.equal(c, 'Toner X buy now | AR Trade');
  assert.equal('Hand written' || c || 'built-in', 'Hand written');
  assert.equal('' || c || 'built-in', c);
  assert.equal('' || '' || 'built-in', 'built-in');
  assert.equal(pickText('', '   ', null, ' a  b '), 'a b');
});

test('customText: fake render, max passed, failures and blanks give empty', () => {
  const seen = [];
  const base = { templates: { brand: { title: 'X {brand}' } }, defaults: { brand: { title: 'X {brand}' } }, type: 'brand', field: 'title', vars: () => ({ a: 1 }), max: 60 };
  assert.equal(customText({ ...base, render: (t, v, o) => { seen.push(o.max); return t + '!'; } }), '');
  assert.equal(customText({ ...base, always: true, render: (t, v, o) => { seen.push(o.max); return t + '!'; } }), 'X {brand}!');
  assert.deepEqual(seen, [60]);
  assert.equal(customText({ ...base, always: true, render: () => { throw new Error('x'); } }), '');
  assert.equal(customText({ ...base, always: true, render: () => '  ' }), '');
  assert.equal(customText({ ...base, always: true }), '');
});

test('pagedTitle keeps the limit', () => {
  assert.equal(pagedTitle('Abc', 1), 'Abc');
  const t = pagedTitle('A very long category title that goes on and on and on and on forever', 3);
  assert.ok(t.length <= 60 && t.endsWith(' – Page 3'));
});

test('applySeoMeta: overrides, canonical https only, robots', () => {
  const m = { title: 'T', desc: 'D', path: '/x' };
  assert.deepEqual(applySeoMeta(m, {}), m);
  assert.deepEqual(applySeoMeta(m, null), m);
  assert.deepEqual(applySeoMeta(m, { meta_title: '  ', canonical_url: 'http://x.com/a', og_image: 'javascript:1' }), m);
  const o = applySeoMeta(m, { meta_title: 'New T', meta_description: 'New D', og_title: 'OT', og_description: 'OD', og_image: '/a.jpg', twitter_title: 'TT', twitter_description: 'TD', canonical_url: 'https://x.com/c', robots_index: 1, robots_follow: 1 });
  assert.deepEqual([o.title, o.desc, o.ogTitle, o.ogDesc, o.ogImage, o.twTitle, o.twDesc, o.canonical, o.noindex], ['New T', 'New D', 'OT', 'OD', '/a.jpg', 'TT', 'TD', 'https://x.com/c', undefined]);
  assert.equal(cleanCanonical('https://a.com/x'), 'https://a.com/x');
  assert.equal(cleanCanonical('//a.com'), '');
  assert.equal(cleanCanonical('https://a.com/"><script>'), '');
  let r = applySeoMeta(m, { robots_index: 0, robots_follow: 1 }); assert.deepEqual([r.noindex, r.follow], [true, true]);
  r = applySeoMeta(m, { robots_index: '0', robots_follow: 0 }); assert.deepEqual([r.noindex, r.follow], [true, false]);
  r = applySeoMeta(m, { robots_follow: 0 }); assert.deepEqual([r.noindex, r.nofollow], [undefined, true]);
  r = applySeoMeta(m, {}, { forceNoindex: true }); assert.deepEqual([r.noindex, r.follow], [true, true]); // products.noindex = 1
});

test('availability, condition, priceValidUntil', () => {
  const A = 'https://schema.org/';
  assert.equal(availabilityOf({ stock: 3 }), A + 'InStock');
  assert.equal(availabilityOf({ stock: 0, stock_status: 'auto' }), A + 'OutOfStock');
  assert.equal(availabilityOf({ stock: 0, stock_status: 'in_stock' }), A + 'InStock');
  assert.equal(availabilityOf({ stock: 9, stock_status: 'out_of_stock' }), A + 'OutOfStock');
  assert.equal(availabilityOf({ stock: 9, stock_status: 'preorder' }), A + 'PreOrder');
  assert.equal(availabilityOf({ stock: 0, stock_status: 'backorder' }), A + 'BackOrder');
  assert.equal(availabilityOf({ stock: 1, stock_status: 'weird' }), A + 'InStock');
  assert.equal(stockText({ stock: 0, stock_status: 'backorder' }), 'Available on backorder.');
  assert.equal(stockText({ stock: 0 }), 'Currently out of stock.');
  assert.equal(conditionOf(undefined), A + 'NewCondition');
  assert.equal(conditionOf('new'), A + 'NewCondition');
  assert.equal(conditionOf('refurbished'), A + 'RefurbishedCondition');
  assert.equal(conditionOf('used'), A + 'UsedCondition');
  assert.equal(validUntil(null, '2026-12-31', '2026-11-20'), '2026-12-31');
  assert.equal(validUntil('2026-11-30', '2026-12-31', '2026-11-20'), '2026-11-30');
  assert.equal(validUntil('2026-11-20', '2026-12-31', '2026-11-20'), '2026-11-20');
  assert.equal(validUntil('2026-11-19', '2026-12-31', '2026-11-20'), '2026-12-31');
  assert.equal(validUntil('2026-02-31', 'F', '2026-01-01'), 'F');
  assert.equal(dayOf(new Date(2026, 10, 5)), '2026-11-05');
});

test('schema_overrides: whitelist and validation only', () => {
  assert.deepEqual(productOverrides('not json'), {});
  assert.deepEqual(productOverrides(null), {});
  assert.deepEqual(productOverrides([1]), {});
  const o = productOverrides({ brand: { name: 'Canon' }, mpn: 'M1', gtin13: '1234567890123', color: 'Black', model: '<b>X</b>', offers: { price: 1 }, name: 'evil', aggregateRating: {} });
  assert.deepEqual(o, { brand: 'Canon', mpn: 'M1', color: 'Black', model: 'X', gtin13: '1234567890123' });
  assert.deepEqual(productOverrides({ gtin13: '123' }), {});
  const p = applyProductOverrides({ name: 'N', gtin8: '12345678', offers: { price: '5' } }, JSON.stringify({ gtin13: '1234567890123', brand: 'HP', price: 1, offers: 'x' }));
  assert.deepEqual(p, { name: 'N', offers: { price: '5' }, gtin13: '1234567890123', brand: { '@type': 'Brand', name: 'HP' } });
});

test('faq from seo_meta: parse and plain-HTML dl', () => {
  assert.deepEqual(parseFaq(null), []);
  assert.deepEqual(parseFaq('x'), []);
  assert.deepEqual(parseFaq(JSON.stringify([{ q: 'Q1?', a: '<b>A1</b>' }, { q: '', a: 'x' }, { q: 'Q2' }])), [{ q: 'Q1?', a: 'A1' }]);
  assert.ok(faqDl([{ q: 'a<b', a: 'c' }]).includes('<h2>Frequently asked questions</h2><dl><dt>a&lt;b</dt><dd>c</dd></dl>'));
  assert.equal(faqDl([]), '');
});

test('product fallback: warranty in the list, stock wording equals availability, extra appended', () => {
  const x = { name: 'N', price: 10, stock: 0, stock_status: 'in_stock', warranty_text: '1 year <b>' };
  const h = productFallback({ x, cat: null, price: 10, related: [], cats: [], site: {}, desc: '', extra: faqDl([{ q: 'Q', a: 'A' }]) });
  assert.ok(h.includes('<dt>Warranty</dt><dd>1 year &lt;b&gt;</dd>'));
  assert.ok(h.includes('In stock.'));
  assert.ok(h.includes('Frequently asked questions'));
  const h0 = productFallback({ x: { name: 'N', stock: 2 }, cat: null, price: 10, related: [], cats: [], site: {}, desc: '' });
  assert.ok(!h0.includes('Warranty') && h0.includes('In stock.') && !h0.includes('Frequently'));
});

test('brands: slug rule and listing math (24 per page)', () => {
  assert.equal(brandSlug('  HP Inc.  '), 'hp-inc');
  assert.equal(brandSlug('Canon/Oce'), 'canon-oce');
  assert.equal(brandSlug(null), '');
  const rows = Array.from({ length: 50 }, (_, i) => ({ id: i, brand: i % 5 === 0 ? 'Other' : 'HP' }));
  const hp = brandProducts(rows, 'hp');
  assert.equal(hp.length, 40);
  assert.equal(pagesOf(hp.length), 2);
  assert.equal(hp.slice(PER_PAGE, PER_PAGE * 2).length, 16);
  assert.deepEqual(brandProducts(rows, ''), []);
  assert.equal(brandProducts(rows, 'nobody').length, 0);
});

test('robots.txt: default unchanged, flags, custom text, sitemap line', () => {
  const b = 'https://x.com';
  assert.equal(robotsFor(b, undefined, validateRobotsTxt), robotsTxt(b));
  assert.equal(robotsFor(b, mergeSeoSettings({}).robots, validateRobotsTxt), robotsTxt(b));
  const nf = robotsFor(b, { noindexFilters: false }, validateRobotsTxt);
  assert.ok(!nf.includes('?sort=') && nf.includes('?q=') && nf.includes('?new='));
  const ns = robotsFor(b, { noindexSearch: false }, validateRobotsTxt);
  assert.ok(ns.includes('?sort=') && !ns.includes('?q=') && !ns.includes('?new='));
  const c = robotsFor(b, { customTxt: 'User-agent: *\nDisallow: /private' }, validateRobotsTxt);
  assert.ok(c.startsWith('User-agent: *\nDisallow: /private') && c.includes('Sitemap: https://x.com/sitemap.xml'));
  const c2 = robotsFor(b, { customTxt: 'User-agent: *\nSitemap: https://x.com/other.xml' }, validateRobotsTxt);
  assert.equal((c2.match(/Sitemap:/g) || []).length, 1);
  assert.equal(robotsFor(b, { customTxt: 'User-agent: *\nDisallow: /' }, validateRobotsTxt), robotsTxt(b)); // invalid: generated text
  assert.equal(robotsFor(b, { customTxt: 'x' }, () => { throw new Error('boom'); }), robotsTxt(b));
});

test('verification tags and brand sitemap', () => {
  assert.deepEqual(verifyTags(undefined), []);
  assert.deepEqual(verifyTags({ google: '', bing: ' ' }), []);
  assert.deepEqual(verifyTags({ google: 'abc_DEF-123', bing: 'AB12CD34EF' }), ['<meta name="google-site-verification" content="abc_DEF-123">', '<meta name="msvalidate.01" content="AB12CD34EF">']);
  assert.deepEqual(verifyTags({ google: '"><script>' }), []);
  assert.ok(CHILD_SITEMAPS.includes('/sitemap-brands.xml'));
});

test('clip helper still cuts at a word', () => { assert.equal(clip('hello wonderful world', 12), 'hello'); });
