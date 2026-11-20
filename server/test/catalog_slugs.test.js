import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSlug } from '../src/productSlugs.js';

test('part-number slug never exceeds the 120 character column', async () => {
  const name = 'word '.repeat(40), part = 'x'.repeat(40);
  const seen = new Set();
  const taken = async s => { seen.add(s); return s.length < 121 && !s.includes('-' + part) ? true : false; };
  const s = await pickSlug(taken, { id: 1, name, part });
  assert.ok(s.length <= 120, s.length + '');
});

test('product edit: a blank name or category is refused, a partial update only touches what was sent', async () => {
  const { productPatch } = await import('../src/admin/catalog.js');
  assert.throws(() => productPatch({ name: '   ' }), /Name cannot be empty/);
  assert.throws(() => productPatch({ cat: '' }), /Category cannot be empty/);
  const { sets } = productPatch({ stock: '7' });
  assert.deepEqual(sets, ['stock = ?', 'edited = 1']);
});
