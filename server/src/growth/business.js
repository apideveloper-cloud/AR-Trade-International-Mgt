// Business info of the Search & Growth console (Phase 6): ONE read model over the places the business details really live, and one
// save that writes each field back to its REAL store.
//   settings k='site'    -> phone, whatsapp, email, address
//   settings k='seo'     -> general.siteName / preferredDomain (read only here), business.legalName / logo / geoLat / geoLng / priceRange / hours
//   settings k='content' -> social (read only here)
// Also the manual Google Business Profile (GBP) workflow, kept in the growth row key `gbp`.
// HONEST NOTE: Google's Business Profile API needs Google's approval (it takes weeks), so this is a manual, copy-ready workflow:
// the owner pastes the copy block into Google, types back what is listed there, and napCheck.js compares it. An API compare is a later step.
import { pool } from '../db.js';
import { fail, parseJson } from '../util.js';
import { mergeSeoSettings, normaliseSeoSettings } from '../seoSettings.js';
import { parseAddress } from '../seoSchema.js';

const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHOW_ORDER = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const dayOf = d => DAYS.find(x => x.toLowerCase() === String(d ?? '').trim().toLowerCase() || x.slice(0, 3).toLowerCase() === String(d ?? '').trim().toLowerCase()) || null;
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------- default stores (all replaceable in tests) ----------
async function readRow(k) {
  const [rows] = await pool.query('SELECT v FROM settings WHERE k = ?', [k]);
  if (!rows.length) return null;
  try { return parseJson(rows[0].v) || null; } catch { return null; }
}
const writeRow = (k, v) => pool.query('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [k, JSON.stringify(v)]);
async function defaultBust() { try { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); } catch { /* optional */ } }
async function defaultRecord(before, after, who) {
  try {
    const { redactSettings } = await import('../admin/seoHistoryMap.js');
    const { recordHistory } = await import('../admin/seoHistory.js');
    await recordHistory(pool, { type: 'settings', id: 'seo', action: 'settings', source: 'settings', before: redactSettings(before), after: redactSettings(after), who });
  } catch { /* history is best effort */ }
}
function defaultDeps() {
  return {
    readSite: () => readRow('site'), writeSite: v => writeRow('site', v), readSeo: () => readRow('seo'), writeSeo: v => writeRow('seo', v),
    readContent: () => readRow('content'), bustSeo: defaultBust, record: defaultRecord,
    async readGrowth() { return (await import('./siteFiles.js')).readGrowth(); }, async saveGrowth(p) { return (await import('./siteFiles.js')).saveGrowth(p); }
  };
}
export const withDeps = d => ({ ...defaultDeps(), ...(d || {}) });
const safe = async (fn, dflt) => { try { const v = await fn(); return v ?? dflt; } catch { return dflt; } };

// ---------- hours ----------
/** seo hours [{days:[...],opens,closes}] -> one entry per day [{day,opens,closes,closed}]; [] when no hours are saved. */
export function expandHours(seoHours) {
  const rows = Array.isArray(seoHours) ? seoHours : [];
  if (!rows.length) return [];
  return DAYS.map(day => {
    const h = rows.find(r => Array.isArray(r?.days) && r.days.includes(day));
    return h ? { day, opens: h.opens, closes: h.closes, closed: false } : { day, opens: '', closes: '', closed: true };
  });
}
/** The other direction: per-day entries (or already grouped seo entries) -> seo grouping [{days,opens,closes}]. Closed days are left out. */
export function groupHours(input) {
  const out = [];
  for (const h of Array.isArray(input) ? input : []) {
    if (isObj(h) && Array.isArray(h.days)) { out.push({ days: h.days, opens: h.opens, closes: h.closes }); continue; }
    if (!isObj(h)) { out.push({ days: [], opens: '', closes: '' }); continue; }
    if (h.closed === true || h.closed === 'true') continue;
    const day = dayOf(h.day);
    const g = day && out.find(x => x._auto && x.opens === h.opens && x.closes === h.closes);
    if (g) g.days.push(day); else out.push({ days: day ? [day] : [], opens: h.opens, closes: h.closes, _auto: true });
  }
  return out.map(({ _auto, ...r }) => r);
}
/** Lines like 'Sat: 10:00-20:00' / 'Fri: Closed', Saturday first. [] when no hours are saved. */
export function formatHours(hours) {
  const list = Array.isArray(hours) ? hours : [];
  if (!list.length) return [];
  const line = h => `${String(dayOf(h.day) || h.day).slice(0, 3)}: ${h.closed ? 'Closed' : `${h.opens}-${h.closes}`}`;
  const sorted = [...list].sort((a, b) => SHOW_ORDER.indexOf(dayOf(a.day)) - SHOW_ORDER.indexOf(dayOf(b.day)));
  return sorted.map(line);
}

