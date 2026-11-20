import test from 'node:test';
import assert from 'node:assert/strict';
import { CODES, CODE_LIST, validateLd, numberLike, normalizeLd } from '../src/growth/schemaRules.js';

const codes = a => a.map(x => x.code).sort();
const OFFER = { '@type': 'Offer', price: '1500', priceCurrency: 'BDT', availability: 'https://schema.org/InStock' };
const PRODUCT = { '@context': 'https://schema.org', '@type': 'Product', name: 'Toner', image: ['https://x/a.jpg'], sku: 'T1', brand: { '@type': 'Brand', name: 'HP' }, offers: OFFER };

test('every code has label, hint and severity', () => {
  assert.ok(CODE_LIST.length >= 25);
  for (const [k, c] of Object.entries(CODES)) { assert.ok(c.label.length > 10, k); assert.ok(c.hint.length > 5, k); assert.ok(['error', 'warning'].includes(c.severity), k); }
});
test('every emitted finding has a CODES entry with the same severity', () => {
  const bad = [{ '@type': 'Product', offers: {} }, { '@type': 'Organization' }, { '@type': 'BreadcrumbList', itemListElement: [] }, { '@type': 'FAQPage', mainEntity: [] }, { '@type': 'BlogPosting' }, { '@type': 'WebSite' }, { '@type': 'ItemList' }, 'x{'];
  const out = validateLd(bad, 'product');
  assert.ok(out.length > 10);
  for (const f of out) { assert.equal(CODES[f.code]?.severity, f.severity, f.code); assert.ok(f.type && f.detail); }
});
test('a good product has no findings', () => assert.deepEqual(validateLd([PRODUCT], 'product'), []));
test('product: name, image, offers are errors', () => {
  assert.deepEqual(codes(validateLd([{ ...PRODUCT, name: ' ' }], 'product')), ['product_name_missing']);
  assert.deepEqual(codes(validateLd([{ ...PRODUCT, image: [] }], 'product')), ['product_image_missing']);
  assert.deepEqual(codes(validateLd([{ ...PRODUCT, image: undefined }], 'product')), ['product_image_missing']);
  const r = validateLd([{ ...PRODUCT, offers: undefined }], 'product');
  assert.deepEqual(codes(r), ['product_offers_missing']); assert.equal(r[0].severity, 'error');
});
test('offer: price, currency, availability', () => {
  const run = o => codes(validateLd([{ ...PRODUCT, offers: { ...OFFER, ...o } }], 'product'));
  assert.deepEqual(run({ price: undefined }), ['offer_price_invalid']);
  assert.deepEqual(run({ price: 'abc' }), ['offer_price_invalid']);
  assert.deepEqual(run({ price: '12.50' }), []);
  assert.deepEqual(run({ price: 0 }), []);
  assert.deepEqual(run({ price: '-5' }), ['offer_price_invalid']);
  assert.deepEqual(run({ priceCurrency: 'TAKA' }), ['offer_currency_invalid']);
  assert.deepEqual(run({ priceCurrency: 'bd' }), ['offer_currency_invalid']);
  assert.deepEqual(run({ availability: 'InStock' }), ['offer_availability_invalid']);
  assert.deepEqual(run({ availability: 'http://schema.org/PreOrder' }), []);
  assert.deepEqual(run({ price: undefined, priceCurrency: '', availability: '' }), ['offer_availability_invalid', 'offer_currency_invalid', 'offer_price_invalid']);
});
test('AggregateOffer accepts lowPrice and needs no availability; offers array is checked per offer', () => {
  assert.deepEqual(validateLd([{ ...PRODUCT, offers: { '@type': 'AggregateOffer', lowPrice: '10', priceCurrency: 'BDT' } }], 'product'), []);
  const r = validateLd([{ ...PRODUCT, offers: [OFFER, { ...OFFER, price: 'x' }] }], 'product');
  assert.deepEqual(codes(r), ['offer_price_invalid']); assert.match(r[0].detail, /offer 2/);
});
test('warnings: brand, identifiers, sale end date', () => {
  assert.deepEqual(codes(validateLd([{ ...PRODUCT, brand: undefined }], 'product')), ['product_brand_missing']);
  assert.deepEqual(codes(validateLd([{ ...PRODUCT, sku: undefined }], 'product')), ['product_identifier_missing']);
  assert.deepEqual(validateLd([{ ...PRODUCT, sku: undefined, mpn: 'CF230A' }], 'product'), []);
  assert.deepEqual(validateLd([{ ...PRODUCT, sku: undefined, gtin13: '1234567890123' }], 'product'), []);
  const sale = { ...OFFER, priceSpecification: [{ '@type': 'UnitPriceSpecification', priceType: 'https://schema.org/StrikethroughPrice', price: '2000' }] };
  assert.deepEqual(codes(validateLd([{ ...PRODUCT, offers: sale }], 'product')), ['offer_valid_until_missing']);
  assert.deepEqual(validateLd([{ ...PRODUCT, offers: { ...sale, priceValidUntil: '2026-12-31' } }], 'product'), []);
  // the plain VAT price specification is not a sale
  assert.deepEqual(validateLd([{ ...PRODUCT, offers: { ...OFFER, priceSpecification: { '@type': 'UnitPriceSpecification', price: '1500' } } }], 'product'), []);
});
test('aggregateRating and review warnings', () => {
  const run = x => validateLd([{ ...PRODUCT, ...x }], 'product');
  assert.deepEqual(run({ aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.5', reviewCount: 3 } }), []);
  assert.deepEqual(run({ aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.5', ratingCount: 3 } }), []);
  assert.deepEqual(codes(run({ aggregateRating: { ratingValue: '4.5' } })), ['rating_incomplete']);
  assert.deepEqual(codes(run({ aggregateRating: { reviewCount: 3 } })), ['rating_incomplete']);
  const rv = { '@type': 'Review', author: { name: 'Ali' }, reviewRating: { ratingValue: 5 } };
  assert.deepEqual(run({ review: [rv, { ...rv, author: undefined }, { ...rv, reviewRating: {} }] }).map(x => x.code), ['review_incomplete', 'review_incomplete']);
  assert.deepEqual(run({ review: { ...rv, author: 'Ali' } }), []);
});
test('duplicate Product and no_ld apply to product pages only', () => {
  assert.deepEqual(codes(validateLd([PRODUCT, PRODUCT], 'product')), ['duplicate_type']);
  assert.deepEqual(codes(validateLd([], 'product')), ['no_ld']);
  assert.deepEqual(validateLd(undefined, 'product').map(x => x.code), ['no_ld']);
  assert.deepEqual(validateLd([], 'shop'), []);
  assert.deepEqual(validateLd([PRODUCT, PRODUCT], 'shop'), []);
});
test('invalid JSON strings: ld_invalid, valid strings are parsed', () => {
  const r = validateLd(['{"@type": "Product",', JSON.stringify(PRODUCT)], 'product');
  assert.deepEqual(codes(r), ['ld_invalid']); assert.equal(r[0].severity, 'error');
  assert.deepEqual(codes(validateLd(['123'], 'shop')), ['ld_invalid']);
  assert.deepEqual(codes(validateLd([''], 'shop')), ['ld_invalid']);
  assert.deepEqual(validateLd(JSON.stringify([PRODUCT]), 'product'), []);
  assert.deepEqual(codes(validateLd([null, 5], 'shop')), ['ld_invalid']);
  assert.equal(normalizeLd([{ '@graph': [PRODUCT, { '@type': 'WebSite', potentialAction: {} }] }]).objects.length, 2);
});
test('Organization / LocalBusiness / Store', () => {
  const org = { '@type': ['Store', 'ElectronicsStore'], '@id': 'https://x/#store', name: 'AR', url: 'https://x', logo: 'https://x/l.png', sameAs: ['https://fb.com/ar'], telephone: '+880' };
  assert.deepEqual(validateLd([org], 'home'), []);
  assert.deepEqual(codes(validateLd([{ ...org, name: '' }], 'home')), ['org_name_missing']);
  assert.deepEqual(validateLd([{ ...org, url: undefined }], 'home'), []); // @id is enough
  assert.deepEqual(codes(validateLd([{ ...org, url: undefined, '@id': undefined }], 'home')), ['org_url_missing']);
  assert.deepEqual(codes(validateLd([{ ...org, logo: undefined, sameAs: [] }], 'home')), ['org_logo_missing', 'org_sameas_missing']);
  assert.deepEqual(codes(validateLd([{ ...org, telephone: undefined }], 'home')), ['org_contact_missing']);
  assert.deepEqual(validateLd([{ ...org, telephone: undefined, contactPoint: [{ telephone: '1' }] }], 'home'), []);
  assert.deepEqual(codes(validateLd([{ '@type': 'LocalBusiness', name: 'x', url: 'u', logo: 'l', sameAs: 'a', address: 'Dhaka' }], 'home')), []);
});
test('BreadcrumbList', () => {
  const bc = items => validateLd([{ '@type': 'BreadcrumbList', itemListElement: items }], 'product');
  const it = (position, name, item) => ({ '@type': 'ListItem', position, name, item });
  assert.deepEqual(bc([it(1, 'Home', 'https://x/'), it(2, 'Shop', 'https://x/shop')]), []);
  assert.deepEqual(bc([it(1, 'Home', 'https://x/'), it(2, 'Last')]), []); // the last item may omit item
  assert.deepEqual(codes(bc([])), ['breadcrumb_empty']);
  assert.deepEqual(codes(validateLd([{ '@type': 'BreadcrumbList' }], 'shop')), ['breadcrumb_empty']);
  assert.deepEqual(codes(bc([it(1, 'Home'), it(2, 'Last')])), ['breadcrumb_item_incomplete']); // a middle item needs item
  assert.deepEqual(codes(bc([it(undefined, 'Home', 'u')])), ['breadcrumb_item_incomplete']);
  assert.deepEqual(codes(bc([it(1, '', 'u')])), ['breadcrumb_item_incomplete']);
  assert.deepEqual(bc([it(1, undefined, { '@id': 'u', name: 'Home' })]), []);
});
test('FAQPage', () => {
  const q = (name, text) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } });
  const faq = m => validateLd([{ '@type': 'FAQPage', mainEntity: m }], 'info');
  assert.deepEqual(faq([q('Why?', 'Because')]), []);
  assert.deepEqual(codes(faq([])), ['faq_empty']);
  assert.deepEqual(codes(faq([q('', 'a')])), ['faq_question_incomplete']);
  assert.deepEqual(codes(faq([q('Q', ' ')])), ['faq_question_incomplete']);
  assert.deepEqual(codes(faq([{ '@type': 'Question', name: 'Q' }])), ['faq_question_incomplete']);
  assert.deepEqual(faq(q('Q', 'A')), []); // a single object
});
test('Article / BlogPosting', () => {
  const post = { '@type': 'BlogPosting', headline: 'H', image: 'https://x/i.jpg', datePublished: '2026-01-01', dateModified: '2026-01-02', author: { name: 'A' }, publisher: { name: 'P' } };
  assert.deepEqual(validateLd([post], 'post'), []);
  assert.deepEqual(codes(validateLd([{ ...post, headline: '', image: '', datePublished: '' }], 'post')), ['article_date_missing', 'article_headline_missing', 'article_image_missing']);
  assert.deepEqual(codes(validateLd([{ ...post, author: undefined, dateModified: undefined, publisher: undefined }], 'post')), ['article_author_missing', 'article_modified_missing', 'article_publisher_missing']);
  assert.deepEqual(validateLd([{ ...post, '@type': 'Article', author: 'Ali' }], 'post'), []);
});
test('WebSite search box and ItemList', () => {
  assert.deepEqual(codes(validateLd([{ '@type': 'WebSite', name: 'x', url: 'u' }], 'home')), ['website_search_missing']);
  assert.deepEqual(validateLd([{ '@type': 'WebSite', potentialAction: { '@type': 'SearchAction' } }], 'home'), []);
  assert.deepEqual(validateLd([], 'home'), []); // no WebSite at all: nothing to say
  assert.deepEqual(codes(validateLd([{ '@type': 'ItemList', itemListElement: [] }], 'shop')), ['itemlist_empty']);
  assert.deepEqual(validateLd([{ '@type': 'ItemList', itemListElement: [{ position: 1 }] }], 'shop'), []);
  assert.deepEqual(codes(validateLd([{ '@type': 'CollectionPage', mainEntity: { '@type': 'ItemList', numberOfItems: 0, itemListElement: [] } }], 'category')), ['itemlist_empty']);
  assert.deepEqual(validateLd([{ '@type': 'CollectionPage', mainEntity: { '@type': 'ItemList', itemListElement: [{ position: 1 }] } }], 'category'), []);
});
test('numberLike boundaries', () => {
  for (const v of ['0', '10', '10.5', ' 7 ', 3, 0]) assert.ok(numberLike(v), String(v));
  for (const v of ['', 'x', '1,000', '-1', '1e3', NaN, Infinity, null, undefined, {}]) assert.ok(!numberLike(v), String(v));
});
