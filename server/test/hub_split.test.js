import test from 'node:test';
import assert from 'node:assert/strict';
import { addAttempt, deliveryNote, groupItems, isCod, liveProgress, phoneMatches, riderOut } from '../src/hub/helpers.js';

test('isCod', () => {
  assert.ok(isCod({ payment: 'Cash on Delivery', pay_status: 'Unpaid' }));
  assert.ok(!isCod({ payment: 'Cash on Delivery', pay_status: 'Paid' }));
  assert.ok(!isCod({ payment: 'bKash' }));
  assert.ok(!isCod({}));
});

test('riderOut converts rating', () => {
  assert.deepEqual(riderOut({ id: 1, name: 'R', phone: 'p', vehicle: 'v', rating: '4.5', branch_id: 'B1' }), { id: 1, name: 'R', phone: 'p', vehicle: 'v', rating: 4.5, branch: 'B1' });
});

test('groupItems groups by order id', () => {
  const m = groupItems([{ order_id: 'A', q: 1 }, { order_id: 'B' }, { order_id: 'A', q: 2 }]);
  assert.equal(m.get('A').length, 2);
  assert.equal(m.get('B').length, 1);
});

test('phoneMatches uses the last 10 digits and never matches blank', () => {
  const o = { customer_phone: '+880 1711-223344' };
  assert.ok(phoneMatches(o, '01711223344'));
  assert.ok(!phoneMatches(o, '01711223345'));
  assert.ok(!phoneMatches(o, ''));
  assert.ok(!phoneMatches(undefined, '01711223344'));
});

test('deliveryNote', () => {
  assert.equal(deliveryNote('courier', { courier: 'pathao' }, {}), 'Confirmed by pathao');
  assert.equal(deliveryNote('otp', {}, {}), 'OTP verified');
  assert.equal(deliveryNote('sig', {}, {}), 'Signed by customer');
  assert.equal(deliveryNote('sig', {}, { name: 'Rahim' }), 'Signed by Rahim');
});

test('liveProgress is clamped', () => {
  assert.deepEqual(liveProgress(0), { pct: 8, etaMin: 35, sinceMin: 1 });
  const late = liveProgress(60);
  assert.equal(late.pct, 94);
  assert.equal(late.etaMin, 3);
});

test('addAttempt flags the third failure', () => {
  const a = addAttempt(null, 'no answer', 1);
  assert.equal(a.attempts.length, 1);
  assert.ok(!a.flagged);
  assert.ok(addAttempt([{}, {}], 'x', 2).flagged);
});
