import test from 'node:test';
import assert from 'node:assert/strict';
import { canReopen, reopenError } from '../src/flow.js';
import { buildInvoicePdf, docInfo, docLabel } from '../src/invoice.js';

const pages = buf => (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
const order = (n, extra = {}) => ({
  id: 'AR-10777', date: '2026-10-23T12:30:00Z', status: 'Confirmed', payment: 'Cash on delivery', payStatus: 'Unpaid', area: 'inside',
  address: 'House 12, Road 4, Santinagar, Dhaka', note: 'Please call first. Leave with the guard if I am out.', customer: { name: 'Shakil', phone: '01711000000', email: 's@example.com' },
  subtotal: 5000, discount: 0, delivery: 0, total: 5000,
  items: Array.from({ length: n }, (_, i) => ({ id: i + 1, name: 'Canon Toner ' + (i + 1), price: 800, qty: 1, backorder: 0 })), ...extra
});

test('cancelled orders cannot be reopened, delivered cannot go back', () => {
  for (const to of ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered']) assert.equal(canReopen('Cancelled', to), false);
  assert.match(reopenError('Cancelled', 'Pending'), /cannot be reopened/);
  assert.equal(canReopen('Cancelled', 'Cancelled'), true);
  assert.equal(canReopen('Delivered', 'Packed'), false);
  assert.equal(canReopen('Delivered', 'Delivered'), true);
  assert.equal(canReopen('Pending', 'Confirmed'), true);
  assert.equal(canReopen('Packed', 'Cancelled'), true);
});

test('docInfo / docLabel', () => {
  assert.deepEqual([docInfo({ id: 'AR-5', status: 'Pending' }).title, docInfo({ id: 'AR-5', status: 'Pending' }).no], ['SALES ORDER', 'SO-5']);
  assert.equal(docInfo({ id: 'AR-5', status: 'Cancelled' }).no, 'SO-5');
  assert.equal(docInfo({ id: 'AR-5', status: 'Shipped' }).no, 'INV-5');
  const l = docLabel({ id: 'AR-5', status: 'Packed' });
  assert.equal(l.lower, 'sales invoice');
  assert.equal(l.fileName, 'INV-5.pdf');
});

test('PDF layout: up to 9 items with a note stay on one page, 10+ move the totals to a second page (never crowding the footer)', async () => {
  assert.equal(pages(await buildInvoicePdf(order(6), {})), 1);
  assert.equal(pages(await buildInvoicePdf(order(9), {})), 1);
  assert.equal(pages(await buildInvoicePdf(order(10), {})), 2);
  assert.equal(pages(await buildInvoicePdf(order(11), {})), 2);
});
