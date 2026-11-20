import test from 'node:test';
import assert from 'node:assert/strict';
import { feedItemToProductInput, itemHash, money, effectiveDate } from '../src/growth/merchantMap.js';
import { generateFeedToken, normalizeGoogleCategory, suggestCategoryMap, validateMerchantSettings } from '../src/growth/merchant.js';

const item = { pid: 5, id: 'HP-85A', title: 'HP 85A Toner', description: 'Black', link: 'https://x.test/p/5', image_link: 'https://x.test/a.jpg', additional_image_link: ['https://x.test/b.jpg'], availability: 'in stock', price: '16200.00 BDT', brand: 'HP', condition: 'new', identifier_exists: 'no', product_type: 'Toner', shipping: { country: 'BD', service: 'Standard', price: '100.50 BDT' } };

test('money converts to micros exactly', () => {
  assert.deepEqual(money('16200.00 BDT'), { amountMicros: '16200000000', currencyCode: 'BDT' });
  assert.equal(money('0.5 BDT').amountMicros, '500000');
  assert.equal(money('1999 bdt').amountMicros, '1999000000');
  assert.equal(money('abc'), null); assert.equal(money(''), null);
});
test('effective date splits ISO/ISO', () => {
  assert.deepEqual(effectiveDate('2026-01-01T00:00+0600/2026-02-01T00:00+0600'), { startTime: '2026-01-01T00:00+0600', endTime: '2026-02-01T00:00+0600' });
  assert.equal(effectiveDate('x'), null);
});
test('product input maps fields, availability and condition', () => {
  const b = feedItemToProductInput(item, { contentLanguage: 'en', feedLabel: 'BD' });
  assert.equal(b.offerId, 'HP-85A'); assert.equal(b.contentLanguage, 'en'); assert.equal(b.feedLabel, 'BD');
  const a = b.attributes;
  assert.equal(a.imageLink, 'https://x.test/a.jpg'); assert.deepEqual(a.additionalImageLinks, ['https://x.test/b.jpg']);
  assert.equal(a.availability, 'IN_STOCK'); assert.equal(a.condition, 'NEW'); assert.equal(a.identifierExists, false);
  assert.deepEqual(a.productTypes, ['Toner']); assert.equal(a.shipping[0].price.amountMicros, '100500000');
  for (const [t, v] of [['out of stock', 'OUT_OF_STOCK'], ['preorder', 'PREORDER'], ['backorder', 'BACKORDER']]) assert.equal(feedItemToProductInput({ ...item, availability: t }).attributes.availability, v);
  for (const [t, v] of [['refurbished', 'REFURBISHED'], ['used', 'USED']]) assert.equal(feedItemToProductInput({ ...item, condition: t }).attributes.condition, v);
});
test('absent values are omitted', () => {
  const a = feedItemToProductInput({ id: '9', title: 'T', price: '10.00 BDT' }).attributes;
  assert.deepEqual(Object.keys(a).sort(), ['price', 'title']);
  assert.equal('salePrice' in a, false); assert.equal('identifierExists' in a, false);
});
test('sale price with effective date', () => {
  const a = feedItemToProductInput({ ...item, price: '20.00 BDT', sale_price: '15.00 BDT', sale_price_effective_date: '2026-01-01T00:00+0600/2026-02-01T00:00+0600' }).attributes;
  assert.equal(a.salePrice.amountMicros, '15000000'); assert.equal(a.salePriceEffectiveDate.endTime, '2026-02-01T00:00+0600');
});
test('hash is stable, key-order independent, ignores pid, and changes with content', () => {
  const h = itemHash(item);
  assert.match(h, /^[0-9a-f]{40}$/);
  assert.equal(itemHash({ ...item }), h);
  assert.equal(itemHash(Object.fromEntries(Object.entries(item).reverse())), h);
  assert.equal(itemHash({ ...item, pid: 99 }), h);
  assert.notEqual(itemHash({ ...item, price: '16300.00 BDT' }), h);
});

test('settings validation', () => {
  assert.equal(validateMerchantSettings({ minImagePx: 50 }).ok, false);
  assert.equal(validateMerchantSettings({ minImagePx: 5000 }).ok, false);
  assert.equal(validateMerchantSettings({ minImagePx: 100 }).ok, true);
  assert.match(validateMerchantSettings({ accountId: '12ab' }).error, /digits/);
  assert.equal(validateMerchantSettings({ accountId: '1'.repeat(21) }).ok, false);
  assert.equal(validateMerchantSettings({ dataSourceId: '123' }).value.dataSourceId, '123');
  assert.equal(validateMerchantSettings({ categoryMap: { a: 'x'.repeat(251) } }).ok, false);
  assert.deepEqual(validateMerchantSettings({ categoryMap: { a: '306', b: '', c: 'Electronics>Print' } }).value.categoryMap, { a: '306', c: 'Electronics > Print' });
  assert.equal(validateMerchantSettings({ contentLanguage: 'EN-us!' }).ok, false);
  assert.equal(validateMerchantSettings({ contentLanguage: 'BN' }).value.contentLanguage, 'bn');
  assert.equal(validateMerchantSettings({ feedLabel: 'a b' }).ok, false);
  assert.deepEqual(validateMerchantSettings({ syncEnabled: 'true', excludedCategories: ['a', 'a', 'b'] }).value, { syncEnabled: true, excludedCategories: ['a', 'b'] });
  assert.equal(normalizeGoogleCategory('a > > b'), null);
});
test('feed token is 48 hex chars and random', () => {
  const a = generateFeedToken(), b = generateFeedToken();
  assert.match(a, /^[0-9a-f]{48}$/); assert.notEqual(a, b);
});
test('category suggestions never invent a path', () => {
  const r = suggestCategoryMap([{ id: 'toner', title: 'Toner Cartridges' }, { id: 'pr', title: 'Laser Printers' }, { id: 'x', title: 'Cables' }]);
  assert.match(r[0].suggestion, /Toner & Inkjet Cartridges$/); assert.match(r[1].suggestion, /Printers, Copiers & Fax Machines$/);
  assert.equal(r[2].suggestion, null); assert.equal(r[2].categoryId, 'x');
});
