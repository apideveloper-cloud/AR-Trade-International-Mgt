import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, validateManual, cleanImageAlts, autofillAlts, normaliseSlug, urlFor, manualFrom, splitWrites, buildBrandRows, isHttpsUrl } from '../src/admin/seoItemMap.js';

test('cleanText strips tags and control characters and never trusts types', () => {
  assert.equal(cleanText('<b>Hi</b>\u0000 there\n now'), 'Hi there now');
  assert.equal(cleanText({}), '');
  assert.equal(cleanText(null), '');
  assert.equal(cleanText(5), '5');
});
test('validateManual accepts a clean subset and returns only sent keys', () => {
  const { values, errors } = validateManual({ metaTitle: ' <i>T</i> ', robotsIndex: 'false', secondaryKeywords: ['a', 'a', ' b '], faq: [{ q: 'Q?', a: 'A' }, { q: '', a: '' }], canonicalUrl: '', ogImage: '/x.png' });
  assert.deepEqual(errors, []);
  assert.deepEqual(values, { metaTitle: 'T', robotsIndex: false, secondaryKeywords: ['a', 'b'], faq: [{ q: 'Q?', a: 'A' }], canonicalUrl: '', ogImage: '/x.png' });
  assert.deepEqual(validateManual(null), { values: {}, errors: [] });
});
test('validateManual rejects out-of-range input', () => {
  const bad = m => validateManual(m).errors.length > 0;
  assert.ok(bad({ metaTitle: 'x'.repeat(161) }));
  assert.ok(bad({ metaDescription: 'x'.repeat(321) }));
  assert.ok(bad({ metaKeywords: 'x'.repeat(501) }));
  assert.ok(bad({ focusKeyword: 'x'.repeat(121) }));
  assert.ok(bad({ secondaryKeywords: Array.from({ length: 13 }, (_, i) => 'k' + i) }));
  assert.ok(bad({ secondaryKeywords: ['x'.repeat(61)] }));
  assert.ok(bad({ secondaryKeywords: 'a' }));
  assert.ok(bad({ canonicalUrl: 'http://a.com' }));
  assert.ok(bad({ canonicalUrl: 'https://a.com/a b' }));
  assert.ok(bad({ ogImage: '//evil.com/x.png' }));
  assert.ok(bad({ ogImage: 'ftp://x' }));
  assert.ok(bad({ robotsFollow: 'maybe' }));
  assert.ok(bad({ faq: [{ q: 'only q', a: '' }] }));
  assert.ok(bad({ faq: [{ q: 'q'.repeat(201), a: 'a' }] }));
  assert.ok(bad({ faq: [{ q: 'q', a: 'a'.repeat(2001) }] }));
  assert.ok(bad({ faq: Array.from({ length: 21 }, (_, i) => ({ q: 'q' + i, a: 'a' })) }));
  assert.ok(!bad({ canonicalUrl: 'https://artrade.com.bd/product/x', ogImage: 'https://a.com/i.png' }));
  assert.equal(isHttpsUrl('https://a.com'), true);
});
test('cleanImageAlts ignores bad entries and limits alt length', () => {
  assert.deepEqual(cleanImageAlts([{ src: '/a.jpg', alt: '<b>x</b>' }, { alt: 'no src' }, null, { src: 5 }]), [{ src: '/a.jpg', alt: 'x' }]);
  assert.deepEqual(cleanImageAlts('nope'), []);
  assert.throws(() => cleanImageAlts([{ src: '/a', alt: 'x'.repeat(256) }]));
});
test('autofillAlts fills only empty alts', () => {
  const out = autofillAlts([{ src: 'a', alt: '' }, { src: 'b', alt: 'keep' }, { src: 'c', alt: ' ' }], 'HP 230A', 'HP');
  assert.deepEqual(out.map(i => i.alt), ['HP 230A - HP', 'keep', 'HP 230A - view 3']);
  assert.equal(autofillAlts([{ src: 'a', alt: '' }], 'Name', '')[0].alt, 'Name');
  assert.equal(autofillAlts([{ src: 'a', alt: '' }], 'x'.repeat(300), '')[0].alt.length, 255);
});
test('normaliseSlug', () => {
  assert.deepEqual(normaliseSlug(' HP 230A Toner! '), { slug: 'hp-230a-toner' });
  assert.ok(normaliseSlug('ab').error);
  assert.ok(normaliseSlug('x'.repeat(121)).error);
});
test('urlFor builds the public address', () => {
  assert.equal(urlFor('product', { id: 1, slug: 'a-b' }), '/product/a-b');
  assert.equal(urlFor('category', { id: 'toner' }), '/shop/toner');
  assert.equal(urlFor('brand', { slug: 'hp' }), '/brand/hp');
  assert.equal(urlFor('blog', { slug: 'p' }), '/blog/p');
  assert.equal(urlFor('page', { slug: 'x', grp: 'servicing' }), '/services/x');
});
test('manualFrom exposes generated product meta as empty and reads the right columns per type', () => {
  const auto = { isAutoTitle: t => /\| AR Trade$/.test(t), isAutoDesc: d => /Genuine, fast delivery\.$/.test(d) };
  const p = manualFrom('product', { meta_title: 'X | AR Trade', meta_desc: 'Hand written', meta_keywords: 'k', noindex: 1 }, { focus_keyword: 'toner', secondary_keywords: '["a"]', faq: '[{"q":"q","a":"a"}]' }, auto);
  assert.equal(p.metaTitle, ''); assert.equal(p.metaDescription, 'Hand written'); assert.equal(p.metaKeywords, 'k');
  assert.equal(p.robotsIndex, false); assert.deepEqual(p.secondaryKeywords, ['a']); assert.deepEqual(p.faq, [{ q: 'q', a: 'a' }]);
  const c = manualFrom('category', { id: 'x' }, { meta_title: 'T', meta_description: 'D', robots_index: 0 });
  assert.equal(c.metaTitle, 'T'); assert.equal(c.robotsIndex, false); assert.ok(!('metaKeywords' in c));
  assert.equal(manualFrom('brand', {}, {}).robotsIndex, true);
  assert.equal(manualFrom('blog', { noindex: 0, meta_title: 'B' }, {}).metaTitle, 'B');
});
test('splitWrites routes fields to the item table or seo_meta', () => {
  const v = { metaTitle: 'T', metaDescription: 'D', metaKeywords: 'k', robotsIndex: false, focusKeyword: 'f', faq: [{ q: 'q', a: 'a' }], secondaryKeywords: ['s'], ogTitle: 'o' };
  const p = splitWrites('product', v);
  assert.deepEqual(p.own, { meta_title: 'T', meta_desc: 'D', meta_keywords: 'k', noindex: 1 });
  assert.equal(p.seo.focus_keyword, 'f'); assert.equal(p.seo.robots_index, 0); assert.equal(p.seo.faq, '[{"q":"q","a":"a"}]'); assert.equal(p.seo.secondary_keywords, '["s"]'); assert.equal(p.seo.og_title, 'o');
  const b = splitWrites('brand', v);
  assert.deepEqual(b.own, {}); assert.equal(b.seo.meta_title, 'T'); assert.equal(b.seo.meta_description, 'D'); assert.ok(!('meta_keywords' in b.seo));
  assert.deepEqual(splitWrites('page', {}), { own: {}, seo: {} });
});
test('buildBrandRows groups by brand slug, applies the 3-product rule and sorts', () => {
  const rows = buildBrandRows(
    [{ slug: 'hp', name: 'HP', hidden: 0 }, { slug: 'd-link', name: 'D-Link', hidden: 0 }, { slug: 'zebra', name: 'Zebra', hidden: 1 }, { slug: 'acer', name: 'Acer', hidden: 0 }],
    [{ brand: 'HP', n: 2 }, { brand: ' hp', n: 3 }, { brand: 'D-Link', n: 3 }, { brand: 'Zebra', n: 9 }, { brand: '!!', n: 4 }],
    [{ entity_id: 'hp', focus_keyword: 'hp toner', seo_score: 72 }, { entity_id: 'acer', focus_keyword: '', faq: '[]', seo_score: null }, { entity_id: 'zebra', robots_index: 0 }]);
  assert.deepEqual(rows.map(r => r.slug), ['zebra', 'hp', 'd-link', 'acer']);
  const by = Object.fromEntries(rows.map(r => [r.slug, r]));
  assert.equal(by.hp.products, 5); assert.equal(by.hp.indexable, true); assert.equal(by.hp.hasSeo, true); assert.equal(by.hp.score, 72);
  assert.equal(by.zebra.hidden, true); assert.equal(by.zebra.indexable, false); assert.equal(by.zebra.hasSeo, true);
  assert.equal(by['d-link'].indexable, true); assert.equal(by['d-link'].hasSeo, false); assert.equal(by['d-link'].score, null);
  assert.equal(by.acer.products, 0); assert.equal(by.acer.indexable, false); assert.equal(by.acer.hasSeo, false);
});

