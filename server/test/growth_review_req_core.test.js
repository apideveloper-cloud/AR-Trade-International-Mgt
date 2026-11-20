import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseChannel, defaultSettings, displayName, dueExpiry, dueReminders, dueToSend, emailKey, fill, mergeSettings, phoneKey, pickLanguage, planDates,
  realEmail, renderMessage, signToken, validateSettings, verifyToken, waUrl, productsText
} from '../src/growth/reviewRequestsCore.js';
import { buildMail } from '../src/growth/reviewRequestsMail.js';
import { cleanReviews } from '../src/growth/reviewRequestsSubmit.js';

const KEY = 'unit-test-key';
const DAY = 864e5;

test('token: sign, verify, expiry, tamper', () => {
  const now = Date.now(), tok = signToken(42, now + DAY, KEY);
  assert.deepEqual({ ...verifyToken(tok, now, KEY), exp: 0 }, { rid: 42, exp: 0, expired: false });
  assert.equal(verifyToken(tok, now + 2 * DAY, KEY).expired, true);
  assert.equal(verifyToken(tok, now, 'other-key'), null);
  const [p, sig] = tok.split('.');
  const forged = Buffer.from(JSON.stringify({ rid: 43, exp: Math.floor((now + DAY) / 1000) })).toString('base64url');
  assert.equal(verifyToken(forged + '.' + sig, now, KEY), null);
  assert.equal(verifyToken(p + '.' + sig.slice(0, -2) + 'xx', now, KEY), null);
  for (const bad of ['', 'abc', 'a.b.c', null, undefined, p]) assert.equal(verifyToken(bad, now, KEY), null);
});

test('real e-mail versus placeholder, and channel choice', () => {
  assert.equal(realEmail('rahim@example.com'), true);
  assert.equal(realEmail('01712345678@noemail.invalid'), false);
  assert.equal(realEmail(''), false);
  assert.equal(realEmail('not an email'), false);
  assert.equal(chooseChannel({ email: 'a@b.com', phone: '01712345678', mailOk: true }), 'email');
  assert.equal(chooseChannel({ email: 'a@b.com', phone: '01712345678', mailOk: false }), 'whatsapp');
  assert.equal(chooseChannel({ email: '01712345678@noemail.invalid', phone: '01712345678', mailOk: true }), 'whatsapp');
  assert.equal(chooseChannel({ email: '', phone: 'abc', mailOk: true }), '');
  assert.equal(chooseChannel({ email: 'a@b.com', phone: '', mailOk: false }), '');
});

test('contact keys and wa.me link for Bangladesh numbers', () => {
  assert.equal(emailKey(' Rahim@Example.COM '), 'rahim@example.com');
  assert.equal(emailKey('x@y.invalid'), '');
  assert.equal(phoneKey('01712-345678'), '8801712345678');
  assert.equal(phoneKey('+880 1712 345678'), '8801712345678');
  assert.equal(phoneKey('8801712345678'), '8801712345678');
  assert.equal(phoneKey('12'), '');
  assert.equal(waUrl('01712345678', 'Hi there & thanks'), 'https://wa.me/8801712345678?text=Hi%20there%20%26%20thanks');
  assert.equal(waUrl('nope', 'x'), '');
});

test('due selection: send, reminder, expire', () => {
  const now = Date.parse('2026-11-20T10:00:00Z'), ago = d => new Date(now - d * DAY), ahead = d => new Date(now + d * DAY);
  const s = { ...defaultSettings(), reminder: true, reminderDays: 7 };
  const rows = [
    { id: 1, channel: 'email', status: 'Queued', send_at: ago(1), expires_at: ahead(5) },
    { id: 2, channel: 'email', status: 'Queued', send_at: ahead(1), expires_at: ahead(9) },
    { id: 3, channel: 'whatsapp', status: 'Queued', send_at: ago(1), expires_at: ahead(5) },
    { id: 4, channel: 'email', status: 'Queued', send_at: ago(40), expires_at: ago(10) },
    { id: 5, channel: 'email', status: 'Sent', sent_at: ago(8), reminder_at: null, expires_at: ahead(5) },
    { id: 6, channel: 'email', status: 'Opened', sent_at: ago(8), reminder_at: ago(1), expires_at: ahead(5) },
    { id: 7, channel: 'email', status: 'Sent', sent_at: ago(3), reminder_at: null, expires_at: ahead(5) },
    { id: 8, channel: 'email', status: 'Reviewed', sent_at: ago(9), reminder_at: null, expires_at: ahead(5) },
    { id: 9, channel: 'email', status: 'Sent', sent_at: ago(40), reminder_at: null, expires_at: ago(1) }
  ];
  assert.deepEqual(dueToSend(rows, now).map(r => r.id), [1]);
  assert.deepEqual(dueReminders(rows, s, now).map(r => r.id), [5]);
  assert.deepEqual(dueReminders(rows, { ...s, reminder: false }, now), []);
  assert.deepEqual(dueExpiry(rows, now).map(r => r.id), [4, 9]);
  const d = planDates({ delayDays: 3, expireDays: 30 }, now);
  assert.equal(d.sendAt.getTime(), now + 3 * DAY);
  assert.equal(d.expiresAt.getTime(), now + 33 * DAY);
});

