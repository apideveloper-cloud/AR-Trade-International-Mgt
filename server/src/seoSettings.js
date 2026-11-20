// Pure SEO settings: defaults, whitelist + validation, merge, robots.txt check. No database. null / '' means "not set": downstream code omits it.
import { DEFAULT_TEMPLATES } from './seoTemplate.js';

export const SEO_FLAGS = { aiGenerate: false, indexNow: false, merchantFeed: false };

const KINDS = Object.keys(DEFAULT_TEMPLATES);
const TPL_KEYS = ['title', 'description', 'ogTitle', 'ogDescription'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SEPARATORS = ['|', '-', '–', '·'];

export const SEO_DEFAULTS = {
  general: { siteName: 'AR Trade International', siteNameFull: 'AR Trade International', siteNameShort: 'AR Trade', separator: '|', defaultOgImage: '', preferredDomain: '', defaultLanguage: 'en' },
  templates: Object.fromEntries(KINDS.map(k => [k, { ...DEFAULT_TEMPLATES[k] }])),
  business: { legalName: '', logo: '', geoLat: null, geoLng: null, priceRange: '', hours: [] },
  shipping: { zones: [{ id: 'dhaka', label: 'Inside Dhaka', rate: null }, { id: 'outside', label: 'Outside Dhaka', rate: null }], handlingDays: null, transitDays: { dhaka: null, outside: null } },
  returns: { windowDays: null, method: '', fees: '', category: '' },
  verification: { google: '', bing: '', ga4: '', gtm: '' },
  robots: { noindexSearch: true, noindexFilters: true, customTxt: '' },
  indexNow: { key: '' },
  flags: { ...SEO_FLAGS }
};

const clone = o => JSON.parse(JSON.stringify(o));
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const str = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '');
const hhmm = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
const numOrNull = v => (v === null || v === undefined || v === '' ? null : Number(v));

