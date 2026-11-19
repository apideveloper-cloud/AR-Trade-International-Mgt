import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSeq, billedOf, yearYY, normalizeLines, checkLines, sum, vOut, vendorBody, linesByProduct } from '../src/inventory/pure.js';
import { BILLED, METHODS, BAL, PAID } from '../src/inventory/constants.js';
import { ensureInventory, invRouter } from '../src/inventory.js';

test('formatSeq pads to five digits', () => {
  assert.equal(formatSeq('VEN-26-', 1), 'VEN-26-00001');
  assert.equal(formatSeq('VSI-26-', 12345), 'VSI-26-12345');
});

test('billedOf counts only Approved and Stocked', () => {
  assert.equal(billedOf('Approved'), true);
  assert.equal(billedOf('Stocked'), true);
  assert.equal(billedOf('Pending'), false);
  assert.equal(billedOf('Rejected'), false);
});

test('yearYY returns two digits', () => assert.equal(yearYY(new Date(2026, 5, 1)), '26'));

test('normalizeLines drops empty rows and caps at 60', () => {
  const l = normalizeLines([{ productId: '5', qty: '2', unitCost: '100' }, { productId: 0, qty: 1 }, { productId: 7, qty: 0 }]);
  assert.deepEqual(l, [{ productId: 5, qty: 2, unitCost: 100, discount: 0 }]);
  assert.deepEqual(normalizeLines('x'), []);
  assert.equal(normalizeLines(Array.from({ length: 80 }, () => ({ productId: 1, qty: 1 }))).length, 60);
});

test('checkLines messages', () => {
  assert.throws(() => checkLines([]), /at least one product/);
  assert.throws(() => checkLines([{ productId: 1, qty: 1, unitCost: 0, discount: 0 }]), /buying price/);
  assert.doesNotThrow(() => checkLines([{ productId: 1, qty: 1, unitCost: 0, discount: 0 }], false));
  assert.throws(() => checkLines([{ productId: 1, qty: 1, unitCost: 10, discount: 11 }]), /discount/);
});

test('sum subtracts discounts and refuses huge totals', () => {
  assert.equal(sum([{ qty: 2, unitCost: 100, discount: 50 }, { qty: 1, unitCost: 30 }]), 180);
  assert.throws(() => sum([{ qty: 100000, unitCost: 100000, discount: 0 }]), /too large/);
});

test('vOut and vendorBody shape vendor data', () => {
  const b = vendorBody({ name: ' Acme ', vtype: 'Foreign', opening: '10.4', active: false });
  assert.equal(b.name, 'Acme');
  assert.equal(b.vtype, 'Foreign');
  assert.equal(b.opening, 10);
  assert.equal(b.active, 0);
  assert.equal(vendorBody({ name: 'x', vtype: 'other' }).vtype, 'Local');
  const o = vOut({ id: 1, name: 'A', vtype: 'x', active: 1, bills: '5', balance: '3' });
  assert.equal(o.vtype, 'Local');
  assert.equal(o.active, true);
  assert.equal(o.bills, 5);
  assert.equal(o.balance, 3);
  assert.equal(o.code, '');
});

test('linesByProduct indexes by numeric product id', () => {
  const m = linesByProduct({ lines: [{ productId: '4', salePrice: 9 }] });
  assert.equal(m.get(4).salePrice, 9);
  assert.equal(linesByProduct(undefined).size, 0);
});

test('constants and the original import path still export the same names', () => {
  assert.ok(BILLED.includes('Approved') && BAL.includes(BILLED) && PAID.includes('receipt_id'));
  assert.deepEqual(METHODS, ['Cash', 'Bank transfer', 'bKash', 'Nagad', 'Cheque']);
  assert.equal(typeof ensureInventory, 'function');
  assert.equal(typeof invRouter, 'function');
});

test('router keeps every route', () => {
  const routes = invRouter.stack.flatMap(l => l.handle?.stack ? l.handle.stack : [l]).filter(l => l.route).map(l => Object.keys(l.route.methods)[0].toUpperCase() + ' ' + l.route.path);
  for (const r of ['GET /vendors', 'POST /vendors', 'PUT /vendors/:id', 'DELETE /vendors/:id', 'GET /transactions', 'GET /vendors/:id/ledger', 'GET /products', 'GET /categories', 'POST /products', 'GET /stock', 'GET /stock/:id/moves', 'POST /stock/adjust', 'GET /receipts', 'GET /next-invoice', 'GET /receipts/:id', 'GET /open-orders', 'GET /open-orders/:id', 'POST /receipts', 'POST /receipts/:id/approve', 'POST /receipts/:id/reject', 'POST /receipts/:id/stock-in', 'DELETE /receipts/:id', 'GET /damages', 'POST /damages', 'GET /returns', 'GET /returns/:id', 'POST /returns', 'GET /payments', 'POST /payments', 'DELETE /payments/:id', 'GET /summary']) assert.ok(routes.includes(r), 'missing ' + r);
  assert.equal(routes.length, 31);
});
