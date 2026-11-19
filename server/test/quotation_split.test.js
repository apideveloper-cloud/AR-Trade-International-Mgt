import test from 'node:test';
import assert from 'node:assert/strict';
import { totalsOf, num, dmy, validUntil, titleCase, sentence, words } from '../src/quotation/totals.js';
import { cleanLines, parseQuoteBody } from '../src/quotation/body.js';
import { termsFromText, addressList } from '../src/quotation/terms.js';
import { quoteRouter, words as wordsViaFacade } from '../src/quotation.js';

test('totals: net = total + charges - discount, never below zero', () => {
  const lines = [{ qty: 2, unitPrice: 500 }, { qty: 1, unitPrice: 250 }];
  assert.deepEqual(totalsOf(lines, { install: 100, transport: 50, vat: 25, discount: 75 }), { total: 1250, net: 1350 });
  assert.equal(totalsOf(lines, { install: 0, transport: 0, vat: 0, discount: 5000 }).net, 0);
});

test('display helpers', () => {
  assert.equal(num(1234.4), '1,234.00');
  assert.equal(dmy('2026-03-09'), '09/03/2026');
  assert.equal(validUntil('2026-02-27', 3), '02/03/2026');
  assert.equal(titleCase('SEVEN THOUSAND'), 'Seven Thousand');
  assert.equal(sentence('HELLO THERE. BYE NOW'), 'Hello there. Bye now');
  assert.equal(words(7500), 'SEVEN THOUSAND FIVE HUNDRED');
  assert.equal(wordsViaFacade(0), 'ZERO');
  assert.equal(typeof quoteRouter, 'function');
});

test('request body is cleaned and validated', () => {
  assert.equal(cleanLines([{ description: '  ', qty: 1 }, { description: 'Toner', qty: 0, unit: 'box' }]).length, 1);
  assert.equal(cleanLines([{ description: 'Toner', qty: 0, unit: 'box' }])[0].qty, 1);
  assert.equal(cleanLines(null).length, 0);
  assert.throws(() => parseQuoteBody({ lines: [{ description: 'x', qty: 1, unitPrice: 1 }] }), /who the quotation is for/);
  assert.throws(() => parseQuoteBody({ toName: 'A' }), /at least one item/);
  assert.throws(() => parseQuoteBody({ toName: 'A', discount: 50, lines: [{ description: 'x', qty: 1, unitPrice: 10 }] }), /discount is more/);
  const b = parseQuoteBody({ toName: ' A ', custType: 'Bogus', date: '2026-01-05', lines: [{ description: 'x', qty: 2, unitPrice: 10 }] });
  assert.equal(b.toName, 'A'); assert.equal(b.custType, 'New'); assert.equal(b.total, 20); assert.equal(b.net, 20); assert.equal(b.validDays, 1);
});

test('terms scan text and address lists', () => {
  assert.deepEqual(termsFromText('N.B.\n01. Cash on delivery.\n2) Valid for 3\ndays only.'), ['Cash on delivery.', 'Valid for 3 days only.']);
  assert.deepEqual(addressList('A@x.com, b@y.com; a@x.com', 'CC'), ['a@x.com', 'b@y.com']);
  assert.throws(() => addressList('nope', 'CC'), /not a valid email/);
});
