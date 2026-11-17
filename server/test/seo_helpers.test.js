import test from 'node:test';
import assert from 'node:assert/strict';
import { PER_PAGE, breadcrumbLd, clip, collectionLd, isAutoDesc, isAutoTitle, listTitle, pageUrl, pageWindow, pagesOf, parsePage, productDescription, productTitle, taka } from '../src/seoHelpers.js';
import { listFallback, pageFallback, productFallback } from '../src/seoFallback.js';

test('product title: price wording, 60 characters, never a price claim without a price', () => {
  assert.equal(productTitle('Brother TN-150BK Black Toner Cartridge', true), 'Brother TN-150BK Black Toner Cartridge – Price in BD');
  assert.equal(productTitle('HP 12A Toner', true), 'HP 12A Toner – Price in BD | AR Trade');
  assert.equal(productTitle('HP 12A Toner', false), 'HP 12A Toner | AR Trade, Dhaka');
  const long = 'Canon imageRUNNER ADVANCE DX C5840i Colour Multifunction Photocopier Machine';
  for (const priced of [true, false]) assert.ok(productTitle(long, priced).length <= 60, 'too long');
  assert.ok(!/Price in BD/.test(productTitle('HP 12A Toner', false)));
});

test('product description: 155 characters, price only when there is one, cash on delivery only when offered', () => {
  const d = productDescription({ name: 'Brother TN-150BK Black Toner Cartridge', price: 5300, cod: true });
  assert.ok(d.length <= 155 && d.includes('৳5,300') && d.includes('cash on delivery'), d);
  assert.ok(!productDescription({ name: 'X', price: 5300, cod: false }).includes('cash on delivery'));
  const none = productDescription({ name: 'Sharp MX-312AT Black Original Copier Toner Cartridge', price: 0 });
  assert.ok(!none.includes('৳') && none.includes('Call or message') && none.length <= 155, none);
  const huge = productDescription({ name: 'A'.repeat(40) + ' ' + 'word '.repeat(60), price: 100 });
  assert.ok(huge.length <= 155);
});

test('generated import titles are replaced, hand-written ones are kept', () => {
  assert.equal(isAutoTitle('Avtech DGD-1304 DVR Price in Bangladesh | AR Trade'), true);
  assert.equal(isAutoTitle(''), true);
  assert.equal(isAutoTitle('Best Toner Offer This Week'), false);
  assert.equal(isAutoDesc('Avtech. Get a quote in Dhaka, Bangladesh. Genuine, fast delivery.'), true);
  assert.equal(isAutoDesc('A hand written description.'), false);
});

test('paging: addresses, page numbers and the window of links', () => {
  assert.equal(PER_PAGE, 24);
  assert.equal(pagesOf(0), 1); assert.equal(pagesOf(24), 1); assert.equal(pagesOf(25), 2); assert.equal(pagesOf(2058), 86);
  assert.deepEqual(parsePage(undefined), { page: 1, bad: false });
  assert.deepEqual(parsePage('3'), { page: 3, bad: false });
  assert.equal(parsePage('0').bad, true); assert.equal(parsePage('abc').bad, true); assert.equal(parsePage('-2').bad, true); assert.equal(parsePage('1.5').bad, true);
  assert.equal(pageUrl('/shop/toner', 1), '/shop/toner'); assert.equal(pageUrl('/shop/toner', 3), '/shop/toner?page=3');
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(10, 86), [1, '…', 8, 9, 10, 11, 12, '…', 86]);
  assert.deepEqual(pageWindow(2, 86), [1, 2, 3, 4, '…', 86]);
  assert.ok(listTitle(1, ['Toner & Cartridge Price in Bangladesh | AR Trade'], 'Toner & Cartridge').startsWith('Toner & Cartridge Price'));
  assert.equal(listTitle(2, ['x'], 'Toner & Cartridge'), 'Toner & Cartridge – Page 2 | AR Trade');
  assert.ok(listTitle(12, ['x'], 'A very long category name that goes on and on for a while').length <= 60);
});

test('structured data: breadcrumbs and an item list that continues across pages', () => {
  const b = breadcrumbLd([['Home', 'https://x/'], ['Shop', 'https://x/shop']]);
  assert.equal(b.itemListElement[1].position, 2);
  const c = collectionLd({ name: 'Toner', url: 'https://x/shop/toner?page=2', description: 'd', total: 60, offset: 24, items: [{ name: 'A', url: 'https://x/product/a' }] });
  assert.equal(c.mainEntity.numberOfItems, 60); assert.equal(c.mainEntity.itemListElement[0].position, 25);
  assert.equal(taka(5300), '৳5,300');
  assert.equal(clip('one two three', 8), 'one two');
});

test('the plain-HTML copy escapes everything from the database and carries real links', () => {
  const evil = { id: 1, name: '<script>alert(1)</script> "Toner"', slug: 'evil-toner', price: 100, stock: 1, brand: 'B&B', part: '', sku: '', tech: '', color: '', yield_info: '', compat: '' };
  const cats = [{ id: 'toner', title: 'Toner & Cartridge' }];
  const html = productFallback({ x: evil, cat: cats[0], price: 100, related: [{ ...evil, id: 2, slug: 'two' }], cats, site: { address: 'Dhaka <b>', phone: '+880' }, desc: '<img src=x onerror=1>' });
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x') && !html.includes('<b>'));
  assert.ok(html.includes('<h1>') && html.includes('href="/shop/toner"') && html.includes('href="/product/'));
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  const list = listFallback({ title: 'Toner', trail: [['Home', '/'], ['Toner']], rows: [evil], page: 2, pages: 5, path: '/shop/toner', cats, site: {} });
  assert.ok(list.includes('href="/shop/toner"') && list.includes('href="/shop/toner?page=3"') && list.includes('<strong>Page 2</strong>'));
  assert.ok(pageFallback({ title: 'T', cats, site: {} }).includes('data-seo-fallback'));
});
