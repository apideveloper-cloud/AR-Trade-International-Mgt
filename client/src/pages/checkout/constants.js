// Shared constants and tiny pure helpers for the cart, checkout and order-placed pages.

/** Delivery zone names shown in the checkout summary. */
export const ZONE = { inside: 'Inside Dhaka', suburb: 'Dhaka suburbs', outside: 'Outside Dhaka' };

/** Payment methods that open the (demo) payment screen before the order is placed. */
export const ONLINE_PAYS = ['bKash', 'Nagad', 'Rocket', 'Card'];

/** Card gateways the customer can pick. */
export const GATEWAYS = ['SSLCommerz', 'aamarPay', 'ShurjoPay'];

/** sessionStorage key of the last placed order (read by the order-placed page). */
export const LAST_ORDER_KEY = 'ar_last_order';

/** sessionStorage key of the generated login that is shown until the customer confirms they saved it. */
export const loginKey = orderId => 'ar_new_login_' + orderId;

/** Class for a selectable option button. */
export const sel = on => 'opt' + (on ? ' on' : '');

/** Inline style for a product thumbnail. */
export const bgImage = img => ({ backgroundImage: img ? `url('${img}')` : 'none' });

/** Reads JSON from sessionStorage; null if missing, broken or storage is blocked. */
export function readSession(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}

/** Writes (or, with null, removes) a JSON value in sessionStorage; silently ignored when storage is blocked. */
export function writeSession(key, value) {
  try { if (value == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** sessionStorage key of the coupon code typed in the cart, so the checkout starts with the same discount. */
export const COUPON_KEY = 'ar_coupon';
