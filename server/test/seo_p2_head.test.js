import test from 'node:test';
import assert from 'node:assert/strict';
import { headFields } from '../src/seo.js';

test('headFields: defaults match what inject writes', () => {
  const h = headFields('https://s.bd', { path: '/x', title: 'T', desc: 'D', image: '/i.jpg' });
  assert.equal(h.canonical, 'https://s.bd/x');
  assert.equal(h.robots, 'index, follow, max-image-preview:large');
  assert.deepEqual(h.og, { title: 'T', description: 'D', image: 'https://s.bd/i.jpg' });
  assert.deepEqual(h.twitter, { title: 'T', description: 'D' });
});
test('headFields: noindex without canonical has none; manual og/twitter win', () => {
  const h = headFields('https://s.bd', { path: '/x', title: 'T', desc: 'D', noindex: true, ogTitle: 'O', twDesc: 'W', ogImage: 'https://c/i.png' });
  assert.equal(h.canonical, '');
  assert.equal(h.robots, 'noindex, nofollow');
  assert.equal(h.og.title, 'O'); assert.equal(h.twitter.title, 'O'); assert.equal(h.twitter.description, 'W'); assert.equal(h.og.image, 'https://c/i.png');
});
