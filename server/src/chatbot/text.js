// Small text and money helpers shared by the assistant modules.
import { mergeDelivery } from '../delivery.js';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
/** Bangla digits -> English digits ("১২" -> "12"). */
export const toEnDigits = s => String(s).replace(/[০-৯]/g, d => BN_DIGITS.indexOf(d));
/** True when the text contains Bangla letters. */
export const isBangla = s => /[ঀ-৿]/.test(s);
/** Delivery summary from the site settings: free radius in km and the lowest and highest distance fee. */
export const dl = site => { const d = mergeDelivery(site.delivery); const fees = d.tiers.map(t => t.fee).concat(d.maxFee); return { freeKm: d.freeKm, min: Math.min(...fees), max: Math.max(...fees) }; };
/** 7500 -> "৳7,500". */
export const taka = n => '৳' + Math.round(n).toLocaleString('en-IN');
/** Lower-case letters and digits only, for comparing model numbers. */
export const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
