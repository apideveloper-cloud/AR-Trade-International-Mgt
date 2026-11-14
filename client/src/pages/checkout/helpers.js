import { PAY_LABEL } from '../../data.js';

/** The delivery address as one line: address, then thana and district unless the address already names them, then " - postcode". */
export function fullAddress(d) {
  const place = (d.district === 'Others' ? d.districtOther : d.district || '').trim();
  const has = x => x && d.address.toLowerCase().includes(String(x).toLowerCase());
  return [d.address, has(d.thana) ? '' : d.thana, has(place) ? '' : place].filter(Boolean).join(', ') + (d.postcode ? ' - ' + d.postcode : '');
}

/** Payment name stored on the order, e.g. "Card · SSLCommerz". */
export const paymentName = (pay, gw) => (pay === 'Card' ? 'Card · ' + gw : PAY_LABEL[pay] || pay);

/** Total before delivery: subtotal minus coupon and member discounts. */
export const totalBeforeDelivery = t => Math.max(0, t.subtotal - t.discount - t.member);

/** Body of POST /orders: the checked form values `d` plus the checkout choices. */
export function orderPayload({ d, lines, area, dest, partner, pay, gw, paid, coupon, exOn, partial }) {
  return {
    items: lines.map(l => ({ id: l.p.id, qty: l.qty })), customer: { name: d.name, phone: d.phone, email: d.email }, address: fullAddress(d), area,
    district: d.district, ...(d.district === 'Dhaka' ? { dest: { lat: dest.lat, lng: dest.lng } } : { partner }),
    payment: paymentName(pay, gw), gateway: pay === 'Card' ? gw : '', paid, note: d.note, coupon, express: exOn,
    partial, slot: exOn ? 'Express · within 3 hours' : '', vatInvoice: false, company: d.company, bin: d.bin
  };
}
