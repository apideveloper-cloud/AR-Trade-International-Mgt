import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed, buildFeedTable, feedItem, feedContext, feedAccess } from '../src/merchantFeed.js';
import { ensureMerchantColumns } from '../src/growth/merchantSchema.js';

const P = { id: 7, sku: 'T-1', name: 'Toner', description: 'Good', price: 500, stock: 3, img: '/a.jpg', category_id: 'toner', img_w: 1200, img_h: 900 };
const cats = [{ id: 'toner', title: 'Toner' }];
const ctx = merchant => feedContext({ base: 'https://x.test', categories: cats, now: new Date('2026-01-01T00:00:00Z'), merchant });

test('google category: map, override beats map, omitted otherwise', () => {
  assert.equal(feedItem(P, ctx()).google_product_category, undefined);
  assert.equal(feedItem(P, ctx({ categoryMap: { toner: '1234' } })).google_product_category, '1234');
  assert.equal(feedItem({ ...P, google_category: 'A > B' }, ctx({ categoryMap: { toner: '1234' } })).google_product_category, 'A > B');
  assert.equal(feedItem(P, ctx({ categoryMap: { other: '1' } })).google_product_category, undefined);
});

test('item_group_id and non-output pid/warnings', () => {
  const it = feedItem({ ...P, item_group_id: 'G'.repeat(60) }, ctx());
  assert.equal(it.item_group_id.length, 50);
  assert.equal(feedItem(P, ctx()).item_group_id, undefined);
  assert.equal(it.pid, 7);
  assert.ok(!Object.keys(it).includes('pid') && !Object.keys(it).includes('warnings'));
});

test('exclusions', () => {
  assert.deepEqual(feedItem({ ...P, merchant_exclude: 1 }, ctx()), { skip: 'excluded by owner' });
  assert.deepEqual(feedItem(P, ctx({ excludedCategories: ['toner'] })), { skip: 'category excluded' });
  assert.ok(feedItem({ ...P, merchant_exclude: 0 }, ctx()).id);
});

test('image warnings, skip and the 800 boundary', () => {
  assert.deepEqual(feedItem(P, ctx()).warnings, []);
  assert.deepEqual(feedItem({ ...P, img_w: 800, img_h: 2000 }, ctx()).warnings, []);
  assert.deepEqual(feedItem({ ...P, img_w: 799, img_h: 2000 }, ctx()).warnings, ['image under 800 px']);
  assert.deepEqual(feedItem({ ...P, img_w: 0, img_h: 0 }, ctx()).warnings, ['image size unknown']);
  assert.deepEqual(feedItem({ ...P, img_w: 500, img_h: 500 }, ctx({ minImagePx: 500 })).warnings, []);
  assert.deepEqual(feedItem({ ...P, img_w: 500, img_h: 900 }, ctx({ skipSmallImages: true })), { skip: 'image too small' });
  assert.ok(feedItem({ ...P, img_w: 800, img_h: 800 }, ctx({ skipSmallImages: true })).id);
  assert.ok(feedItem({ ...P, img_w: 0, img_h: 0 }, ctx({ skipSmallImages: true })).id); // unknown size is never skipped
  assert.deepEqual(feedItem({ ...P, img: '' }, ctx({ skipSmallImages: true })), { skip: 'no image' });
});

test('buildFeed: rows, warnings, no pid/warnings in xml', () => {
  const r = buildFeed({ base: 'https://x.test', categories: cats, merchant: { categoryMap: { toner: '99' }, excludedCategories: [] }, products: [P, { ...P, id: 8, img_w: 100, img_h: 100 }, { ...P, id: 9, price: 0 }, { ...P, id: 10, merchant_exclude: 1 }] });
  assert.equal(r.items.length, 2);
  assert.deepEqual(r.rows.map(x => [x.pid, x.included, x.reason]), [[7, true, ''], [8, true, ''], [9, false, 'no price'], [10, false, 'excluded by owner']]);
  assert.deepEqual(r.warnings, [{ reason: 'image under 800 px', count: 1 }]);
  assert.match(r.xml, /<g:google_product_category>99</);
  assert.ok(!/pid|warnings|image under/.test(r.xml));
  assert.ok(r.skipped.some(s => s.reason === 'no price'));
});

test('buildFeedTable: TSV and CSV', () => {
  const it = feedItem({ ...P, name: 'Tab\there "q"', description: 'line1\nline2, with comma\r\nবাংলা টোনার', images: ['/b.jpg', '/c.jpg'] }, feedContext({ base: 'https://x.test', categories: cats, settings: { shipping: { zones: [{ id: 'dhaka', rate: 60 }] } } }));
  const tsv = buildFeedTable([it]);
  const lines = tsv.split('\n');
  assert.equal(lines.length, 3); assert.equal(lines[2], '');
  assert.equal(lines[0], 'id\ttitle\tdescription\tlink\timage_link\tadditional_image_link\tavailability\tprice\tsale_price\tsale_price_effective_date\tbrand\tgtin\tmpn\tcondition\tidentifier_exists\tproduct_type\tgoogle_product_category\titem_group_id\tshipping');
  const cells = lines[1].split('\t');
  assert.equal(cells.length, 19);
  assert.equal(cells[1], 'Tab here "q"');
  assert.ok(cells[2].includes('বাংলা টোনার'));
  assert.equal(cells[5], 'https://x.test/b.jpg,https://x.test/c.jpg');
  assert.equal(cells[18], 'BD:Standard:60.00 BDT');
  assert.ok(!tsv.startsWith('﻿'));
  const csv = buildFeedTable([it], ',');
  assert.ok(csv.includes('"Tab here ""q"""'));
  assert.ok(csv.includes('"https://x.test/b.jpg,https://x.test/c.jpg"'));
  assert.equal(csv.trim().split('\n').length, 2);
  assert.equal(buildFeedTable([]), lines[0] + '\n');
});

test('feedAccess', () => {
  assert.equal(feedAccess({ feedToken: 'abc' }, false, 'abc'), 'off');
  assert.equal(feedAccess(undefined, true, undefined), 'ok');
  assert.equal(feedAccess({ feedToken: '' }, true, 'x'), 'ok');
  assert.equal(feedAccess({ feedToken: 'abc' }, true, 'abc'), 'ok');
  for (const q of [undefined, '', 'abd', 'abcd', ['abc'], { a: 1 }]) assert.equal(feedAccess({ feedToken: 'abc' }, true, q), 'denied');
});

test('ensureMerchantColumns adds only the missing columns', async () => {
  const run = have => { const sql = []; return { sql, db: { query: async q => { sql.push(q); return q.startsWith('SELECT') ? [have.map(c => ({ c }))] : [[]]; } } }; };
  let t = run(['id', 'item_group_id']);
  assert.deepEqual(await ensureMerchantColumns(t.db), ['merchant_exclude', 'google_category']);
  assert.equal(t.sql.filter(s => s.startsWith('ALTER')).length, 2);
  t = run(['merchant_exclude', 'item_group_id', 'google_category']);
  assert.deepEqual(await ensureMerchantColumns(t.db), []);
  t = run([]);
  assert.deepEqual(await ensureMerchantColumns(t.db), []);
  assert.equal(t.sql.length, 1);
});
