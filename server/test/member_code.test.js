import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMemberCode, isMemberCode } from '../src/memberCode.js';

test('member ID is SR + year + a 5-digit number', () => {
  assert.equal(formatMemberCode(2026, 1), 'SR2026-00001');
  assert.equal(formatMemberCode(2026, 42), 'SR2026-00042');
  assert.equal(formatMemberCode(2027, 12345), 'SR2027-12345');
});

test('a number past 99999 keeps all its digits', () => {
  assert.equal(formatMemberCode(2026, 123456), 'SR2026-123456');
});

test('isMemberCode accepts only that shape', () => {
  assert.ok(isMemberCode('SR2026-00001'));
  assert.ok(!isMemberCode('SR26-00001'));
  assert.ok(!isMemberCode('AR-21339'));
  assert.ok(!isMemberCode(''));
  assert.ok(!isMemberCode(null));
});
