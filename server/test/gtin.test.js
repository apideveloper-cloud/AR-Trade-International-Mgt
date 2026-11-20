import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGtin, gtinValid } from '../src/gtin.js';

test('normalizeGtin strips spaces and hyphens and checks the length', () => {
  assert.equal(normalizeGtin('8715946544298'), '8715946544298');
  assert.equal(normalizeGtin(' 8715-9465 44298 '), '8715946544298');
  assert.equal(normalizeGtin('96385074'), '96385074');
  assert.equal(normalizeGtin('036000291452'), '036000291452');
  assert.equal(normalizeGtin('10012345678902'), '10012345678902');
  assert.equal(normalizeGtin('123456789'), null);
  assert.equal(normalizeGtin('87159465442ab'), null);
  assert.equal(normalizeGtin(''), null);
  assert.equal(normalizeGtin(null), null);
});

test('gtinValid verifies the GS1 check digit', () => {
  assert.equal(gtinValid('8715946544298'), true);
  assert.equal(gtinValid('8715946715308'), true);
  assert.equal(gtinValid('871594654429-8'), true);
  assert.equal(gtinValid('96385074'), true);
  assert.equal(gtinValid('036000291452'), true);
  assert.equal(gtinValid('10012345678902'), true);
  assert.equal(gtinValid('8715946544299'), false);
  assert.equal(gtinValid('8715946715300'), false);
  assert.equal(gtinValid('12345'), false);
});
