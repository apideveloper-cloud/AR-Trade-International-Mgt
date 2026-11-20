import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { pool } from '../src/db.js';
import { fakeReviewDb } from './growth_review_fake.js';
import { cancelRequest, createRequestForOrder, markSent, noteOrderDelivered, optOutRequest, resendNow, runReviewJob } from '../src/growth/reviewRequests.js';
import { setDeps } from '../src/growth/reviewRequestsMail.js';
import { submitReviews } from '../src/growth/reviewRequestsSubmit.js';
import { signToken } from '../src/growth/reviewRequestsCore.js';
import { mountReviewRequestRoutes } from '../src/routes/reviewRequest.js';

const realQuery = pool.query;
after(() => { pool.query = realQuery; });
const DAY = 864e5;
const ON = { enabled: true, delayDays: 3, reminder: true, reminderDays: 7, expireDays: 30 };
const order = (o = {}) => ({ id: 'ORD-1', user_id: 5, customer_name: 'Rahim Uddin', customer_phone: '01712345678', customer_email: 'rahim@example.com', flow: 'Delivered', ...o });
const items = [{ order_id: 'ORD-1', product_id: 1, name: 'HP 12A Toner', img: '/api/uploads/a.webp' }, { order_id: 'ORD-1', product_id: 2, name: 'Canon Ink', img: '' }];
let sent, ready;
beforeEach(() => {
  sent = []; ready = true;
  setDeps({ sendMail: async m => { sent.push(m); return true; }, origin: async () => 'https://shop.test', mailReady: () => ready });
});

test('noteOrderDelivered creates one request, once (idempotent)', async () => {
  const db = fakeReviewDb({ orders: [order()], items, settings: ON });
  assert.deepEqual(await createRequestForOrder('ORD-1', 0), { created: true, channel: 'email' });
  assert.deepEqual((await createRequestForOrder('ORD-1')).reason, 'exists');
  await noteOrderDelivered('ORD-1');
  assert.equal(db.requests.length, 1);
  const r = db.requests[0];
  assert.deepEqual([r.status, r.email, r.user_id], ['Queued', 'rahim@example.com', 5]);
  assert.equal(r.send_at.getTime(), 3 * DAY);
  assert.equal(r.expires_at.getTime(), 33 * DAY);
});

test('skips: disabled, opted out, no items, not delivered, no contact; placeholder e-mail and mail-not-ready go to WhatsApp', async () => {
  let db = fakeReviewDb({ orders: [order()], items, settings: { ...ON, enabled: false } });
  assert.equal((await createRequestForOrder('ORD-1')).reason, 'disabled');
  db = fakeReviewDb({ orders: [order()], items }); // nothing stored: default is off
  assert.equal((await createRequestForOrder('ORD-1')).reason, 'disabled');
  db = fakeReviewDb({ orders: [order()], items, settings: ON });
  db.optouts.push({ id: 1, contact_key: 'rahim@example.com', kind: 'email' });
  assert.equal((await createRequestForOrder('ORD-1')).reason, 'opted out');
  db = fakeReviewDb({ orders: [order()], items, settings: ON });
  db.optouts.push({ id: 1, contact_key: '8801712345678', kind: 'phone' });
  assert.equal((await createRequestForOrder('ORD-1')).reason, 'opted out');
  db = fakeReviewDb({ orders: [order()], items: [], settings: ON });
  assert.equal((await createRequestForOrder('ORD-1')).reason, 'no items');
  db = fakeReviewDb({ orders: [order({ flow: 'Packed' })], items, settings: ON });
  assert.equal((await createRequestForOrder('ORD-1')).reason, 'not delivered');
  db = fakeReviewDb({ orders: [order({ customer_email: '', customer_phone: 'x' })], items, settings: ON });
  assert.equal((await createRequestForOrder('ORD-1')).reason, 'no contact');
  db = fakeReviewDb({ orders: [order({ customer_email: '01712345678@noemail.invalid' })], items, settings: ON });
  assert.equal((await createRequestForOrder('ORD-1')).channel, 'whatsapp');
  assert.equal(db.requests[0].email, '');
  db = fakeReviewDb({ orders: [order()], items, settings: ON }); ready = false;
  assert.equal((await createRequestForOrder('ORD-1')).channel, 'whatsapp');
});

test('noteOrderDelivered never throws, even when the database does', async () => {
  fakeReviewDb({ orders: [order()], items, settings: ON });
  const q = pool.query; pool.query = async () => { throw new Error('db down'); };
  const log = console.error; console.error = () => {};
  try { await assert.doesNotReject(noteOrderDelivered('ORD-1')); } finally { pool.query = q; console.error = log; }
});

