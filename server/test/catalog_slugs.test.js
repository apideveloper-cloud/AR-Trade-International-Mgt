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
