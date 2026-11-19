// Pure helpers for the delivery hub (no database): shapes, COD test, phone match, live-tracking figures.
import { digits } from '../util.js';

/** Cash on delivery and not yet paid. */
export const isCod = o => /cod|cash/i.test(o.payment || '') && o.pay_status !== 'Paid';

/** A rider (staff row) in the shape the console shows. */
export const riderOut = r => ({ id: r.id, name: r.name, phone: r.phone, vehicle: r.vehicle, rating: Number(r.rating), branch: r.branch_id });

/** Groups order_items rows by order id. */
export function groupItems(items) {
  const m = new Map();
  items.forEach(i => { if (!m.has(i.order_id)) m.set(i.order_id, []); m.get(i.order_id).push(i); });
  return m;
}

/** True when the phone typed by a customer matches the order's phone (last 10 digits; a blank phone never matches). */
export const phoneMatches = (order, phone) => !!order && !!digits(phone) && digits(order.customer_phone).slice(-10) === digits(phone).slice(-10);

/** The history line written when an order is closed. */
export const deliveryNote = (method, o, pod) => (method === 'courier' ? 'Confirmed by ' + o.courier : method === 'otp' ? 'OTP verified' : 'Signed by ' + (pod.name || 'customer'));

/** The moving-bike figures on the customer tracking page, from minutes since the order left. */
export const liveProgress = mins => ({ pct: Math.min(94, 8 + mins / 35 * 100), etaMin: Math.max(3, Math.round(35 - mins)), sinceMin: Math.max(1, Math.round(mins)) });

/** Failed-attempt list with one more entry; three or more flags the order. */
export function addAttempt(existing, reason, at = Date.now()) {
  const attempts = [...(existing || []), { reason, at }];
  return { attempts, flagged: attempts.length >= 3 };
}
