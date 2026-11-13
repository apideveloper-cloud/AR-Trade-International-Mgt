// Distance-based delivery charges: pure logic (no database). Defaults are merged at read time, so stored settings never need a `delivery` key.
import { fail } from './util.js';

export const DEFAULT_DELIVERY = {
  office: { lat: 23.739316, lng: 90.415567, label: '159 Santinagar, Dhaka-1217' },
  freeKm: 2,
  roadFactor: 1.25,
  tiers: [{ upToKm: 5, fee: 100 }, { upToKm: 8, fee: 150 }, { upToKm: 12, fee: 200 }, { upToKm: 18, fee: 250 }],
  maxFee: 350,
  partners: [
    { id: 'redx', name: 'RedX' }, { id: 'sa-paribahan', name: 'SA Paribahan' },
    { id: 'steadfast', name: 'Steadfast Courier' }, { id: 'sundarban', name: 'Sundarban Courier' }
  ]
};

const fin = v => typeof v === 'number' ? Number.isFinite(v) : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
const clone = o => JSON.parse(JSON.stringify(o));

/** Defaults filled in for anything missing or unusable. Never throws. */
export function mergeDelivery(raw) {
  const d = clone(DEFAULT_DELIVERY);
  if (!raw || typeof raw !== 'object') return d;
  const o = raw.office;
  if (o && typeof o === 'object') {
    if (fin(o.lat) && Math.abs(Number(o.lat)) <= 90) d.office.lat = Number(o.lat);
    if (fin(o.lng) && Math.abs(Number(o.lng)) <= 180) d.office.lng = Number(o.lng);
    if (typeof o.label === 'string' && o.label.trim()) d.office.label = o.label.trim().slice(0, 160);
  }
  if (fin(raw.freeKm) && Number(raw.freeKm) >= 0) d.freeKm = Number(raw.freeKm);
  if (fin(raw.roadFactor) && Number(raw.roadFactor) > 0) d.roadFactor = Number(raw.roadFactor);
  if (fin(raw.maxFee) && Number(raw.maxFee) >= 0) d.maxFee = Number(raw.maxFee);
  if (Array.isArray(raw.tiers)) {
    const t = raw.tiers.filter(x => x && fin(x.upToKm) && fin(x.fee)).map(x => ({ upToKm: Number(x.upToKm), fee: Number(x.fee) })).sort((a, b) => a.upToKm - b.upToKm);
    if (t.length || raw.tiers.length === 0) d.tiers = t;
  }
  if (Array.isArray(raw.partners)) {
    d.partners = raw.partners.filter(p => p && typeof p.id === 'string' && p.id && typeof p.name === 'string' && p.name.trim()).map(p => ({ id: p.id, name: p.name.trim() }));
  }
  return d;
}

