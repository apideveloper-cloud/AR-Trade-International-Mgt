import { DISTRICTS } from '../../data.js';
import { MOBILE_HINT, bdMobile, toAsciiDigits } from '../../phone.js';

/** Trimmed copy of the form values with Bangla digits turned into 0-9 and a valid mobile number in 01XXXXXXXXX form (left as typed if invalid). */
export function normalizeCheckout(d) {
  const out = { ...d };
  for (const k of ['name', 'email', 'address', 'districtOther', 'thana']) if (typeof out[k] === 'string') out[k] = out[k].trim();
  if (typeof out.postcode === 'string') out.postcode = toAsciiDigits(out.postcode).trim();
  if (typeof out.phone === 'string') { const p = toAsciiDigits(out.phone).trim(); out.phone = bdMobile(p) || p; }
  return out;
}

/**
 * Checks the checkout form. `fields` are the raw form values, `ctx` is { dest, partner } (the map point and the chosen courier).
 * Returns an object with one message per wrong field; an empty object means the form is fine.
 */
export function validateCheckout(fields, { dest, partner }) {
  const d = normalizeCheckout(fields), problems = {};
  if (!d.name) problems.name = 'Please enter your full name';
  if (!d.phone) problems.phone = 'Please enter your mobile number';
  else if (!bdMobile(d.phone)) problems.phone = MOBILE_HINT;
  if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) problems.email = 'Enter a valid email address, e.g. name@example.com';
  if (!d.address) problems.address = 'Please enter your address (house, road, area)';
  if (d.postcode && !/^\d{4}$/.test(d.postcode)) problems.postcode = 'Enter the 4-digit postcode, e.g. 1217';
  if (!d.district) problems.district = 'Please select your district';
  else if (d.district === 'Others' && !d.districtOther) problems.districtOther = 'Please type your district';
  else if (d.district === 'Others' && DISTRICTS.some(x => x.toLowerCase() === d.districtOther.toLowerCase())) problems.districtOther = 'That district is in the list: please select it above';
  if (!d.thana) problems.thana = 'Please enter your thana';
  if (d.district === 'Dhaka' && !dest) problems.dest = 'Please pick your delivery location on the map';
  if (d.district && d.district !== 'Dhaka' && !partner) problems.partner = 'Please choose a shipping partner';
  return problems;
}
