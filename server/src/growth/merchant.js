// Merchant Center settings (settings row k='growth', key `merchant`): validation, feed token, category-map suggestions. Nothing here talks to Google.
import crypto from 'node:crypto';
import { readGrowth, saveGrowth } from './siteFiles.js';

export const DEFAULTS = Object.freeze({ feedToken: '', categoryMap: {}, excludedCategories: [], skipSmallImages: false, minImagePx: 800, accountId: '', dataSourceId: '', syncEnabled: false, contentLanguage: 'en', feedLabel: 'BD' });
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** Google category: a numeric taxonomy ID or a ">"-separated path, max 250 chars. Returns the normalised text, '' when empty, or null when invalid. */
export function normalizeGoogleCategory(v) {
  const t = String(v ?? '').trim();
  if (!t) return '';
  if (t.length > 250) return null;
  if (/^\d{1,8}$/.test(t)) return t;
  if (/[\u0000-\u001F<]/.test(t)) return null;
  const parts = t.split('>').map(x => x.trim());
  if (parts.some(x => !x)) return null;
  return parts.join(' > ');
}

/** Validates a settings patch. Returns { ok, value, error }; value holds only the keys that were given (all validated). */
export function validateMerchantSettings(input) {
  const i = isObj(input) ? input : {}, v = {};
  const bad = error => ({ ok: false, value: null, error });
  if (i.categoryMap !== undefined) {
    if (!isObj(i.categoryMap)) return bad('The category list is not valid');
    v.categoryMap = {};
    for (const [k, raw] of Object.entries(i.categoryMap)) {
      const id = clean(k, 40), g = normalizeGoogleCategory(raw);
      if (!id) return bad('A category has no id');
      if (g === null) return bad(`The Google category for "${id}" must be a number or a path like "Electronics > Print, Copy, Scan & Fax" (max 250 characters)`);
      if (g) v.categoryMap[id] = g;
    }
  }
  if (i.excludedCategories !== undefined) {
    if (!Array.isArray(i.excludedCategories) || i.excludedCategories.length > 500) return bad('The excluded category list is not valid');
    v.excludedCategories = [...new Set(i.excludedCategories.map(x => clean(x, 40)).filter(Boolean))];
  }
  if (i.skipSmallImages !== undefined) v.skipSmallImages = i.skipSmallImages === true || i.skipSmallImages === 'true';
  if (i.minImagePx !== undefined) {
    const n = Number(i.minImagePx);
    if (!Number.isInteger(n) || n < 100 || n > 4000) return bad('Minimum image size must be a whole number from 100 to 4000 pixels');
    v.minImagePx = n;
  }
  if (i.contentLanguage !== undefined) {
    const l = String(i.contentLanguage).trim().toLowerCase();
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(l)) return bad('Content language must be a code like en or bn');
    v.contentLanguage = l;
  }
  if (i.feedLabel !== undefined) {
    const l = String(i.feedLabel).trim();
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(l)) return bad('Feed label can only have letters, numbers, - and _ (max 20)');
    v.feedLabel = l;
  }
  for (const [k, label] of [['accountId', 'Merchant Center ID'], ['dataSourceId', 'Data source ID']]) {
    if (i[k] === undefined) continue;
    const s = String(i[k]).trim();
    if (s && !/^\d{1,20}$/.test(s)) return bad(`${label} must be digits only (max 20)`);
    v[k] = s;
  }
  if (i.syncEnabled !== undefined) v.syncEnabled = i.syncEnabled === true || i.syncEnabled === 'true';
  return { ok: true, value: v, error: '' };
}

/** The stored settings with defaults filled in (the token is included: strip it with publicSettings before sending to the browser). */
export async function readMerchant() {
  const m = (await readGrowth()).merchant;
  return { ...DEFAULTS, ...(isObj(m) ? m : {}), categoryMap: { ...(isObj(m?.categoryMap) ? m.categoryMap : {}) }, excludedCategories: Array.isArray(m?.excludedCategories) ? m.excludedCategories : [] };
}
export const publicSettings = s => { const { feedToken, ...rest } = s; return rest; };
/** Merges a validated patch into growth.merchant, leaving every other growth key alone. */
export async function saveMerchant(patch) {
  const next = { ...(await readMerchant()), ...patch };
  await saveGrowth({ merchant: next });
  return next;
}

export const generateFeedToken = () => crypto.randomBytes(24).toString('hex');

// !! These paths are written from memory of Google's product taxonomy. Check every one against the official file
// !! (https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt) before relying on it. A category without a confident match gets no suggestion.
const PRINTERS = 'Electronics > Print, Copy, Scan & Fax > Printers, Copiers & Fax Machines';
const TONER = 'Electronics > Print, Copy, Scan & Fax > Printer, Copier & Fax Machine Accessories > Printer Consumables > Toner & Inkjet Cartridges';
const SCANNERS = 'Electronics > Print, Copy, Scan & Fax > Scanners';
const RULES = [
  [/toner|ink\b|ink[- ]?jet|cartridge|ribbon/i, TONER, 'Toner and ink cartridges.'],
  [/scanner/i, SCANNERS, 'Scanners.'],
  [/printer|copier|photocopi|fax|multifunction/i, PRINTERS, 'Printers, copiers and fax machines.']
];
/** [{id,title}] -> [{categoryId, title, suggestion|null, note}]. Pure: never writes anything; the owner confirms every suggestion in the UI. */
export function suggestCategoryMap(categories) {
  return (Array.isArray(categories) ? categories : []).map(c => {
    const title = String(c?.title ?? '');
    const hit = RULES.find(([re]) => re.test(title));
    return { categoryId: String(c?.id ?? ''), title, suggestion: hit ? hit[1] : null, note: hit ? hit[2] + " Please confirm against Google's taxonomy." : 'No confident match. Pick the Google category yourself or leave it empty.' };
  });
}
