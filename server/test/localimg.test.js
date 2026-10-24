import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalImg, localImg } from '../src/util.js';

test('only our own uploaded pictures are accepted as image paths', () => {
  for (const ok of ['/api/uploads/products/toner/hp-12a-abc1.jpg', '/api/uploads/site/canon.png', '/api/media/old-post.webp']) assert.equal(isLocalImg(ok), true, ok);
  for (const bad of ['https://example.com/a.jpg', 'http://x/y.png', '//cdn.example.com/a.png', 'data:image/png;base64,AAAA', '/api/uploads/../../.env', '/api/uploads/a//b.png', "/api/uploads/x');background:url(//evil", '/etc/passwd', 'javascript:alert(1)', '/api/uploads/', '']) assert.equal(isLocalImg(bad), false, bad);
});

test('localImg returns an empty string for "no picture" and refuses anything else', () => {
  assert.equal(localImg(''), '');
  assert.equal(localImg(null), '');
  assert.equal(localImg('  /api/uploads/site/a.png '), '/api/uploads/site/a.png');
  assert.throws(() => localImg('https://example.com/a.jpg'), e => e.status === 400);
  assert.throws(() => localImg('data:image/png;base64,AAAA'), e => e.status === 400);
});
