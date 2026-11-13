import test from 'node:test';
import assert from 'node:assert/strict';
import { engineReply, parseBudget } from '../src/chatbot.js';

const P = (id, o) => ({ id, cat: 'printer', brand: 'HP', name: 'HP printer ' + id, price: 0, stock: 5, popular: false, featured: false, tech: 'Laser', ...o });
const products = [
  P(1, { price: 7000, tech: 'Inkjet', name: 'HP DeskJet 2336' }), P(2, { price: 7700, tech: 'Inkjet', name: 'HP DeskJet 2320' }), P(3, { price: 14000, name: 'HP Laser 107a' }),
  P(4, { brand: 'HP', cat: 'toner', price: 8300, name: 'HP 79A Toner (CF279A)', part: 'CF279A', tech: '' }),
  P(5, { brand: 'Epson', price: 30000, name: 'Epson L805' }), P(6, { brand: 'HP', price: 9000, name: 'HP extra' }), P(7, { brand: 'HP', price: 9100, name: 'HP extra 2' })
];
const data = { products, cats: [{ id: 'printer', t: 'Printers' }], content: { faqs: [], policies: [], brands: [] },
  site: { phone: '+880 1', email: 'a@b.c', address: 'Dhaka', insideFee: 0, outsideFee: 150, suburbFee: 100, freeOver: 5000, payments: { COD: true, bKash: true }, coupon: 'X5', couponPct: 5, memberPct: 3, svcPrices: [] } };

test('budgets are read from natural wording', () => {
  assert.deepEqual(parseBudget('price between 5000 to 8000'), { min: 5000, max: 8000 });
  assert.equal(parseBudget('printer under 10k').max, 10000);
  assert.equal(parseBudget('above 20,000 tk').min, 20000);
  assert.equal(parseBudget('১০ হাজার টাকার মধ্যে').max, 10000);
  assert.equal(parseBudget('HP 12A toner'), null); // a model number is not a price
});

test('a follow-up budget keeps the earlier brand and product type', () => {
  const a = engineReply({ text: 'any hp low price printer', ctx: {} }, data);
  assert.equal(a.items[0].name, 'HP DeskJet 2336'); // cheapest first
  assert.ok(a.items.every(i => i.price > 0));
  const b = engineReply({ text: 'price between 5000 to 8000', ctx: a.ctx }, data);
  assert.deepEqual(b.items.map(i => i.id), [1, 2]);
  assert.match(b.text, /5,000/);
});

test('model numbers and shop questions get answers, unknown topics are flagged for staff', () => {
  assert.match(engineReply({ text: 'CF279A', ctx: {} }, data).text, /8,300/);
  assert.match(engineReply({ text: 'do you accept bkash?', ctx: {} }, data).text, /bKash/);
  assert.match(engineReply({ text: 'delivery charge outside dhaka', ctx: {} }, data).text, /150/);
  assert.equal(engineReply({ text: 'capital of france', ctx: {} }, data).unanswered, true);
});