test('a product title saved from the SEO tab is kept even when it ends with the brand suffix', async () => {
  const { manualFrom, splitWrites } = await import('../src/admin/seoItemMap.js');
  const { isAutoTitle, isAutoDesc } = await import('../src/seoHelpers.js');
  const w = splitWrites('product', { metaTitle: 'Epson V39 Scanner Price in Bangladesh | AR Trade', metaDescription: 'A hand-written description. Genuine, fast delivery.' });
  assert.equal(w.seo.meta_title, 'Epson V39 Scanner Price in Bangladesh | AR Trade');
  assert.equal(w.own.meta_title, 'Epson V39 Scanner Price in Bangladesh | AR Trade');
  assert.equal(w.seo.meta_description, 'A hand-written description. Genuine, fast delivery.');
  // read back: the seo_meta value wins over the column heuristics
  const back = manualFrom('product', { meta_title: 'Epson V39 Scanner Price in Bangladesh | AR Trade' }, { meta_title: 'Epson V39 Scanner Price in Bangladesh | AR Trade' }, { isAutoTitle, isAutoDesc });
  assert.equal(back.metaTitle, 'Epson V39 Scanner Price in Bangladesh | AR Trade');
  // an importer-generated column value without a seo_meta row still reads as not manual
  assert.equal(manualFrom('product', { meta_title: 'HP 79A | AR Trade' }, {}, { isAutoTitle, isAutoDesc }).metaTitle, '');
  // clearing writes empty values to both places
  const c = splitWrites('product', { metaTitle: '', metaDescription: '' });
  assert.deepEqual([c.own.meta_title, c.seo.meta_title, c.own.meta_desc, c.seo.meta_description], ['', '', '', '']);
});
