import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TEMPLATES, TEMPLATE_VARS, renderTemplate, sampleVars, varsFor } from '../src/seoTemplate.js';
import { productDescription, productTitle } from '../src/seoHelpers.js';

const settings = { general: { siteName: 'AR Trade International', siteNameFull: 'AR Trade International', siteNameShort: 'AR Trade', separator: '|' } };
const LONG = 'Canon imageRUNNER ADVANCE DX C5840i Colour Multifunction Photocopier Machine';
const samples = [
  { name: 'HP 12A Toner', price: 4500 }, { name: 'Brother TN-150BK Black Toner Cartridge', price: 6200 },
  { name: 'HP 230A Black Toner', price: 16200 }, { name: 'HP 12A Toner', price: 0 }, { name: 'HP 12A Toner', price: null },
  { name: LONG, price: 450000 }, { name: LONG, price: 0 }, { name: 'Epson L3250 A4 Wi-Fi All-in-One Ink Tank Printer', price: 28500 },
  { name: 'Ricoh MP 2014AD (Copier) & Stand "Pro" 100%', price: 99000 }, { name: 'Canon  PIXMA\n G2010', price: 21000 },
  { name: 'Xerox 106R01634 Cyan', price: 0 }, { name: 'A4 Paper 80gsm', price: 550 }, { name: 'Kyocera TK-1114 Toner Kit', price: 3999.6 },
  { name: 'X'.repeat(90) + ' Toner', price: 100 }
];

test('default product title equals productTitle() whenever the full title fits', () => {
  let n = 0;
  for (const x of samples) {
    const priced = Number(x.price) > 0;
    const v = varsFor('product', x, settings);
    const got = renderTemplate(DEFAULT_TEMPLATES.product.title, v, { max: 60 });
    const want = productTitle(x.name, priced);
    const fullFits = (priced ? `${v.product_name} – Price in BD | AR Trade` : `${v.product_name} | AR Trade, Dhaka`).length <= 60;
    assert.ok(got.length <= 60, got);
    if (fullFits) { assert.equal(got, want, x.name); n++; }
  }
  assert.ok(n >= 8);
});

test('documented title differences when the full title does not fit', () => {
  const v = varsFor('product', { name: 'Brother TN-150BK Black Toner Cartridge', price: 6200 }, settings);
  assert.equal(renderTemplate(DEFAULT_TEMPLATES.product.title, v, { max: 60 }), 'Brother TN-150BK Black Toner Cartridge – Price in BD');
  // today: "Name | AR Trade" when "Name – Price in BD" does not fit; template: "Name"
  const name = 'Kyocera TASKalfa 2554ci Colour Copier Machine!!!';
  const w = varsFor('product', { name, price: 1 }, settings);
  assert.equal(productTitle(name, true), `${name} | AR Trade`);
  assert.equal(renderTemplate(DEFAULT_TEMPLATES.product.title, w, { max: 60 }), name);
  // very long names are clipped at a word boundary exactly like today
  const lv = varsFor('product', { name: LONG + ' Pro', price: 1 }, settings);
  assert.equal(renderTemplate(DEFAULT_TEMPLATES.product.title, lv, { max: 60 }), productTitle(LONG + ' Pro', true));
});

test('default product description equals productDescription() whenever today full text fits', () => {
  let n = 0;
  for (const x of samples) {
    const v = varsFor('product', x, settings);
    const got = renderTemplate(DEFAULT_TEMPLATES.product.description, v, { max: 155 });
    const want = productDescription({ name: x.name, price: x.price });
    assert.ok(got.length <= 155, got);
    const priced = Number(x.price) > 0;
    const full = priced ? `Buy ${v.product_name} at ৳${v.price} in Bangladesh. Genuine product, fast delivery in Dhaka and cash on delivery.` : `${v.product_name} from AR Trade International, Dhaka. Genuine product with fast delivery in Dhaka. Call or message us for the latest price.`;
    if (full.length <= 155) { assert.equal(got, want, x.name); n++; }
  }
  assert.ok(n >= 8);
});

