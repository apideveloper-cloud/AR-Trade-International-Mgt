import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DELIVERY as D, mergeDelivery, validateDelivery, haversineKm, distanceKm, feeForKm, quote, deliveryCharge } from '../src/delivery.js';

const GULSHAN1 = { lat: 23.7806, lng: 90.4163 };

test('haversine: Santinagar to Gulshan 1 is about 4-5 km in a straight line', () => {
  const km = haversineKm(D.office, GULSHAN1);
  assert.ok(km > 4 && km < 5.5, String(km));
  assert.equal(haversineKm(D.office, D.office), 0);
});

test('distanceKm applies the road factor and rounds to 0.1', () => {
  const straight = haversineKm(D.office, GULSHAN1);
  assert.equal(distanceKm(D.office, GULSHAN1, 1), Math.round(straight * 10) / 10);
  assert.equal(distanceKm(D.office, GULSHAN1, 2), Math.round(straight * 20) / 10);
  assert.equal(distanceKm(D.office, GULSHAN1), Math.round(straight * 12.5) / 10);
});

test('feeForKm tier boundaries', () => {
  assert.equal(feeForKm(0, D), 0);
  assert.equal(feeForKm(2, D), 0);          // exactly freeKm is free
  assert.equal(feeForKm(2.1, D), 100);      // just above: first tier
  assert.equal(feeForKm(5, D), 100);        // exactly upToKm stays in the tier
  assert.equal(feeForKm(5.1, D), 150);
  assert.equal(feeForKm(8, D), 150);
  assert.equal(feeForKm(8.1, D), 200);
  assert.equal(feeForKm(12, D), 200);
  assert.equal(feeForKm(12.1, D), 250);
  assert.equal(feeForKm(18, D), 250);
  assert.equal(feeForKm(18.1, D), 350);     // beyond the last tier
  assert.equal(feeForKm(80, D), 350);
  assert.equal(feeForKm(3, undefined), 100); // missing settings use the defaults
});

test('quote returns km, fee, free and within; rejects bad coordinates', () => {
  const q = quote(GULSHAN1, undefined);
  assert.deepEqual(Object.keys(q).sort(), ['fee', 'free', 'km', 'within']);
  assert.equal(q.within, 2);
  assert.equal(q.free, q.fee === 0);
  assert.ok(q.fee > 0);
  assert.equal(quote(D.office, D).free, true);
  assert.equal(quote({ lat: 23.7384, lng: 90.4143 }, { freeKm: 50 }).within, 50);
  for (const bad of [undefined, {}, { lat: 'x', lng: 90 }, { lat: 91, lng: 90 }, { lat: 23, lng: 181 }, { lat: null, lng: null }, { lat: '', lng: '' }]) {
    assert.throws(() => quote(bad, D), e => e.status === 400, JSON.stringify(bad));
  }
  const far = quote({ lat: 22.3569, lng: 91.7832 }, D); // Chattogram
  assert.equal(far.fee, 350);
});

test('mergeDelivery fills in missing and partial settings', () => {
  assert.deepEqual(mergeDelivery(undefined), D);
  assert.deepEqual(mergeDelivery({}), D);
  const m = mergeDelivery({ freeKm: 3, office: { lat: 24 }, maxFee: 'oops', tiers: [{ upToKm: 9, fee: 120 }, { upToKm: 5, fee: 100 }] });
  assert.equal(m.freeKm, 3);
  assert.equal(m.office.lat, 24);
  assert.equal(m.office.lng, D.office.lng);
  assert.equal(m.maxFee, 350);
  assert.deepEqual(m.tiers, [{ upToKm: 5, fee: 100 }, { upToKm: 9, fee: 120 }]);
  assert.equal(m.partners.length, D.partners.length);
  assert.deepEqual(m.partners.map(p => p.id), ['redx', 'sa-paribahan', 'steadfast', 'sundarban']);
  assert.notEqual(mergeDelivery(undefined).tiers, D.tiers); // a copy, never the shared default
});

test('validateDelivery accepts a good object and rejects bad ones', () => {
  const ok = validateDelivery({ freeKm: 1, tiers: [{ upToKm: 3, fee: 80 }, { upToKm: 6, fee: 80 }], maxFee: 200, partners: [{ id: 'a', name: 'A' }] });
  assert.equal(ok.freeKm, 1);
  assert.equal(ok.roadFactor, 1.25);
  assert.equal(ok.partners.length, 1);
  const bad = o => assert.throws(() => validateDelivery(o), e => e.status === 400, JSON.stringify(o));
  bad(null);
  bad({ tiers: [{ upToKm: 7, fee: 150 }, { upToKm: 4, fee: 100 }] });   // unsorted
  bad({ tiers: [{ upToKm: 4, fee: 150 }, { upToKm: 7, fee: 100 }] });   // fee goes down
  bad({ tiers: [{ upToKm: 4, fee: -1 }] });
  bad({ freeKm: -1 });
  bad({ freeKm: 'abc' });
  bad({ office: { lat: 91, lng: 90 } });
  bad({ office: { lat: 23, lng: -181 } });
  bad({ maxFee: 10 });                                                   // below the last tier fee
  bad({ partners: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] });
  bad({ partners: [{ id: 'a', name: 'x'.repeat(61) }] });
  bad({ partners: Array.from({ length: 13 }, (_, i) => ({ id: 'p' + i, name: 'P' })) });
});

test('free-over: zero or missing disables it; it only applies inside Dhaka', () => {
  assert.equal(deliveryCharge({ subtotal: 1000, zone: 'inside', base: 100, freeOver: 0 }).delivery, 100);
  assert.equal(deliveryCharge({ subtotal: 1000, zone: 'inside', base: 100, freeOver: undefined }).freeElig, false);
  assert.equal(deliveryCharge({ subtotal: 1000, zone: 'inside', base: 100, freeOver: -5 }).delivery, 100);
  assert.equal(deliveryCharge({ subtotal: 5000, zone: 'inside', base: 100, freeOver: 5000 }).delivery, 0);
  assert.equal(deliveryCharge({ subtotal: 4999, zone: 'inside', base: 100, freeOver: 5000 }).delivery, 100);
  assert.equal(deliveryCharge({ subtotal: 9000, zone: 'outside', base: 150, freeOver: 5000 }).delivery, 150);
  assert.equal(deliveryCharge({ subtotal: 6000, zone: 'inside', base: 100, freeOver: 5000, express: 150 }).delivery, 150); // express is still charged
  assert.equal(deliveryCharge({ subtotal: 0, zone: 'inside', base: 100, freeOver: 0 }).delivery, 0);
});

test('review fixes: far points are refused, a partner is required, fees are whole taka', () => {
  assert.throws(() => quote({ lat: 0, lng: 0 }, undefined), /too far/);
  assert.throws(() => quote({ lat: -33.9, lng: 151.2 }, undefined), /too far/);
  assert.equal(quote({ lat: 23.80, lng: 90.41 }, undefined).km > 0, true); // an ordinary Dhaka point still works
  assert.throws(() => validateDelivery({ partners: [] }), /at least one shipping partner/);
  const v = validateDelivery({ tiers: [{ upToKm: 4, fee: 99.6 }], maxFee: 349.5, partners: [{ id: 'a', name: 'A' }] });
  assert.equal(v.tiers[0].fee, 100);
  assert.equal(v.maxFee, 350);
});
