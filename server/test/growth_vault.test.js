import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, resetKeyCache } from '../src/growth/vault.js';

const withKey = (k, fn) => { const old = process.env.SECRETS_KEY; process.env.SECRETS_KEY = k; resetKeyCache(); try { return fn(); } finally { if (old === undefined) delete process.env.SECRETS_KEY; else process.env.SECRETS_KEY = old; resetKeyCache(); } };

test('encrypt then decrypt returns the original, including unicode', () => withKey('k1', () => {
  for (const s of ['abc', 'GOCSPX-1234567890_abcdef', 'বাংলা ✓']) assert.equal(decrypt(encrypt(s)), s);
}));
test('the blob does not contain the plain text and differs each time', () => withKey('k1', () => {
  const a = encrypt('super-secret-value'), b = encrypt('super-secret-value');
  assert.ok(!a.includes('super-secret-value') && !Buffer.from(a.split('.')[3], 'base64').toString('utf8').includes('super'));
  assert.notEqual(a, b);
  assert.ok(a.startsWith('v1.'));
}));
test('a changed blob fails to decrypt', () => withKey('k1', () => {
  const [v, iv, tag, enc] = encrypt('hello world').split('.');
  const bytes = Buffer.from(enc, 'base64'); bytes[0] ^= 1;
  assert.throws(() => decrypt([v, iv, tag, bytes.toString('base64')].join('.')));
  const t = Buffer.from(tag, 'base64'); t[0] ^= 1;
  assert.throws(() => decrypt([v, iv, t.toString('base64'), enc].join('.')));
  assert.throws(() => decrypt('garbage'));
  assert.throws(() => decrypt(''));
}));
test('a different master key cannot read it', () => {
  const blob = withKey('key-one', () => encrypt('hello'));
  assert.throws(() => withKey('key-two', () => decrypt(blob)));
  assert.equal(withKey('key-one', () => decrypt(blob)), 'hello');
});
