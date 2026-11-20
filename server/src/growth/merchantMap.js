// Pure mapping of a feed item (merchantFeed.js) to a Merchant API ProductInput body, plus a change-detection hash. No I/O.
import crypto from 'node:crypto';

const AVAIL = { 'in stock': 'IN_STOCK', 'out of stock': 'OUT_OF_STOCK', preorder: 'PREORDER', backorder: 'BACKORDER' };
const COND = { new: 'NEW', refurbished: 'REFURBISHED', used: 'USED' };

/** '16200.00 BDT' -> { amountMicros: '16200000000', currencyCode: 'BDT' } (exact decimal arithmetic on the text), or null. */
export function money(text) {
  const m = /^\s*(\d+)(?:\.(\d{1,6}))?\s*([A-Za-z]{3})\s*$/.exec(String(text ?? ''));
  if (!m) return null;
  const micros = BigInt(m[1]) * 1000000n + BigInt((m[2] || '').padEnd(6, '0') || '0');
  return { amountMicros: micros.toString(), currencyCode: m[3].toUpperCase() };
}
/** 'ISO/ISO' -> { startTime, endTime } or null. */
export function effectiveDate(text) {
  const [a, b] = String(text ?? '').split('/');
  return a && b ? { startTime: a.trim(), endTime: b.trim() } : null;
}

export function feedItemToProductInput(item, { contentLanguage = 'en', feedLabel = 'BD' } = {}) {
  const it = item || {}, a = {};
  const put = (k, v) => { if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) a[k] = v; };
  put('title', it.title); put('description', it.description); put('link', it.link); put('imageLink', it.image_link);
  put('additionalImageLinks', it.additional_image_link);
  put('availability', AVAIL[String(it.availability || '').toLowerCase()]);
  put('price', money(it.price)); put('salePrice', money(it.sale_price));
  put('salePriceEffectiveDate', it.sale_price ? effectiveDate(it.sale_price_effective_date) : null);
  put('brand', it.brand); put('gtins', it.gtin ? [String(it.gtin)] : null); put('mpn', it.mpn);
  put('condition', COND[String(it.condition || '').toLowerCase()]);
  if (it.identifier_exists === 'no') a.identifierExists = false;
  put('productTypes', it.product_type ? [String(it.product_type)] : null);
  put('googleProductCategory', it.google_product_category); put('itemGroupId', it.item_group_id);
  const s = it.shipping, sp = s && money(s.price);
  if (s && sp) a.shipping = [{ ...(s.country ? { country: s.country } : {}), ...(s.service ? { service: s.service } : {}), price: sp }];
  return { offerId: String(it.id), contentLanguage, feedLabel, attributes: a };
}

const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canon(v[k])])) : v;
/** Stable sha1 (40 hex) of the item's content; pid is internal and not part of it. */
export function itemHash(item) {
  const { pid, ...rest } = item || {};
  return crypto.createHash('sha1').update(JSON.stringify(canon(rest))).digest('hex');
}