// ---------- read model ----------
/** { info } built from site + seo + content. Every field says where it came from in info.sources. */
export async function getBusiness(deps) {
  const d = withDeps(deps);
  const [site, seoRaw, content] = await Promise.all([safe(d.readSite, {}), safe(d.readSeo, {}), safe(d.readContent, {})]);
  const seo = mergeSeoSettings(seoRaw || {});
  const s = isObj(site) ? site : {};
  const address = String(s.address || '').trim();
  const pa = parseAddress(address);
  const social = {};
  for (const [k, v] of Object.entries(isObj(content?.social) ? content.social : {})) if (typeof v === 'string' && v.trim()) social[k] = v.trim();
  const b = seo.business || {};
  const info = {
    name: seo.general.siteName, legalName: b.legalName || '', phone: String(s.phone || '').trim(), whatsapp: String(s.whatsapp || '').replace(/\D/g, ''), email: String(s.email || '').trim(),
    address, street: address, locality: pa.locality || '', postalCode: pa.postalCode || '', country: 'BD',
    geoLat: b.geoLat ?? null, geoLng: b.geoLng ?? null, priceRange: b.priceRange || '', logo: b.logo || '', hours: expandHours(b.hours), social, website: seo.general.preferredDomain || '',
    sources: {
      name: 'seo.general', legalName: 'seo.business', phone: 'site', whatsapp: 'site', email: 'site', address: 'site', street: 'site', locality: 'site', postalCode: 'site', country: 'site',
      geoLat: 'seo.business', geoLng: 'seo.business', priceRange: 'seo.business', logo: 'seo.business', hours: 'seo.business', social: 'content.social', website: 'seo.general'
    }
  };
  return { info };
}

// ---------- validation ----------
const EMAIL = /^[^\s,;<>"()@]+@[^\s,;<>"()@]+\.[^\s,;<>"()@]+$/;
export const isEmail = s => EMAIL.test(String(s || '')) && String(s).length <= 160;
export function checkPhone(v) {
  const s = String(v ?? '').trim();
  if (s === '') return '';
  if (!/^[0-9+\s-]+$/.test(s) || s.length < 6 || s.length > 20 || s.replace(/\D/g, '').length < 6) throw fail(400, 'Phone: use digits, +, spaces or dashes only, 6 to 20 characters');
  return s.replace(/\s+/g, ' ');
}
export function checkWhatsapp(v) {
  const s = String(v ?? '').trim().replace(/[\s+-]/g, '');
  if (s === '') return '';
  if (!/^\d{10,15}$/.test(s)) throw fail(400, 'WhatsApp: enter 10 to 15 digits with the country code, for example 8801977554401');
  return s;
}
export function checkEmail(v) {
  const s = String(v ?? '').trim();
  if (s === '') return '';
  if (!isEmail(s)) throw fail(400, 'E-mail: that does not look like an e-mail address');
  return s;
}
export function checkAddress(v) {
  const s = String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > 200) throw fail(400, 'Address: at most 200 characters, on one line');
  return s;
}
export function checkText(v, max, label) {
  const s = String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > max) throw fail(400, `${label}: at most ${max} characters`);
  return s;
}
export function checkGeo(v, lim, label) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > lim) throw fail(400, `${label}: a number between -${lim} and ${lim}`);
  return n;
}