/** Whitelists, trims, clamps and validates. Invalid values fall back to the default and add an error message. */
export function normaliseSeoSettings(input) {
  const inp = isObj(input) ? input : {};
  const errors = [];
  const s = clone(SEO_DEFAULTS);
  const err = m => errors.push(m);

  // general
  const g = isObj(inp.general) ? inp.general : {};
  const name = (key, max) => { if (g[key] !== undefined) { const v = str(g[key], max); if (v) s.general[key] = v; else err(`general.${key} is required`); } };
  name('siteName', 60); name('siteNameFull', 120); name('siteNameShort', 60);
  if (g.separator !== undefined) { const v = String(g.separator).trim(); if (SEPARATORS.includes(v)) s.general.separator = v; else err('general.separator must be one of | - – ·'); }
  if (g.defaultOgImage !== undefined) { const v = str(g.defaultOgImage, 500); if (v === '' || v.startsWith('/') || v.startsWith('https://')) s.general.defaultOgImage = v; else err('general.defaultOgImage must be empty, start with / or https://'); }
  if (g.preferredDomain !== undefined) { const v = str(g.preferredDomain, 200).replace(/\/+$/, ''); if (v === '' || /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{2,5})?$/i.test(v)) s.general.preferredDomain = v; else err('general.preferredDomain must be a bare https origin'); }
  if (g.defaultLanguage !== undefined) { const v = str(g.defaultLanguage, 10); if (/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(v)) s.general.defaultLanguage = v; else err('general.defaultLanguage is not a language code'); }

  // templates
  const t = isObj(inp.templates) ? inp.templates : {};
  for (const k of KINDS) {
    const row = isObj(t[k]) ? t[k] : {};
    for (const f of TPL_KEYS) {
      if (row[f] === undefined) continue;
      if (typeof row[f] !== 'string') { err(`templates.${k}.${f} must be text`); continue; }
      const v = row[f].replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
      if (v.length > 300) err(`templates.${k}.${f} is longer than 300 characters`);
      else if (v) s.templates[k][f] = v; // empty = use the default
    }
  }

  // business
  const b = isObj(inp.business) ? inp.business : {};
  if (b.legalName !== undefined) s.business.legalName = str(b.legalName, 120);
  if (b.logo !== undefined) { const v = str(b.logo, 500); if (v === '' || v.startsWith('/') || v.startsWith('https://')) s.business.logo = v; else err('business.logo must be empty, start with / or https://'); }
  if (b.priceRange !== undefined) s.business.priceRange = str(b.priceRange, 20);
  for (const [key, lim] of [['geoLat', 90], ['geoLng', 180]]) {
    if (b[key] === undefined) continue;
    const n = numOrNull(b[key]);
    if (n === null) s.business[key] = null;
    else if (Number.isFinite(n) && Math.abs(n) <= lim) s.business[key] = n;
    else err(`business.${key} must be between -${lim} and ${lim}`);
  }
  if (b.hours !== undefined) {
    if (!Array.isArray(b.hours)) err('business.hours must be a list');
    else {
      const out = [];
      b.hours.slice(0, 14).forEach((h, i) => {
        const days = (isObj(h) && Array.isArray(h.days) ? h.days : []).map(d => DAYS.find(x => x.toLowerCase() === String(d).trim().toLowerCase() || x.slice(0, 3).toLowerCase() === String(d).trim().toLowerCase())).filter(Boolean);
        if (!days.length || !hhmm(h.opens) || !hhmm(h.closes)) { err(`business.hours[${i}] needs days and HH:MM opens/closes`); return; }
        out.push({ days: DAYS.filter(d => days.includes(d)), opens: h.opens, closes: h.closes });
      });
      s.business.hours = out;
    }
  }

  // shipping
  const sh = isObj(inp.shipping) ? inp.shipping : {};
  if (Array.isArray(sh.zones)) {
    const zs = [];
    sh.zones.slice(0, 20).forEach((z, i) => {
      const id = str(isObj(z) ? z.id : '', 30).toLowerCase(), label = str(isObj(z) ? z.label : '', 60);
      const rate = numOrNull(isObj(z) ? z.rate : null);
      if (!/^[a-z0-9_-]+$/.test(id) || !label || (rate !== null && !(Number.isFinite(rate) && rate >= 0 && rate <= 1000000))) { err(`shipping.zones[${i}] is invalid`); return; }
      if (!zs.some(x => x.id === id)) zs.push({ id, label, rate });
    });
    if (zs.length) s.shipping.zones = zs;
  } else if (sh.zones !== undefined) err('shipping.zones must be a list');
  const days = (v, label) => { const n = numOrNull(v); if (n === null) return null; if (Number.isInteger(n) && n >= 0 && n <= 365) return n; err(`${label} must be a whole number 0 to 365`); return null; };
  if (sh.handlingDays !== undefined) s.shipping.handlingDays = days(sh.handlingDays, 'shipping.handlingDays');
  if (isObj(sh.transitDays)) for (const k of ['dhaka', 'outside']) if (sh.transitDays[k] !== undefined) s.shipping.transitDays[k] = days(sh.transitDays[k], `shipping.transitDays.${k}`);

  // returns
  const r = isObj(inp.returns) ? inp.returns : {};
  if (r.windowDays !== undefined) s.returns.windowDays = days(r.windowDays, 'returns.windowDays');
  if (r.method !== undefined) { const v = str(r.method, 20); if (['', 'store', 'courier', 'both'].includes(v)) s.returns.method = v; else err('returns.method must be store, courier or both'); }
  if (r.fees !== undefined) s.returns.fees = str(r.fees, 200);
  if (r.category !== undefined) { const v = str(r.category, 20); if (['', 'full', 'exchange', 'none'].includes(v)) s.returns.category = v; else err('returns.category must be full, exchange or none'); }

  // verification
  const vf = isObj(inp.verification) ? inp.verification : {};
  for (const k of ['google', 'bing']) if (vf[k] !== undefined) { const v = str(vf[k], 200); if (v.length <= 100 && /^[A-Za-z0-9_-]*$/.test(v)) s.verification[k] = v; else err(`verification.${k} must be up to 100 letters, digits, - or _`); }
  if (vf.ga4 !== undefined) { const v = str(vf.ga4, 30); if (v === '' || /^G-[A-Z0-9]{4,12}$/.test(v)) s.verification.ga4 = v; else err('verification.ga4 must look like G-XXXXXXXXXX'); }
  if (vf.gtm !== undefined) { const v = str(vf.gtm, 30); if (v === '' || /^GTM-[A-Z0-9]{4,10}$/.test(v)) s.verification.gtm = v; else err('verification.gtm must look like GTM-XXXXXXX'); }

  // robots
  const ro = isObj(inp.robots) ? inp.robots : {};
  for (const k of ['noindexSearch', 'noindexFilters']) if (ro[k] !== undefined) s.robots[k] = ro[k] === true || ro[k] === 'true' || ro[k] === 1;
  if (ro.customTxt !== undefined) {
    const txt = typeof ro.customTxt === 'string' ? ro.customTxt.replace(/\r\n?/g, '\n').trim() : '';
    if (!txt) s.robots.customTxt = '';
    else { const v = validateRobotsTxt(txt); if (v.ok) s.robots.customTxt = txt; else v.errors.forEach(m => err('robots.customTxt: ' + m)); }
  }

  // flags
  const fl = isObj(inp.flags) ? inp.flags : {};
  const notes = [];
  for (const k of Object.keys(SEO_FLAGS)) if (fl[k] !== undefined) s.flags[k] = fl[k] === true || fl[k] === 'true';
  if (s.flags.aiGenerate) { s.flags.aiGenerate = false; notes.push('flags.aiGenerate cannot be turned on yet and was kept off'); }

  // IndexNow key: empty (off) or exactly 32 lowercase hex characters
  const ix = isObj(inp.indexNow) ? inp.indexNow : {};
  if (ix.key !== undefined) { const v = typeof ix.key === 'string' ? ix.key.trim() : ix.key === null ? '' : 'invalid'; if (v === '' || /^[0-9a-f]{32}$/.test(v)) s.indexNow.key = v; else err('indexNow.key must be empty or 32 lowercase hex characters'); }

  return { settings: s, errors, notes };
}

/** Defaults deep-merged under stored settings (stored values win; unknown keys dropped; invalid ones fall back to the default). */
export function mergeSeoSettings(stored) {
  return normaliseSeoSettings(stored).settings;
}

const DIRECTIVES = ['user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay'];
/** A robots.txt written in the admin must not block the whole site and may only use known directives. The server appends Sitemap: when it is missing. */
export function validateRobotsTxt(text) {
  const errors = [];
  const t = typeof text === 'string' ? text : '';
  if (typeof text !== 'string') return { ok: false, errors: ['robots.txt must be text'] };
  if (t.length > 5000) errors.push('robots.txt is longer than 5000 characters');
  if (/<[a-z!/][^>]*>/i.test(t)) errors.push('robots.txt must not contain HTML');
  t.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m || !DIRECTIVES.includes(m[1].toLowerCase())) { errors.push(`line ${i + 1}: unknown directive`); return; }
    if (m[1].toLowerCase() === 'disallow' && m[2].trim() === '/') errors.push(`line ${i + 1}: "Disallow: /" would block the whole site`);
  });
  return { ok: errors.length === 0, errors };
}
