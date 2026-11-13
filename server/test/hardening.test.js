// Run with:  npm test   (no database needed)
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { str, verifyPassword, checkPassword, iso } from '../src/util.js';
import { page } from '../src/adminHelpers.js';
import { pageOf } from '../src/listing.js';

test('str only keeps text and numbers, so hostile JSON never reaches toLowerCase / bcrypt', () => {
  assert.equal(str('a@b.c'), 'a@b.c');
  assert.equal(str(5), '5');
  for (const v of [{ a: 1 }, ['x'], null, undefined, true]) assert.equal(str(v), '');
});

test('verifyPassword never throws and rejects unknown accounts', async () => {
  const hash = await bcrypt.hash('goodpass1', 4);
  assert.equal(await verifyPassword('goodpass1', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
  assert.equal(await verifyPassword({ $ne: 1 }, hash), false);
  assert.equal(await verifyPassword(['goodpass1'], hash), false);
  assert.equal(await verifyPassword('goodpass1', undefined), false); // unknown account
});

test('checkPassword refuses non-strings and absurd lengths', () => {
  assert.throws(() => checkPassword(['goodpass1']));
  assert.throws(() => checkPassword({ toString: () => 'goodpass1' }));
  assert.throws(() => checkPassword('a1' + 'x'.repeat(200)));
  assert.doesNotThrow(() => checkPassword('goodpass1'));
});

test('page numbers are capped so the SQL OFFSET stays a plain integer', () => {
  const huge = { query: { page: '99999999999999999999999', size: '10' } };
  assert.ok(Number.isSafeInteger(page(huge).offset));
  assert.ok(Number.isSafeInteger(pageOf(huge).offset));
  assert.equal(page({ query: {} }).p, 1);
});

test('iso rejects impossible dates (service form, blog date)', () => {
  assert.equal(iso('2026-13-45', null), null);
  assert.equal(iso('2026-02-28', null), '2026-02-28');
  assert.equal(iso({ a: 1 }, null), null);
});
