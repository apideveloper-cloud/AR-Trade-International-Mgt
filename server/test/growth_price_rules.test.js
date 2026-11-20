import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePriceChange as v, onlyChanged, wholeNumber } from '../src/growth/priceRules.js';

const prod = { price: 1000, old: 0, stock: 5, active: true, saleEnds: null };
const T = { today: '2026-11-20' };
const fields = (p, c) => v(p, c, T).errors.map(e => e.field);

test('wholeNumber accepts only non-negative integers', () => {
  assert.equal(wholeNumber(0), 0); assert.equal(wholeNumber('12'), 12);
  for (const bad of [-1, 1.5, '1.5', 'abc', '', NaN, null, undefined, '-3']) assert.equal(wholeNumber(bad), null);
});
test('price bounds 0..10,000,000 and 0 is refused on a live product', () => {
  assert.deepEqual(fields(prod, { price: -1 }), ['price']);
  assert.deepEqual(fields(prod, { price: 12.5 }), ['price']);
  assert.deepEqual(fields(prod, { price: 10000001 }), ['price']);
  assert.deepEqual(fields(prod, { price: 10000000 }), []);
  assert.deepEqual(fields(prod, { price: 0 }), ['price']);
  assert.deepEqual(fields({ ...prod, active: false }, { price: 0 }), []);
  assert.deepEqual(fields({ ...prod, active: 0 }, { price: 0 }), []);
});
test('old price is 0 or >= price, merged with the stored values', () => {
  assert.deepEqual(fields(prod, { price: 900, old: 900 }), []);
  assert.deepEqual(fields(prod, { price: 900, old: 1000 }), []);
  assert.deepEqual(fields(prod, { price: 900, old: 0 }), []);
  assert.deepEqual(fields(prod, { price: 900, old: 899 }), ['old']);
  assert.deepEqual(fields(prod, { old: 999 }), ['old']); // stored price 1000
  assert.deepEqual(fields({ ...prod, old: 1200 }, { price: 1300 }), ['price']); // stored old 1200 < new price
  assert.deepEqual(fields(prod, { old: '' }), []);
  assert.deepEqual(fields(prod, { old: -5 }), ['old']);
});
test('stock bounds and stock status', () => {
  assert.deepEqual(fields(prod, { stock: 0 }), []);
  assert.deepEqual(fields(prod, { stock: 1000000 }), []);
  assert.deepEqual(fields(prod, { stock: 1000001 }), ['stock']);
  assert.deepEqual(fields(prod, { stock: -1 }), ['stock']);
  assert.deepEqual(fields(prod, { stockStatus: 'preorder' }), []);
  assert.deepEqual(fields(prod, { stockStatus: 'soon' }), ['stockStatus']);
  assert.equal(v(prod, { stockStatus: ' In_Stock ' }, T).value.stockStatus, 'in_stock');
});
test('sale end date: real date, past date with a sale price is an error', () => {
  assert.deepEqual(fields(prod, { saleEnds: '2026-13-01' }), ['saleEnds']);
  assert.deepEqual(fields(prod, { saleEnds: 'tomorrow' }), ['saleEnds']);
  assert.deepEqual(fields(prod, { old: 1500, saleEnds: '2026-11-19' }), ['saleEnds']);
  assert.deepEqual(fields(prod, { old: 1500, saleEnds: '2026-11-20' }), []); // today is still on sale
  assert.deepEqual(fields(prod, { old: 0, saleEnds: '2026-11-19' }), []); // no sale price: nothing to expire
  assert.equal(v(prod, { saleEnds: '' }, T).value.saleEnds, null);
  assert.match(v(prod, { old: 1500, saleEnds: '2026-01-01' }, T).errors[0].message, /sale already ended/i);
});
test('jump: exactly 50% is fine, 51% needs confirmation, both directions', () => {
  assert.equal(v(prod, { price: 1500 }, T).jump, null);
  assert.equal(v(prod, { price: 500 }, T).jump, null);
  assert.deepEqual(v(prod, { price: 1510 }, T).jump, { from: 1000, to: 1510, pct: 51 });
  assert.deepEqual(v(prod, { price: 490 }, T).jump, { from: 1000, to: 490, pct: 51 });
  assert.equal(v({ ...prod, price: 0, active: false }, { price: 5000 }, T).jump, null); // no old price to compare
  assert.equal(v(prod, { price: 1500, old: 10 }, T).jump, null); // errors: no jump
});
test('clean values only for the fields that were sent', () => {
  assert.deepEqual(v(prod, { price: '1200', stock: '7' }, T).value, { price: 1200, stock: 7 });
  assert.deepEqual(v(prod, {}, T), { value: {}, errors: [], jump: null });
});
test('onlyChanged drops unchanged fields so legacy data never blocks an unrelated edit', () => {
  const legacy = { price: 1000, old_price: 800, stock: 5, active: 1, sale_ends: null, stock_status: 'auto' };
  assert.deepEqual(onlyChanged(legacy, { price: 1000, old: 800, stock: 6, saleEnds: '', stockStatus: 'auto' }), { stock: 6 });
  assert.deepEqual(v(legacy, onlyChanged(legacy, { price: 1000, old: 800, stock: 6 }), T).errors, []);
  assert.deepEqual(onlyChanged(legacy, { old: '' }), { old: '' });
});
