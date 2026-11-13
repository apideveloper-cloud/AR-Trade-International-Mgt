import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, int, text, iso, monthBounds, esc, digits } from '../src/util.js';
import { money as invoiceMoney } from '../src/invoice.js';
import { pageOf, day } from '../src/listing.js';

test('money rounds to whole taka with thousands separators', () => {
  assert.equal(money(0), '৳ 0');
  assert.equal(money('12500.6'), '৳ 12,501');
  assert.equal(money(null), '৳ 0');
  assert.equal(money('abc'), '৳ 0');
  assert.equal(money(1234567), '৳ 1,234,567');
});

test('invoice.js re-exports the shared money helper', () => {
  assert.equal(invoiceMoney, money);
});

test('int clamps to 0..max and rounds', () => {
  assert.equal(int(-5), 0);
  assert.equal(int('7.6'), 8);
  assert.equal(int('x'), 0);
  assert.equal(int(500, 100), 100);
});

test('text trims and cuts', () => {
  assert.equal(text('  hello  ', 3), 'hel');
  assert.equal(text(null, 5), '');
});

test('iso accepts only real calendar dates', () => {
  assert.equal(iso('2026-02-28', null), '2026-02-28');
  assert.equal(iso('2026-02-31', 'x'), 'x');
  assert.equal(iso('26-1-1', 'x'), 'x');
  assert.equal(day('2026-13-01'), null);
});

test('monthBounds gives the first day of this and the next month', () => {
  assert.deepEqual(monthBounds('2026-10'), ['2026-10-01', '2026-11-01']);
  assert.deepEqual(monthBounds('2026-12'), ['2026-12-01', '2027-01-01']);
});

test('pageOf reads page and size with limits', () => {
  assert.deepEqual(pageOf({ query: {} }), { size: 25, page: 1, offset: 0 });
  assert.deepEqual(pageOf({ query: { page: '3', size: '10' } }), { size: 10, page: 3, offset: 20 });
  assert.equal(pageOf({ query: { size: '99999' } }).size, 200);
  assert.equal(pageOf({ query: { size: '99999' } }, { max: 5000 }).size, 5000);
  assert.equal(pageOf({ query: { page: '-4', size: '0' } }).page, 1);
  assert.equal(pageOf({ query: { size: '0' } }).size, 25);
});

test('esc and digits', () => {
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(digits('+880 1711-000'), '8801711000');
});
