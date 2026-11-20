import test from 'node:test';
import assert from 'node:assert/strict';
import { conditionOf, stockStatusOf, saleEndsOf, warrantyTextOf, noindexOf, productSeoFields, previewInput } from '../src/admin/seoValidate.js';
import { SEO_MANAGE, PERM_KEYS, DEFAULTS, permsOf, PERMS } from '../src/permissions.js';

test('item condition and stock status accept only the listed values', () => {
  for (const c of ['new', 'refurbished', 'used']) assert.equal(conditionOf(c), c);
  assert.equal(conditionOf(' Used '), 'used');
  assert.throws(() => conditionOf('broken'));
  for (const s of ['auto', 'in_stock', 'out_of_stock', 'preorder', 'backorder']) assert.equal(stockStatusOf(s), s);
  assert.throws(() => stockStatusOf('maybe'));
  assert.throws(() => stockStatusOf(''));
});

test('sale end date: empty clears, YYYY-MM-DD must be a real date', () => {
  assert.equal(saleEndsOf(''), null);
  assert.equal(saleEndsOf(null), null);
  assert.equal(saleEndsOf('2026-12-31'), '2026-12-31');
  assert.equal(saleEndsOf('2028-02-29'), '2028-02-29');
  assert.throws(() => saleEndsOf('2027-02-29'));
  assert.throws(() => saleEndsOf('31/12/2026'));
  assert.throws(() => saleEndsOf('2026-13-01'));
});

test('warranty text is trimmed and limited to 300 characters', () => {
  assert.equal(warrantyTextOf('  1 year  '), '1 year');
  assert.equal(warrantyTextOf(null), '');
  assert.equal(warrantyTextOf('x'.repeat(300)).length, 300);
  assert.throws(() => warrantyTextOf('x'.repeat(301)));
});

test('noindex is a strict boolean', () => {
  assert.equal(noindexOf(true), 1);
  assert.equal(noindexOf('1'), 1);
  assert.equal(noindexOf(false), 0);
  assert.equal(noindexOf('0'), 0);
  assert.equal(noindexOf(undefined), 0);
});

test('productSeoFields only touches the keys that were sent', () => {
  assert.deepEqual(productSeoFields({ name: 'x' }), { sets: [], vals: [] });
  const r = productSeoFields({ itemCondition: 'used', saleEnds: '', stockStatus: 'preorder', warrantyText: '6 months', noindex: true });
  assert.deepEqual(r.sets, ['item_condition = ?', 'sale_ends = ?', 'stock_status = ?', 'warranty_text = ?', 'noindex = ?']);
  assert.deepEqual(r.vals, ['used', null, 'preorder', '6 months', 1]);
  assert.throws(() => productSeoFields({ itemCondition: 'x' }));
});

test('previewInput validates kind and field and clamps the template', () => {
  const p = previewInput({ kind: 'category', field: 'ogTitle', template: 'a'.repeat(1000), id: 12 });
  assert.equal(p.template.length, 300);
  assert.equal(p.id, '12');
  assert.equal(previewInput({}).kind, 'product');
  assert.equal(previewInput({}).template, null);
  assert.throws(() => previewInput({ kind: 'nope' }));
  assert.throws(() => previewInput({ field: 'body' }));
  assert.equal(previewInput({ template: 5 }).template, null);
});

test('seo.manage is a Catalog permission default for Master Admin and Admin only', () => {
  assert.ok(PERM_KEYS.includes(SEO_MANAGE));
  assert.equal(PERMS.find(p => p[0] === SEO_MANAGE)[1], 'Catalog');
  assert.ok(DEFAULTS.Admin.includes(SEO_MANAGE));
  assert.ok(permsOf('Master Admin').has(SEO_MANAGE));
  assert.ok(!permsOf('Manager').has(SEO_MANAGE) && !DEFAULTS.Manager.includes(SEO_MANAGE));
});
