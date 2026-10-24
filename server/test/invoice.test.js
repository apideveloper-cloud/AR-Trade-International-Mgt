import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { buildInvoicePdf, invoiceNo } from '../src/invoice.js';

const items = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: 'Canon imageRUNNER Black Toner ' + (i + 1), price: 800 + i * 10, qty: 1 + (i % 3), backorder: i === 1 ? 1 : 0 }));
const order = (n = 3, extra = {}) => ({
  id: 'AR-10501', date: '2026-10-23T12:30:00Z', status: 'Confirmed', payment: 'Cash on delivery', payStatus: 'Unpaid', area: 'inside',
  address: 'বাড়ি ১২, রোড ৪, শান্তিনগর, ঢাকা (House 12)', note: 'Please call first। ধন্যবাদ', customer: { name: 'শাকিল আহমেদ (Shakil)', phone: '01711000000', email: 'shakil@example.com' },
  subtotal: 5000, discount: 250, delivery: 0, vat: 600, total: 4750, items: items(n), ...extra
});
const pages = buf => (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;

test('invoice number follows the order number', () => {
  assert.equal(invoiceNo('AR-10501'), 'INV-10501');
  assert.equal(invoiceNo('WP-20960'), 'INV-20960');
});

test('builds a real one-page PDF, Bengali text included', async () => {
  const buf = await buildInvoicePdf(order(3), { phone: '+880 1977-554401', email: 'info@artradeinternational.com' });
  assert.equal(buf.slice(0, 5).toString(), '%PDF-');
  assert.ok(buf.length > 5000);
  assert.equal(pages(buf), 1);
});

test('a long order flows onto more pages', async () => {
  const buf = await buildInvoicePdf(order(45, { payStatus: 'Paid', status: 'Delivered' }), {});
  assert.ok(pages(buf) >= 2, 'pages: ' + pages(buf));
});

test('odd input does not crash it (no email, no address, very long word)', async () => {
  const buf = await buildInvoicePdf(order(1, { address: '', note: '', customer: { name: 'X'.repeat(200), phone: '', email: '' }, items: [{ id: 1, name: 'Y'.repeat(300), price: 1, qty: 1, backorder: 0 }] }), null ?? {});
  assert.equal(buf.slice(0, 5).toString(), '%PDF-');
});

test('the PDF travels as an email attachment', async () => {
  const pdf = await buildInvoicePdf(order(2), {});
  const t = nodemailer.createTransport({ jsonTransport: true });
  const info = await t.sendMail({ from: 'shop@example.com', to: 'shakil@example.com', subject: 'Your invoice', text: 'attached', attachments: [{ filename: 'INV-10501.pdf', content: pdf, contentType: 'application/pdf' }] });
  const msg = JSON.parse(info.message);
  assert.equal(msg.attachments.length, 1);
  assert.equal(msg.attachments[0].filename, 'INV-10501.pdf');
  assert.equal(Buffer.from(msg.attachments[0].content, 'base64').slice(0, 5).toString(), '%PDF-');
});
