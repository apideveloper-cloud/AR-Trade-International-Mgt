import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoicePdf } from '../src/invoice.js';
import { buildDeliveryNotePdf, buildSalesOrderPdf } from '../src/salesorder.js';

const isPdf = b => Buffer.isBuffer(b) && b.slice(0, 5).toString() === '%PDF-' && b.length > 3000;
const lines = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: 'HP ' + (i + 1) + ' Black Original LaserJet Toner Cartridge বাংলা নাম', sku: 'SKU' + i, price: 4200, qty: 2 }));

test('the sales order PDF is built for a short and a multi-page order, with a Bengali customer name', async () => {
  const o = { id: 'SO-2026-1', customer: 'আরিফ এন্টারপ্রাইজ', createdAt: '2026-10-23T10:00:00Z', approval: 'Approved', approvedBy: 'Kamal', by: 'Rafiq', status: 'Placed', subtotal: 8400, discount: 420, total: 7980, notes: 'Call before delivery', customerInfo: { contact: 'Arif', phone: '01711000000', address: 'Dhaka' }, lines: lines(2) };
  assert.ok(isPdf(await buildSalesOrderPdf(o, { phone: '+880 1977' })));
  assert.ok(isPdf(await buildSalesOrderPdf({ ...o, approval: 'Pending', lines: lines(45) })));
});

test('the delivery note and the invoice PDFs are built (delivered and not yet delivered)', async () => {
  const d = { id: 'DN-1', orderId: 'SO-1', customer: 'IDLC Finance', amount: 7980, status: 'Ready', eta: 'ETA 3:15 PM', lines: lines(3), hasPhoto: false };
  assert.ok(isPdf(await buildDeliveryNotePdf(d)));
  assert.ok(isPdf(await buildDeliveryNotePdf({ ...d, status: 'Delivered', deliveredAt: '2026-10-24T10:00:00Z', receivedBy: 'Nusrat', hasPhoto: true, hasSignature: true })));
  const o = { id: 'WP-1', date: '2026-10-23T10:00:00Z', status: 'Confirmed', payStatus: 'Unpaid', payment: 'Cash on delivery', area: 'inside', customer: { name: 'A', phone: '01711000000' }, address: 'Dhaka', items: [{ name: 'Toner', price: 1000, qty: 1 }], subtotal: 1000, discount: 0, delivery: 0, vat: 0, total: 1000 };
  assert.ok(isPdf(await buildInvoicePdf(o, {})));
});
