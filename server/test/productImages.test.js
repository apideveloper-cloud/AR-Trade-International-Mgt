import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasPicture, published } from '../src/productImages.js';

const UP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');

test('a product is published only when its picture can be found', () => {
  assert.equal(hasPicture(''), false);
  assert.equal(hasPicture(null), false);
  assert.equal(hasPicture('/api/uploads/products/printer/does-not-exist-xyz.jpg'), false);
  assert.equal(hasPicture('/api/uploads/../.env'), false);
  assert.equal(hasPicture('https://example.com/a.jpg'), true);
  fs.mkdirSync(path.join(UP, 'products'), { recursive: true });
  const f = path.join(UP, 'products', '__test_pic.png');
  fs.writeFileSync(f, 'x');
  try {
    assert.equal(hasPicture('/api/uploads/products/__test_pic.png'), true);
    assert.deepEqual(published([{ id: 1, img: '/api/uploads/products/__test_pic.png' }, { id: 2, img: '' }]).map(r => r.id), [1]);
  } finally { fs.rmSync(f, { force: true }); }
});