test('job: sends due mail, one reminder, expires; skips when off; WhatsApp rows are left alone', async () => {
  const db = fakeReviewDb({ orders: [order(), order({ id: 'ORD-2', customer_email: '' })], items: [...items, { order_id: 'ORD-2', product_id: 1, name: 'HP 12A Toner' }], settings: ON });
  await createRequestForOrder('ORD-1', 0); await createRequestForOrder('ORD-2', 0);
  assert.equal(db.requests[1].channel, 'whatsapp');
  assert.deepEqual(await runReviewJob({ now: 1 * DAY }), { expired: 0, sent: 0, reminded: 0, errors: 0 }); // not yet due
  assert.equal((await runReviewJob({ now: 4 * DAY })).sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, 'sales'); assert.equal(sent[0].to, 'rahim@example.com');
  assert.match(sent[0].html, /https:\/\/shop\.test\/review\/[\w-]+\.[\w-]+/);
  assert.deepEqual([db.requests[0].status, db.requests[1].status], ['Sent', 'Queued']);
  assert.equal((await runReviewJob({ now: 5 * DAY })).sent, 0); // never twice
  assert.equal((await runReviewJob({ now: 11 * DAY })).reminded, 1);
  assert.match(sent[1].subject, /^Reminder:/);
  assert.equal((await runReviewJob({ now: 12 * DAY })).reminded, 0); // only one reminder
  const r = await runReviewJob({ now: 34 * DAY });
  assert.equal(r.expired, 2);
  assert.deepEqual(db.requests.map(x => x.status), ['Expired', 'Expired']);
  fakeReviewDb({ orders: [order()], items, settings: { ...ON, enabled: false } });
  assert.deepEqual(await runReviewJob({ now: 99 * DAY }), { skipped: true });
});

test('job: a failing mail records last_error and carries on; mail not set up keeps the row queued', async () => {
  const db = fakeReviewDb({ orders: [order(), order({ id: 'ORD-2', customer_email: 'two@example.com' })], items: [...items, { order_id: 'ORD-2', product_id: 1, name: 'T' }], settings: ON });
  await createRequestForOrder('ORD-1', 0); await createRequestForOrder('ORD-2', 0);
  setDeps({ sendMail: async m => { if (m.to === 'rahim@example.com') throw new Error('550 mailbox full'); sent.push(m); return true; } });
  const r = await runReviewJob({ now: 4 * DAY });
  assert.deepEqual([r.sent, r.errors], [1, 1]);
  assert.deepEqual([db.requests[0].status, db.requests[0].last_error], ['Failed', '550 mailbox full']);
  assert.equal(db.requests[1].status, 'Sent');
  db.requests[0].status = 'Queued'; ready = false;
  await runReviewJob({ now: 5 * DAY });
  assert.deepEqual([db.requests[0].status, db.requests[0].last_error], ['Queued', 'Mail is not set up']);
});

test('staff actions: mark-sent (WhatsApp only), resend, cancel, opt-out', async () => {
  const db = fakeReviewDb({ orders: [order(), order({ id: 'ORD-2', customer_email: '' })], items: [...items, { order_id: 'ORD-2', product_id: 1, name: 'T' }], settings: ON });
  await createRequestForOrder('ORD-1', 0); await createRequestForOrder('ORD-2', 0);
  await assert.rejects(markSent(1), /Only WhatsApp/);
  await markSent(2, new Date(5));
  assert.deepEqual([db.requests[1].status, db.requests[1].sent_at.getTime()], ['Sent', 5]);
  await assert.rejects(markSent(2), e => e.status === 409);
  await assert.rejects(resendNow(2), /by hand/);
  await resendNow(1, 0);
  assert.equal(sent.length, 1); assert.equal(db.requests[0].status, 'Sent');
  ready = false; await assert.rejects(resendNow(1, 0), e => e.status === 503); ready = true;
  await cancelRequest(1); assert.equal(db.requests[0].status, 'Cancelled');
  await assert.rejects(cancelRequest(1), e => e.status === 409);
  await assert.rejects(resendNow(1), /already cancelled/);
  await assert.rejects(cancelRequest(77), e => e.status === 404);
  // unsubscribe: both contacts remembered, open requests of the same contact ended
  db.requests.push({ id: 9, order_id: 'ORD-9', email: 'rahim@example.com', phone: '', status: 'Queued', channel: 'email' });
  await optOutRequest({ id: 2, email: '', phone: '01712345678' });
  assert.deepEqual(db.optouts.map(o => o.contact_key), ['8801712345678']);
  await optOutRequest({ id: 9, email: 'Rahim@Example.com', phone: '01712345678' });
  assert.deepEqual(db.optouts.map(o => o.contact_key), ['8801712345678', 'rahim@example.com']);
  assert.equal(db.requests.find(r => r.id === 9).status, 'OptedOut');
});

