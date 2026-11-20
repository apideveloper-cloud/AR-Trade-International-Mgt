import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCustomers } from '../src/admin/customers.js';
import { cleanLines } from '../src/quotation/body.js';

test('customers: two name spellings of one mobile add up instead of the last one winning', () => {
  const orders = [
    { name: 'Rahim', phone: '01712345678', email: '', n: 2, ltv: 1000, last: new Date('2026-01-01') },
    { name: 'Rahim Uddin', phone: '01712345678', email: 'r@x.com', n: 1, ltv: 500, last: new Date('2026-02-01') }
  ];
  const c = [...mergeCustomers(orders, []).values()];
  assert.equal(c.length, 1);
  assert.deepEqual([c[0].n, c[0].ltv, c[0].name, c[0].email], [3, 1500, 'Rahim Uddin', 'r@x.com']);
});

test('customers: accounts without a mobile number stay separate rows', () => {
  const users = [{ id: 1, name: 'A', phone: '', email: 'a@x.com' }, { id: 2, name: 'B', phone: '', email: 'b@x.com' }];
  const c = [...mergeCustomers([], users).values()];
  assert.equal(c.length, 2);
  assert.deepEqual(c.map(x => x.userId), [1, 2]);
});

test('customers: an account joins the orders of the same mobile number', () => {
  const m = mergeCustomers([{ name: 'A', phone: '01712345678', email: '', n: 1, ltv: 200, last: null }], [{ id: 7, name: 'A', phone: '+8801712345678', email: 'a@x.com', member_code: 'M1' }]);
  const c = [...m.values()];
  assert.equal(c.length, 1);
  assert.deepEqual([c[0].userId, c[0].email, c[0].memberCode, c[0].n], [7, 'a@x.com', 'M1', 1]);
});

test('quotation lines: a null entry is dropped, not a 500', () => {
  assert.deepEqual(cleanLines([null, { description: 'Toner', qty: 2, unitPrice: 100 }, undefined]).map(l => l.description), ['Toner']);
});
