import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReview, makeIpLimiter, hashIp, normalizeBody, isDuplicateBody } from '../src/growth/reviewSpam.js';

const NOW = 1_700_000_000_000;
const a = o => assessReview({ title: 'Good', body: 'Works well, fast delivery and good quality.', now: NOW, ...o });

test('clean review is Pending', () => assert.deepEqual(a({}), { status: 'Pending', reject: '', reason: '' }));
test('honeypot rejects', () => { const r = a({ honeypot: 'http://x' }); assert.equal(r.reject, 'Could not save your review.'); });
test('renderedAt boundary 3 s', () => {
  assert.match(a({ renderedAt: NOW - 2999 }).reject, /take a moment/);
  assert.equal(a({ renderedAt: NOW - 3000 }).reject, '');
  assert.equal(a({ renderedAt: undefined }).reject, '');
  assert.equal(a({ renderedAt: 'garbage' }).reject, '');
});
test('links and e-mail', () => {
  for (const b of ['visit http://spam.io now please', 'go to www.example now please', 'mail me bob@x.com for deals', 'see cheap-toner.com today ok'])
    assert.equal(a({ body: b }).reason, 'link', b);
  assert.equal(a({ title: 'https://x.y' }).status, 'Spam');
});
test('repeat', () => {
  assert.equal(a({ body: 'greaaaaaaaaaat product' }).reason, 'repeat');
  assert.equal(a({ body: 'abababababab ababab' }).reason, 'repeat');
  assert.equal(a({ body: 'sooooo good, fast delivery' }).status, 'Pending'); // 5 repeats is allowed
});
test('caps', () => {
  assert.equal(a({ body: 'THIS PRINTER IS ABSOLUTELY THE BEST EVER BUY NOW' }).reason, 'caps');
  assert.equal(a({ body: 'GOOD PRINTER' }).status, 'Pending');
});
test('keywords', () => {
  for (const k of ['Best SEO service', 'online CASINO win', 'quick loan offer', 'crypto gains', 'Viagra cheap', 'Click Here now', 'WhatsApp me please'])
    assert.equal(a({ body: 'Hello ' + k }).reason, 'keyword', k);
  assert.equal(a({ body: 'Seoul shipping was quick' }).status, 'Pending');
});
test('Bangla never flagged by caps or repeat', () => {
  const bn = 'পণ্যটি অসাধারণ, দ্রুত ডেলিভারি পেয়েছি এবং মান খুবই ভালো। ধন্যবাদ সবাইকে।';
  assert.equal(a({ body: bn, title: 'ভালো' }).status, 'Pending');
  assert.equal(a({ body: 'ভালো ভালো ভালো ভালো ভালো ভালো' }).status, 'Pending');
});
test('limiter window', () => {
  let t = 0; const l = makeIpLimiter({ max: 2, windowMs: 1000, now: () => t });
  assert.equal(l.over('a'), false); assert.equal(l.over('a'), false); assert.equal(l.over('a'), true);
  assert.equal(l.over('b'), false);
  t = 5000; assert.equal(l.over('a'), false);
});
test('hashIp and duplicates', () => {
  assert.equal(hashIp('1.2.3.4'), hashIp('1.2.3.4')); assert.notEqual(hashIp('1.2.3.4'), hashIp('1.2.3.5'));
  assert.equal(normalizeBody('  Great!!  Product. '), 'great product');
  assert.ok(isDuplicateBody('Great product, buy it!', 'great PRODUCT buy it')); assert.ok(!isDuplicateBody('short', 'short'));
});
