import test from 'node:test';
import assert from 'node:assert/strict';
import { distKm, pathKm, roleKey, clientRefOf, mysqlDate } from '../src/field/common.js';

test('distKm: Santinagar to Motijheel is about 1.5 km, same point is 0', () => {
  const a = { lat: 23.7465, lng: 90.4124 }, b = { lat: 23.7330, lng: 90.4172 };
  assert.equal(distKm(a, a), 0);
  const d = distKm(a, b);
  assert.ok(d > 1.3 && d < 1.8, String(d));
  assert.ok(Math.abs(distKm(a, b) - distKm(b, a)) < 1e-9);
});

test('distKm accepts numeric strings (DECIMAL columns) and pathKm sums legs, rounded to 0.1', () => {
  const pts = [{ lat: '23.0', lng: '90.0' }, { lat: '23.0', lng: '90.0' }];
  assert.equal(pathKm(pts), 0);
  assert.equal(pathKm([]), 0);
  assert.equal(pathKm([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }]), 111.2);
});

test('roleKey maps web roles to app roles and defaults to field', () => {
  assert.equal(roleKey('Master Admin'), 'admin');
  assert.equal(roleKey('Purchase Officer'), 'purchase');
  assert.equal(roleKey('Something else'), 'field');
});

test('clientRefOf trims, caps at 64 and ignores non-strings', () => {
  assert.equal(clientRefOf({ clientRef: '  abc ' }), 'abc');
  assert.equal(clientRefOf({ clientRef: 'x'.repeat(100) }).length, 64);
  assert.equal(clientRefOf({ clientRef: 5 }), null);
  assert.equal(clientRefOf(null), null);
});

test('mysqlDate formats UTC and rejects garbage', () => {
  assert.equal(mysqlDate('2026-11-14T00:00:00Z'), '2026-11-14 00:00:00');
  assert.throws(() => mysqlDate('nope'));
});