/** Checks a `delivery` object being saved and returns the cleaned, complete object. Throws fail(400, message). Missing keys take the defaults. */
export function validateDelivery(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail(400, 'Delivery settings must be an object');
  const d = clone(DEFAULT_DELIVERY);
  const num = (v, name, min = 0) => {
    if (!fin(v) || Number(v) < min) throw fail(400, `${name} must be a number of ${min} or more`);
    return Number(v);
  };
  if ('office' in raw) {
    const o = raw.office;
    if (!o || typeof o !== 'object') throw fail(400, 'Office location is invalid');
    const lat = num(o.lat, 'Office latitude', -90), lng = num(o.lng, 'Office longitude', -180);
    if (lat > 90 || lat < -90) throw fail(400, 'Office latitude must be between -90 and 90');
    if (lng > 180 || lng < -180) throw fail(400, 'Office longitude must be between -180 and 180');
    d.office = { lat, lng, label: String(o.label ?? '').trim().slice(0, 160) || DEFAULT_DELIVERY.office.label };
  }
  if ('freeKm' in raw) d.freeKm = num(raw.freeKm, 'Free distance');
  if ('roadFactor' in raw) { d.roadFactor = num(raw.roadFactor, 'Road factor'); if (d.roadFactor <= 0) throw fail(400, 'Road factor must be above 0'); }
  if ('maxFee' in raw) d.maxFee = Math.round(num(raw.maxFee, 'Maximum fee')); // whole taka
  if ('tiers' in raw) {
    if (!Array.isArray(raw.tiers) || raw.tiers.length > 20) throw fail(400, 'Delivery tiers must be a list of up to 20 rows');
    let prevKm = -Infinity, prevFee = -Infinity;
    d.tiers = raw.tiers.map((t, i) => {
      const upToKm = num(t?.upToKm, `Tier ${i + 1} distance`), fee = Math.round(num(t?.fee, `Tier ${i + 1} fee`)); // whole taka
      if (upToKm <= prevKm) throw fail(400, 'Delivery tiers must be sorted by distance, smallest first, with no repeats');
      if (fee < prevFee) throw fail(400, 'Delivery fees must not go down as the distance grows');
      prevKm = upToKm; prevFee = fee;
      return { upToKm, fee };
    });
  }
  if (d.tiers.length && d.tiers[0].upToKm <= d.freeKm) throw fail(400, 'The first tier must reach beyond the free distance');
  if (d.tiers.length && d.maxFee < d.tiers[d.tiers.length - 1].fee) throw fail(400, 'The maximum fee must not be below the last tier fee');
  if ('partners' in raw) {
    if (!Array.isArray(raw.partners) || raw.partners.length > 12) throw fail(400, 'Shipping partners: up to 12 entries');
    if (!raw.partners.length) throw fail(400, 'Keep at least one shipping partner, otherwise orders outside Dhaka cannot be placed');
    const seen = new Set();
    d.partners = raw.partners.map(p => {
      const id = String(p?.id ?? '').trim().toLowerCase(), name = String(p?.name ?? '').trim();
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) throw fail(400, 'Each shipping partner needs an id of lowercase letters, numbers and dashes');
      if (!name || name.length > 60) throw fail(400, 'Each shipping partner needs a name of up to 60 characters');
      if (seen.has(id)) throw fail(400, `Shipping partner id "${id}" is used twice`);
      seen.add(id);
      return { id, name };
    });
  }
  return d;
}

/** Beyond this road distance a point is refused (a wrong GPS fix or a forged request would otherwise overflow the distance column). */
export const MAX_QUOTE_KM = 600;

const rad = x => x * Math.PI / 180;

/** Straight-line (great-circle) distance in km between {lat,lng} points. */
export function haversineKm(a, b) {
  const R = 6371.0088, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Estimated road distance: straight line x roadFactor, rounded to 0.1 km. */
export function distanceKm(office, dest, roadFactor = DEFAULT_DELIVERY.roadFactor) {
  return Math.round(haversineKm(office, dest) * roadFactor * 10) / 10;
}

/** Fee for a road distance: free up to and including freeKm, then the first tier with km <= upToKm, else maxFee. */
export function feeForKm(km, delivery) {
  const d = mergeDelivery(delivery);
  if (km <= d.freeKm) return 0;
  const t = d.tiers.find(x => km <= x.upToKm);
  return t ? t.fee : d.maxFee;
}

export const validCoord = c => !!c && typeof c === 'object' && fin(c.lat) && fin(c.lng) && c.lat !== '' && c.lng !== '' && Math.abs(Number(c.lat)) <= 90 && Math.abs(Number(c.lng)) <= 180;

/** {km, fee, free, within} for a destination. Throws fail(400) when the coordinates are missing or out of range. */
export function quote(dest, delivery) {
  if (!validCoord(dest)) throw fail(400, 'Send the delivery location as latitude and longitude');
  const d = mergeDelivery(delivery);
  const km = distanceKm(d.office, { lat: Number(dest.lat), lng: Number(dest.lng) }, d.roadFactor);
  if (km > MAX_QUOTE_KM) throw fail(400, 'That location is too far for delivery by distance. Choose a nearer point on the map, or pick your district and a shipping partner.');
  const fee = feeForKm(km, d);
  return { km, fee, free: fee === 0, within: d.freeKm };
}

/** The delivery charge for an order. `zone` is 'inside' | 'outside' | 'suburb' (old checkout). `fee` is the zone's base fee (tier fee, outsideFee, ...).
 *  Free delivery over a spend applies to inside-Dhaka orders only, and only when freeOver is a positive number. */
export function deliveryCharge({ subtotal, zone, base, freeOver, express = 0 }) {
  const freeElig = zone !== 'outside' && Number(freeOver) > 0 && subtotal >= Number(freeOver);
  const delivery = subtotal ? (freeElig ? 0 : base) + express : 0;
  return { freeElig, delivery };
}
