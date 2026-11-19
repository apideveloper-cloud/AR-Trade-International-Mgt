import test from 'node:test';
import assert from 'node:assert/strict';
import { toEnDigits, isBangla, taka, squash } from '../src/chatbot/text.js';
import { parseBudget } from '../src/chatbot/budget.js';
import { understand, brandsOf } from '../src/chatbot/understand.js';
import { searchProducts } from '../src/chatbot/search.js';
import { intentOf, faqAnswer, facts } from '../src/chatbot/info.js';
import * as facade from '../src/chatbot.js';

const P = (id, o) => ({ id, cat: 'printer', brand: 'HP', name: 'HP ' + id, price: 1000 * id, stock: 1, popular: false, featured: false, ...o });
const products = [P(1), P(2), P(3), P(4, { brand: 'Epson' })];

test('text helpers', () => {
  assert.equal(toEnDigits('১২৩'), '123');
  assert.ok(isBangla('প্রিন্টার')); assert.ok(!isBangla('printer'));
  assert.equal(taka(12500), '৳12,500');
  assert.equal(squash('HP M12-w'), 'hpm12w');
});

test('budget and understanding', () => {
  assert.deepEqual(parseBudget('around 10k'), { min: 8000, max: 12000 });
  assert.equal(parseBudget('model 79'), null);
  assert.deepEqual(brandsOf(products), ['HP']); // Epson has fewer than 3 products
  const u = understand('cheapest hp printer', products);
  assert.equal(u.ctx.cat, 'printer'); assert.equal(u.ctx.brand, 'HP'); assert.equal(u.ctx.sort, 'cheap');
});

test('search keeps the cheapest in-stock first within a budget', () => {
  const r = searchProducts({ cat: 'printer', min: 0, max: 2500, flags: {} }, [], products);
  assert.deepEqual(r.list.map(p => p.id), [1, 2]);
});

test('intents and faq', () => {
  assert.equal(intentOf('how do i pay with bkash'), 'payment');
  assert.equal(intentOf('hello world nothing'), null);
  assert.equal(faqAnswer('printer warranty period', { faqs: [{ q: 'What is the printer warranty period', a: 'One year. Call {phone}' }] }, { phone: '01' }), 'One year. Call 01');
  assert.deepEqual(facts({ payments: { COD: true, bKash: true, Bank: false } }, { brands: [{ n: 'HP' }] }, [{ t: 'Printers' }]), { pay: ['cash on delivery', 'bKash'], brands: ['HP'], cats: ['Printers'] });
});

test('the original import path still exports the public names', () => {
  for (const n of ['chatReply', 'engineReply', 'parseBudget', 'brandsOf', 'understand', 'searchProducts']) assert.equal(typeof facade[n], 'function');
});
