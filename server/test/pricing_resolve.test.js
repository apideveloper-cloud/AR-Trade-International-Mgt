import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DELIVERY as D, mergeDelivery, zoneOf, baseFee, resolveDelivery, deliveryCharge } from '../src/delivery.js';

const S = { insideFee: 60, suburbFee: 120, outsideFee: 150, freeOver: 5000, expressFee: 100 };
const dl = mergeDelivery(null);
const FAR = { lat: 23.8103, lng: 90.4125 }; // Gulshan/Banani, beyond the free distance

test('zoneOf: district decides, else the old area', () => {
  assert.equal(zoneOf({ district: ' Dhaka ' }), 'inside');
  assert.equal(zoneOf({ district: 'Sylhet' }), 'outside');
  assert.equal(zoneOf({ area: 'suburb' }), 'suburb');
  assert.equal(zoneOf({ area: 'bogus' }), 'inside');
  assert.equal(zoneOf({ district: '', area: 'outside' }), 'outside');
});

test('baseFee picks the zone fee', () => {
  assert.equal(baseFee('inside', S), 60);
  assert.equal(baseFee('suburb', S), 120);
  assert.equal(baseFee('outside', S), 150);
});

test('map-priced fee is charged even over the free-over threshold', () => {
  const r = resolveDelivery({ district: 'Dhaka', dest: FAR, staff: false }, S, dl);
  assert.equal(r.byDistance, true);
  assert.ok(r.base > 0);
  const c = deliveryCharge({ subtotal: 999999, zone: r.zone, base: r.base, freeOver: r.byDistance ? 0 : S.freeOver });
  assert.equal(c.delivery, r.base);
  assert.equal(c.freeElig, false);
});

test('outside Dhaka needs a valid shipping partner', () => {
  assert.throws(() => resolveDelivery({ district: 'Sylhet' }, S, dl), /partner/i);
  assert.throws(() => resolveDelivery({ district: 'Sylhet', partner: 'nope' }, S, dl), /partner/i);
  const r = resolveDelivery({ district: 'Sylhet', partner: D.partners[0].id }, S, dl);
  assert.equal(r.base, 150);
  assert.equal(r.shipPartner, D.partners[0].name);
  assert.equal(r.zone, 'outside');
});

test('Dhaka needs a map pin', () => {
  assert.throws(() => resolveDelivery({ district: 'Dhaka' }, S, dl), /map/i);
});

test('legacy flat-fee branch only for staff', () => {
  const r = resolveDelivery({ area: 'suburb', staff: true }, S, dl);
  assert.equal(r.base, 120);
  assert.equal(r.byDistance, false);
  assert.equal(r.pending, false);
});

test('customer order without district is rejected', () => {
  assert.throws(() => resolveDelivery({ area: 'inside' }, S, dl), /Please select your district/);
  assert.throws(() => resolveDelivery({ district: '  ', area: 'inside', staff: false }, S, dl), /Please select your district/);
});

test('cart preview without district: no delivery charge, flagged byDistance', () => {
  const r = resolveDelivery({ preview: true }, S, dl);
  assert.equal(r.pending, true);
  assert.equal(r.byDistance, true);
  assert.equal(r.base, 0);
});