/** Validates the patch (nothing is written when anything is wrong), then writes each field to its real store and clears the SEO cache. */
export async function saveBusiness(patch, staffName, deps) {
  const d = withDeps(deps), p = isObj(patch) ? patch : {};
  const sitePatch = {}, bizPatch = {};
  if (p.phone !== undefined) sitePatch.phone = checkPhone(p.phone);
  if (p.whatsapp !== undefined) sitePatch.whatsapp = checkWhatsapp(p.whatsapp);
  if (p.email !== undefined) sitePatch.email = checkEmail(p.email);
  if (p.address !== undefined) sitePatch.address = checkAddress(p.address);
  if (p.legalName !== undefined) bizPatch.legalName = checkText(p.legalName, 120, 'Legal name');
  if (p.priceRange !== undefined) bizPatch.priceRange = checkText(p.priceRange, 20, 'Price range');
  if (p.geoLat !== undefined) bizPatch.geoLat = checkGeo(p.geoLat, 90, 'Latitude');
  if (p.geoLng !== undefined) bizPatch.geoLng = checkGeo(p.geoLng, 180, 'Longitude');
  if (p.logo !== undefined) bizPatch.logo = clean(p.logo, 500);
  if (p.hours !== undefined) { if (!Array.isArray(p.hours)) throw fail(400, 'Hours must be a list'); bizPatch.hours = groupHours(p.hours); }

  let nextSeo = null, prevSeo = null, rawSeo = null;
  if (Object.keys(bizPatch).length) {
    rawSeo = await d.readSeo();
    prevSeo = mergeSeoSettings(rawSeo || {});
    const { settings, errors } = normaliseSeoSettings({ ...prevSeo, business: { ...prevSeo.business, ...bizPatch } });
    const bad = (errors || []).find(e => e.startsWith('business.'));
    if (bad) throw fail(400, bad.replace(/^business\.hours\[(\d+)\]/, (m, i) => `Hours row ${Number(i) + 1}`).replace(/^business\./, ''));
    nextSeo = settings;
  }
  if (Object.keys(sitePatch).length) {
    const cur = await d.readSite();
    await d.writeSite({ ...(isObj(cur) ? cur : {}), ...sitePatch }); // merge: every other key of the site row survives
  }
  if (nextSeo) { await d.writeSeo(nextSeo); await safe(() => d.record(prevSeo, nextSeo, staffName), null); }
  if (Object.keys(sitePatch).length || nextSeo) await safe(d.bustSeo, null);
  return getBusiness(d);
}

// ---------- copy block ----------
/** Everything the owner pastes into Google Business Profile, Bing Places or a directory. Pure. */
export function gbpCopyBlock(info = {}) {
  const lines = formatHours(info.hours);
  const hours = lines.join('\n');
  const name = String(info.name || ''), phone = String(info.phone || ''), address = String(info.address || ''), website = String(info.website || '');
  const text = [name && `Business name: ${name}`, phone && `Phone: ${phone}`, address && `Address: ${address}`, website && `Website: ${website}`, hours && `Opening hours:\n${hours}`].filter(Boolean).join('\n');
  return { name, phone, address, website, hours, hoursLines: lines, text };
}