test('public submit: saves verified Pending reviews with the order link, marks Reviewed; honeypot reject saves nothing', async () => {
  const db = fakeReviewDb({ orders: [order()], items, settings: ON });
  await createRequestForOrder('ORD-1', 0);
  const row = { ...db.requests[0], customer_name: 'Rahim Uddin' };
  const body = { reviews: [{ productId: 1, rating: 5, title: 'Good', body: 'Prints crisp and clean.' }], renderedAt: new Date().toISOString(), website: '' };
  const calls = [];
  const ok = { assess: a => { calls.push(a); return { status: 'Pending', reject: '', reason: '' }; } };
  const settings = { autoApproveVerified: false };
  await assert.rejects(submitReviews({ row, settings, body: { ...body, website: 'http://spam' }, ip: '1.2.3.4', assess: a => ({ status: 'Spam', reject: a.honeypot ? 'Could not send your review.' : '', reason: 'hp' }) }), e => e.status === 400 && /Could not/.test(e.message));
  assert.equal(db.reviews.length, 0);
  assert.equal(db.requests[0].status, 'Queued');
  assert.deepEqual(await submitReviews({ row, settings, body, ip: '1.2.3.4', ...ok }), { saved: 1, status: 'Pending' });
  assert.equal(calls[0].honeypot, ''); assert.equal(calls[0].title, 'Good');
  const rv = db.reviews[0];
  assert.deepEqual([rv.name, rv.verified, rv.user_id, rv.order_id, rv.source, rv.status], ['Rahim U.', 1, 5, 'ORD-1', 'request', 'Pending']);
  assert.match(rv.ip_hash, /^[0-9a-f]{32}$/);
  assert.equal(db.requests[0].status, 'Reviewed');
  await assert.rejects(submitReviews({ row, settings, body, ip: 'x', ...ok }), e => e.status === 409); // one review per product per order
  await assert.rejects(submitReviews({ row, settings, body: { ...body, reviews: [{ ...body.reviews[0], productId: 3 }] }, ip: 'x', ...ok }), /not part of this order/);
  // auto-approve and Spam
  await submitReviews({ row, settings: { autoApproveVerified: true }, body: { ...body, reviews: [{ ...body.reviews[0], productId: 2 }] }, ip: 'x', ...ok });
  assert.equal(db.reviews[1].status, 'Approved');
  db.reviews.length = 0;
  const spam = { assess: () => ({ status: 'Spam', reject: '', reason: 'links' }) };
  assert.equal((await submitReviews({ row, settings: { autoApproveVerified: true }, body, ip: 'x', ...spam })).status, 'Pending');
  assert.deepEqual([db.reviews[0].status, db.reviews[0].spam_reason], ['Spam', 'links']);
});

test('public routes: bad token 404, expired 410, no-store, opened on first view, opt-out', async () => {
  const db = fakeReviewDb({ orders: [order()], items, settings: ON });
  await createRequestForOrder('ORD-1', Date.now() - 4 * DAY);
  db.requests[0].send_at = new Date(Date.now() - DAY); db.requests[0].expires_at = new Date(Date.now() + 20 * DAY);
  const app = express(); app.use(express.json()); mountReviewRequestRoutes(app);
  const srv = http.createServer(app); await new Promise(r => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port + '/api/review-request/';
  try {
    let r = await fetch(base + 'garbage');
    assert.equal(r.status, 404); assert.equal(r.headers.get('cache-control'), 'no-store');
    const tok = signToken(1, db.requests[0].expires_at.getTime());
    r = await fetch(base + tok);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.deepEqual([j.shop, j.firstName, j.orderRef, j.items.length, j.items[0].alreadyReviewed], ['AR Trade International', 'Rahim', 'ORD-1', 2, false]);
    assert.ok(!Number.isNaN(Date.parse(j.renderedAt)));
    assert.equal(db.requests[0].status, 'Opened'); assert.ok(db.requests[0].opened_at);
    const expired = signToken(1, Date.now() - 1000);
    r = await fetch(base + expired); assert.equal(r.status, 410);
    assert.equal((await r.json()).error, 'This link has expired');
    r = await fetch(base + tok + '/optout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.deepEqual(await r.json(), { ok: true });
    assert.equal(db.requests[0].status, 'OptedOut');
    assert.deepEqual(db.optouts.map(o => o.contact_key).sort(), ['8801712345678', 'rahim@example.com']);
    assert.equal((await fetch(base + tok)).status, 410);
  } finally { srv.close(); }
});