test('documented description difference: too long drops COD wording instead of shortening the name', () => {
  const name = 'Canon imageRUNNER ADVANCE DX C5840i Colour Multifunction Photocopier';
  const got = renderTemplate(DEFAULT_TEMPLATES.product.description, varsFor('product', { name, price: 450000 }, settings), { max: 155 });
  assert.ok(got.endsWith('fast delivery in Dhaka.') && got.length <= 155 && !/cash on delivery/.test(got), got);
});

test('grammar: variables, optional groups, if/else, escapes', () => {
  const v = { a: 'A', b: '', c: 'C' };
  assert.equal(renderTemplate('{a}-{c}', v), 'A-C');
  assert.equal(renderTemplate('{a}[ x {b}] y', v), 'A y');
  assert.equal(renderTemplate('{a}[ x {c}] y', v), 'A x C y');
  assert.equal(renderTemplate('{if b}yes{else}no{/if}', v), 'no');
  assert.equal(renderTemplate('{if a}yes{/if}', v), 'yes');
  assert.equal(renderTemplate('{if b}yes{/if}!', v), '!');
  assert.equal(renderTemplate('\\[{a}\\] \\{c\\}', v), '[A] {c}');
  assert.equal(renderTemplate('{a}[ one[ two {b}] three]', v), 'A one three');
  assert.equal(renderTemplate('{nope} {a}', v), 'A');
  assert.equal(renderTemplate(null, v), '');
  assert.equal(renderTemplate('{a', v), '{a');
});

test('plain text: tags and control characters removed, whitespace collapsed', () => {
  assert.equal(renderTemplate('{a}', { a: '<b>Hi</b>\u0000  there\n\tyou' }), 'Hi there you');
});

test('max: drops groups from the right, clips at a word, no dangling separator', () => {
  const v = { n: 'Alpha Beta', s: 'AR Trade', sep: '|' };
  const T = '{n}[ – Price in BD][ {sep} {s}]';
  assert.equal(renderTemplate(T, v, { max: 100 }), 'Alpha Beta – Price in BD | AR Trade');
  assert.equal(renderTemplate(T, v, { max: 25 }), 'Alpha Beta – Price in BD');
  assert.equal(renderTemplate(T, v, { max: 12 }), 'Alpha Beta');
  assert.equal(renderTemplate(T, v, { max: 7 }), 'Alpha');
  assert.equal(renderTemplate('{n} {sep} {s2}', { ...v, s2: '' }), 'Alpha Beta');
  assert.equal(renderTemplate('{sep} {n}', v), 'Alpha Beta');
});

test('varsFor: product', () => {
  const v = varsFor('product', { name: ' HP  230A ', brand: 'HP', part: 'CF230A', sku: 'S1', price: 16200, old_price: 18000, stock: 3, cat: 'Toner', short_desc: '<p>Good</p>' }, settings, new Date(2026, 10, 5));
  assert.equal(v.product_name, 'HP 230A'); assert.equal(v.price, '16,200'); assert.equal(v.sale_price, '16,200');
  assert.equal(v.stock_status, 'In stock'); assert.equal(v.mpn, 'CF230A'); assert.equal(v.category, 'Toner');
  assert.equal(v.short_description, 'Good'); assert.equal(v.year, '2026'); assert.equal(v.month, 'November'); assert.equal(v.currency, 'BDT');
  assert.equal(v.site_name_short, 'AR Trade');
  assert.equal(varsFor('product', { name: 'x', price: 100, old_price: 100 }, settings).sale_price, '');
  assert.equal(varsFor('product', { name: 'x', price: 0 }, settings).price, '');
  assert.equal(varsFor('product', { name: 'x', stock: 0 }, settings).stock_status, 'Out of stock');
  assert.equal(varsFor('product', { name: 'x' }, settings).stock_status, '');
  assert.equal(varsFor('product', { name: 'x', availability: 'preorder' }, settings).stock_status, 'Pre-order');
  assert.equal(varsFor('product', { name: 'x', stock_status: 'back-order' }, settings).stock_status, 'Back-order');
});