// ---------- Google Business Profile (manual) ----------
export const GBP_STEPS = [
  { id: 'claim', label: 'Claim or create the profile', hint: 'Go to business.google.com, search for the shop and claim it, or create a new profile.' },
  { id: 'category', label: 'Choose the main category', hint: "Pick the category that matches your main business; check Google's list." },
  { id: 'address', label: 'Add the address and service area', hint: 'Use the address and area from the copy block below, exactly as written.' },
  { id: 'contact', label: 'Add the phone number and the website', hint: 'Use the phone number and the website address from the copy block.' },
  { id: 'hours', label: 'Add the opening hours', hint: 'Copy the hours lines from the copy block.' },
  { id: 'verify', label: 'Verify the profile', hint: 'Use the verification method Google offers (post card, phone, e-mail or video).' },
  { id: 'photos', label: 'Add photos, the logo and a cover picture', hint: 'Shop front, inside, products and the logo.' },
  { id: 'products', label: 'Add products or services', hint: 'List the main product groups and services with a short description.' },
  { id: 'reviewlink', label: 'Copy the review link into the shop', hint: "In your profile choose 'Get more reviews', copy the link and paste it into Review link here." },
  { id: 'qa', label: 'Answer the questions people ask', hint: 'Add and answer the common questions on the profile.' },
  { id: 'monthly', label: 'Post an update every month', hint: 'A short post with an offer, a new product or a notice.' }
];
const GBP_HOSTS = ['google.com', 'g.page', 'goo.gl', 'share.google']; // maps.app.goo.gl is a sub-domain of goo.gl
/** '' or a clean https URL on a Google host; otherwise a plain 400. */
export function checkGoogleUrl(v, label) {
  const s = String(v ?? '').trim();
  if (s === '') return '';
  let u;
  try { u = new URL(s); } catch { throw fail(400, `${label}: enter the full web address that starts with https://`); }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || s.length > 500 || !GBP_HOSTS.some(x => h === x || h.endsWith('.' + x))) {
    throw fail(400, `${label}: it must be a https address on google.com, g.page, goo.gl, maps.app.goo.gl or share.google`);
  }
  return s;
}
const gbpEmpty = () => ({ profileUrl: '', reviewLink: '', claimed: false, verified: false, listedName: '', listedPhone: '', listedAddress: '', listedHours: '', checklist: {} });
/** The stored gbp row with defaults and the fixed checklist merged in. Pure. */
export function gbpView(stored) {
  const g = { ...gbpEmpty(), ...(isObj(stored) ? stored : {}) };
  const done = isObj(g.checklist) ? g.checklist : {};
  return { profileUrl: String(g.profileUrl || ''), reviewLink: String(g.reviewLink || ''), claimed: g.claimed === true, verified: g.verified === true,
    listedName: String(g.listedName || ''), listedPhone: String(g.listedPhone || ''), listedAddress: String(g.listedAddress || ''), listedHours: String(g.listedHours || ''),
    checklist: GBP_STEPS.map(s => ({ ...s, done: done[s.id] === true })) };
}
export async function getGbp(deps) { const d = withDeps(deps); return gbpView((await safe(d.readGrowth, {})).gbp); }
/** The saved review link, for the review-request e-mail / WhatsApp texts ('' when none). */
export async function getReviewLink(deps) { return (await getGbp(deps)).reviewLink; }
const bool = v => v === true || v === 'true' || v === 1;
export async function saveGbp(patch, deps) {
  const d = withDeps(deps), p = isObj(patch) ? patch : {};
  const cur = (await safe(d.readGrowth, {})).gbp, next = { ...gbpEmpty(), ...(isObj(cur) ? cur : {}), checklist: { ...(isObj(cur?.checklist) ? cur.checklist : {}) } };
  if (p.profileUrl !== undefined) next.profileUrl = checkGoogleUrl(p.profileUrl, 'Profile link');
  if (p.reviewLink !== undefined) next.reviewLink = checkGoogleUrl(p.reviewLink, 'Review link');
  if (p.claimed !== undefined) next.claimed = bool(p.claimed);
  if (p.verified !== undefined) next.verified = bool(p.verified);
  if (p.listedName !== undefined) next.listedName = checkText(p.listedName, 120, 'Listed name');
  if (p.listedPhone !== undefined) next.listedPhone = checkText(p.listedPhone, 40, 'Listed phone');
  if (p.listedAddress !== undefined) next.listedAddress = checkText(p.listedAddress, 300, 'Listed address');
  if (p.listedHours !== undefined) { const h = String(p.listedHours ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim(); if (h.length > 600) throw fail(400, 'Listed hours: at most 600 characters'); next.listedHours = h; }
  if (p.checklist !== undefined) {
    if (!isObj(p.checklist)) throw fail(400, 'Checklist must be an object of step ids');
    for (const [id, v] of Object.entries(p.checklist)) { if (!GBP_STEPS.some(s => s.id === id)) throw fail(400, `Unknown checklist step: ${clean(id, 30)}`); next.checklist[id] = bool(v); }
  }
  await d.saveGrowth({ gbp: next });
  return gbpView(next);
}
