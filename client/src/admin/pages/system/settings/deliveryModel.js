/** Pure delivery-settings helpers: defaults, normalising, validation and the save payload. */
export const DEFAULT_DELIVERY = {
  office: { lat: 23.739316, lng: 90.415567, label: '159 Santinagar, Dhaka-1217' },
  freeKm: 2,
  roadFactor: 1.25,
  tiers: [{ upToKm: 5, fee: 100 }, { upToKm: 8, fee: 150 }, { upToKm: 12, fee: 200 }, { upToKm: 18, fee: 250 }],
  maxFee: 350,
  partners: [['redx', 'RedX'], ['sa-paribahan', 'SA Paribahan'], ['steadfast', 'Steadfast Courier'], ['sundarban', 'Sundarban Courier']].map(([id, name]) => ({ id, name })),
};

/** Delivery object with every missing piece filled from the defaults (values may still be strings while the admin types). */
export const getDelivery = d => {
  const x = d && typeof d === 'object' ? d : {};
  return {
    office: { ...DEFAULT_DELIVERY.office, ...(x.office || {}) },
    freeKm: x.freeKm ?? DEFAULT_DELIVERY.freeKm,
    roadFactor: x.roadFactor ?? DEFAULT_DELIVERY.roadFactor,
    tiers: Array.isArray(x.tiers) ? x.tiers : DEFAULT_DELIVERY.tiers,
    maxFee: x.maxFee ?? DEFAULT_DELIVERY.maxFee,
    partners: Array.isArray(x.partners) ? x.partners : DEFAULT_DELIVERY.partners,
  };
};
export const isNum = v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
const slug = n => String(n || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
/** Partners with ids: existing ids stay, new entries get a slug of the name. */
const withIds = ps => ps.map(p => ({ id: p.id || slug(p.name), name: String(p.name || '').trim() }));

/** List of human-readable problems with the delivery settings (empty = valid). */
export function validateDelivery(raw, tr = s => s) {
  const d = getDelivery(raw), e = [];
  const lat = d.office.lat, lng = d.office.lng;
  if (!isNum(lat) || +lat < -90 || +lat > 90) e.push(tr('Latitude must be a number between -90 and 90.'));
  if (!isNum(lng) || +lng < -180 || +lng > 180) e.push(tr('Longitude must be a number between -180 and 180.'));
  if (String(d.office.label || '').length > 120) e.push(tr('Office label is too long (max 120 characters).'));
  if (!isNum(d.freeKm) || +d.freeKm < 0) e.push(tr('Free distance must be 0 or more.'));
  if (!isNum(d.roadFactor) || +d.roadFactor < 1 || +d.roadFactor > 3) e.push(tr('Road factor must be a number between 1 and 3.'));
  d.tiers.forEach((t, i) => {
    const n = i + 1;
    if (!isNum(t.upToKm) || +t.upToKm <= 0) e.push(tr('Step {n}: enter the distance in km (more than 0).', { n }));
    else if (i > 0 && isNum(d.tiers[i - 1].upToKm) && +t.upToKm <= +d.tiers[i - 1].upToKm) e.push(tr('Step {n}: km must be more than the step above.', { n }));
    else if (+t.upToKm <= +d.freeKm && isNum(d.freeKm)) e.push(tr('Step {n}: km must be more than the free distance.', { n }));
    if (!isNum(t.fee) || +t.fee < 0) e.push(tr('Step {n}: enter the fee (0 or more).', { n }));
    else if (i > 0 && isNum(d.tiers[i - 1].fee) && +t.fee < +d.tiers[i - 1].fee) e.push(tr('Step {n}: fee cannot be lower than the step above.', { n }));
  });
  if (!isNum(d.maxFee) || +d.maxFee < 0) e.push(tr('Fee beyond the last step must be 0 or more.'));
  else if (d.tiers.length && isNum(d.tiers[d.tiers.length - 1].fee) && +d.maxFee < +d.tiers[d.tiers.length - 1].fee) e.push(tr('Fee beyond the last step cannot be lower than the last step.'));
  if (!d.partners.length) e.push(tr('Keep at least one shipping partner, otherwise orders outside Dhaka cannot be placed.'));
  const seen = new Set();
  d.partners.forEach((p, i) => {
    const name = String(p.name || '').trim();
    if (!name) { e.push(tr('Partner {n}: name is empty.', { n: i + 1 })); return; }
    if (name.length > 60) e.push(tr('Partner {n}: name is too long (max 60).', { n: i + 1 }));
    const id = p.id || slug(name);
    if (!id) { e.push(tr('Partner "{name}": use English letters or numbers in the name.', { name })); return; }
    if (seen.has(id)) e.push(tr('Partner "{name}" is listed twice.', { name }));
    seen.add(id);
  });
  return e;
}

/** Numbers as numbers, partners with ids; call only after validateDelivery passes. */
export function deliveryPayload(raw) {
  const d = getDelivery(raw);
  return {
    office: { lat: +d.office.lat, lng: +d.office.lng, label: String(d.office.label || '').trim() },
    freeKm: +d.freeKm,
    roadFactor: +d.roadFactor,
    tiers: d.tiers.map(t => ({ upToKm: +t.upToKm, fee: +t.fee })),
    maxFee: +d.maxFee,
    partners: withIds(d.partners),
  };
}