test('varsFor: other kinds and defaults without settings', () => {
  assert.equal(varsFor('category', { title: 'Toner', description: '<p>Desc</p>' }, settings).description, 'Desc');
  assert.equal(varsFor('brand', { name: 'HP' }, settings).brand, 'HP');
  assert.equal(varsFor('blog', { title: 'T', excerpt: 'E' }, settings).short_description, 'E');
  assert.equal(varsFor('page', { title: 'P' }, undefined).site_name_full, 'AR Trade International');
  assert.equal(varsFor('home', null, undefined).sep, '|');
});

test('default templates for category, brand, blog, page, home', () => {
  const t = DEFAULT_TEMPLATES;
  const cat = varsFor('category', { title: 'Toner Cartridges', description: 'Original toner.' }, settings);
  assert.equal(renderTemplate(t.category.title, cat, { max: 60 }), 'Toner Cartridges Price in Bangladesh | AR Trade');
  assert.equal(renderTemplate(t.category.description, cat, { max: 155 }), 'Buy genuine toner cartridges online in Bangladesh. Original toner. Best prices and fast delivery in Dhaka.');
  assert.equal(renderTemplate(t.category.description, varsFor('category', { title: 'Ink' }, settings), { max: 155 }), 'Buy genuine ink online in Bangladesh. Best prices and fast delivery in Dhaka.');
  const b = varsFor('brand', { name: 'HP' }, settings);
  assert.equal(renderTemplate(t.brand.title, b, { max: 60 }), 'HP Price in Bangladesh | AR Trade International');
  assert.equal(renderTemplate(t.brand.description, b), 'Buy genuine HP printers, toner and accessories in Bangladesh from AR Trade International, Dhaka.');
  assert.equal(renderTemplate(t.blog.title, varsFor('blog', { title: 'Tips' }, settings)), 'Tips | AR Trade International');
  assert.equal(renderTemplate(t.page.title, varsFor('page', { title: 'About' }, settings)), 'About | AR Trade International');
  assert.equal(renderTemplate(t.home.title, varsFor('home', null, settings)), 'AR Trade International | Printers, Toner & Copiers in Dhaka');
});

test('TEMPLATE_VARS and sampleVars', () => {
  for (const k of ['product_name', 'brand', 'category', 'price', 'sale_price', 'currency', 'sku', 'mpn', 'model', 'stock_status', 'site_name', 'site_name_short', 'site_name_full', 'sep', 'year', 'month', 'short_description', 'name'])
    assert.ok(TEMPLATE_VARS.some(v => v.key === k && v.label && v.example !== undefined), k);
  const s = sampleVars('product');
  assert.equal(renderTemplate(DEFAULT_TEMPLATES.product.title, s, { max: 60 }), 'HP 230A Black Toner Cartridge – Price in BD | AR Trade');
  assert.ok(renderTemplate(DEFAULT_TEMPLATES.brand.title, sampleVars('brand')).startsWith('HP '));
});

test('a part after the separator that does not fit is dropped whole, never cut in half', () => {
  const vars = { product_name: 'HP 230A Black Toner Cartridge', site_name: 'AR Trade International', sep: '|' };
  const out = renderTemplate('{product_name} Price in Bangladesh {sep} {site_name}', vars, { max: 60 });
  assert.equal(out, 'HP 230A Black Toner Cartridge Price in Bangladesh');
  assert.ok(out.length <= 60);
  // when everything fits nothing is dropped
  assert.equal(renderTemplate('{product_name} {sep} {site_name}', { product_name: 'HP 79A', site_name: 'AR Trade International', sep: '|' }, { max: 60 }), 'HP 79A | AR Trade International');
});