test('defaults: off, plain friendly text in English and Bangla with all placeholders', () => {
  const s = defaultSettings();
  assert.equal(s.enabled, false);
  assert.deepEqual([s.delayDays, s.reminder, s.reminderDays, s.expireDays, s.language], [3, true, 7, 30, 'auto']);
  for (const l of ['en', 'bn']) for (const ph of ['{name}', '{shop}', '{products}', '{link}', '{optout}']) assert.ok(s.templates[l].body.includes(ph), l + ph);
  assert.match(s.templates.bn.body, /[ঀ-৿]{3,}/);
  assert.equal(validateSettings({}, s).ok, true);
  assert.deepEqual(mergeSettings({ enabled: true, templates: { en: { subject: 'S' } } }).templates.en, { subject: 'S', body: s.templates.en.body });
});

test('settings validation', () => {
  const ok = x => validateSettings(x, defaultSettings());
  assert.equal(ok({ delayDays: 0 }).ok, true);
  assert.equal(ok({ delayDays: 61 }).ok, false);
  assert.equal(ok({ delayDays: 1.5 }).ok, false);
  assert.equal(ok({ reminderDays: 0 }).ok, false);
  assert.equal(ok({ expireDays: 6 }).ok, false);
  assert.equal(ok({ expireDays: 181 }).ok, false);
  assert.equal(ok({ reminderDays: 40 }).ok, false); // after the default 30-day expiry
  assert.equal(ok({ language: 'fr' }).ok, false);
  assert.equal(ok({ enabled: 'yes' }).ok, false);
  assert.equal(ok({ templates: { en: { subject: 'x'.repeat(151) } } }).ok, false);
  assert.equal(ok({ templates: { en: { body: 'x'.repeat(2001) + '{link}' } } }).ok, false);
  assert.match(ok({ templates: { bn: { body: 'no link here' } } }).error, /\{link\}/);
  const good = ok({ enabled: true, templates: { en: { subject: 'Hi', body: 'Go {link}' } } });
  assert.equal(good.ok, true);
  assert.equal(good.settings.templates.en.body, 'Go {link}');
  assert.equal(good.settings.templates.bn.subject, defaultSettings().templates.bn.subject); // untouched language is kept
});

test('placeholders are filled; names are escaped in the html but not mangled in the text', () => {
  assert.equal(fill('Hi {name} {unknown}', { name: 'Ana' }), 'Hi Ana {unknown}');
  const s = defaultSettings(), v = { name: '<b>Evil</b> "Bob"', products: 'A & B', link: 'https://shop.test/review/tok', optout: 'https://shop.test/review/tok?optout=1' };
  const m = buildMail(s, v, { lang: 'en' });
  assert.ok(!m.html.includes('<b>Evil'));
  assert.match(m.html, /&lt;b&gt;Evil&lt;\/b&gt;/);
  assert.match(m.html, /A &amp; B/);
  assert.match(m.html, /href="https:\/\/shop\.test\/review\/tok"/);
  assert.match(m.html, /href="https:\/\/shop\.test\/review\/tok\?optout=1"/);
  assert.match(m.html, /Do not send me review requests/);
  assert.ok(!m.html.includes('subscribed to'));
  assert.match(m.text, /review\/tok\b/);
  const bn = buildMail(s, { ...v, name: 'রহিম উদ্দিন' }, { reminder: true });
  assert.equal(bn.lang, 'bn');
  assert.match(bn.subject, /^অনুস্মারক: রহিম/);
  assert.match(bn.html, /রিভিউ লিখুন/);
  assert.equal(renderMessage(s, 'en', { name: 'Ana', shop: 'S', products: 'P', link: 'L', optout: 'O' }).subject.includes('{'), false);
});

test('language choice and small text helpers', () => {
  assert.equal(pickLanguage('auto', 'Rahim Uddin'), 'en');
  assert.equal(pickLanguage('auto', 'রহিম উদ্দিন'), 'bn');
  assert.equal(pickLanguage('auto', ''), 'en');
  assert.equal(pickLanguage('bn', 'Rahim'), 'bn');
  assert.equal(displayName('rahim uddin khan'), 'rahim K.');
  assert.equal(displayName('Karim'), 'Karim');
  assert.equal(displayName(''), 'Customer');
  assert.equal(productsText(['A', 'B', 'C', 'D', 'A']), 'A, B, C +1');
});

test('posted reviews: rules, product must be in the order, no duplicates', () => {
  const order = new Set([1, 2]), rev = (o = {}) => ({ productId: 1, rating: 5, title: 'Great', body: 'Works very well for us.', ...o });
  assert.equal(cleanReviews([rev()], order).length, 1);
  assert.throws(() => cleanReviews([rev({ productId: 99 })], order), /not part of this order/);
  assert.throws(() => cleanReviews([rev(), rev()], order), /one review per product/i);
  assert.throws(() => cleanReviews([rev()], order, new Set([1])), e => e.status === 409);
  assert.throws(() => cleanReviews([rev({ rating: 0 })], order), /star rating/);
  assert.throws(() => cleanReviews([rev({ rating: 6 })], order), /star rating/);
  assert.throws(() => cleanReviews([rev({ body: 'short' })], order), /10 characters/);
  assert.throws(() => cleanReviews([rev({ body: 'x'.repeat(1501) })], order), /1500/);
  assert.throws(() => cleanReviews([rev({ title: 'x'.repeat(121) })], order), /120/);
  assert.throws(() => cleanReviews([], order), /at least one/);
  assert.throws(() => cleanReviews(Array.from({ length: 11 }, (_, i) => rev({ productId: i + 1 })), new Set(Array.from({ length: 11 }, (_, i) => i + 1))), /10/);
  assert.equal(cleanReviews([rev({ rating: '4' })], order)[0].rating, 4);
});
