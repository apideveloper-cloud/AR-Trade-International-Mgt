// NAP consistency check (Name, Address, Phone): compares the business info with every place it shows up and lists what differs.
// Places: the Store JSON-LD of the home and contact pages (rendered by previewMeta), phone numbers / e-mails typed inside the
// policy and FAQ texts (content settings), the settings rows themselves, and the Google Business Profile copy typed in by hand (growth row `gbp`).
// Everything here except runNapCheck() is pure.
import { getBusiness, formatHours, getGbp, withDeps } from './business.js';

export const DEFAULT_ADDRESS_NOTE = 'The page shows a built-in default address because no address is saved';
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);

// ---------- normalisers ----------
/** Bangladesh numbers: 01977554401 == +880 1977-554401 == 8801977554401 == 008801977554401 -> '01977554401'. Other numbers: digits only. */
export function normPhone(s) {
  let d = String(s ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('880')) d = '0' + d.slice(3);
  else if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  return d;
}
export const phonesMatch = (a, b) => { const x = normPhone(a), y = normPhone(b); return x !== '' && x === y; };
export const normEmail = s => String(s ?? '').trim().toLowerCase();
/** Lower-case, punctuation and extra spaces removed. */
export const normText = s => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** The tokens that must be present for two addresses to be "the same": every number (street number, postal code) and the city name. */
export function addressKeys(addr) {
  const toks = normText(addr).split(' ').filter(Boolean);
  const keys = toks.filter(t => /\d/.test(t));
  if (toks.includes('dhaka')) keys.push('dhaka');
  return keys;
}
export function addressesMatch(actual, expected) {
  const a = normText(actual), e = normText(expected);
  if (!e || !a) return false;
  if (a === e) return true;
  const keys = addressKeys(expected);
  if (!keys.length) return false;
  const have = new Set(a.split(' '));
  return keys.every(k => have.has(k));
}
const times = s => (String(s ?? '').match(/\b\d{1,2}:\d{2}\b/g) || []).map(t => t.padStart(5, '0'));
/** Opening hours typed by the owner against the saved ones: the same times in the same order. */
export function hoursMatch(listed, expectedLines) {
  const a = times(listed), e = times(expectedLines.join(' '));
  return e.length > 0 && a.length === e.length && a.every((t, i) => t === e[i]);
}

// ---------- text scan ----------
const PHONE_RE = /(?<!\d)(?:\+|00)?(?:880[\s-]?)?0?1[3-9](?:[\s-]?\d){8}(?!\d)/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
/** Phone numbers and e-mails inside a text. */
export function extractContacts(text) {
  const t = String(text ?? '');
  return { phones: [...(t.match(PHONE_RE) || [])].map(x => x.trim()), emails: t.match(EMAIL_RE) || [] };
}
/** Every string of the content settings (except social links) with its path. Bounded. */
export function contentStrings(content, max = 400) {
  const out = [];
  const walk = (v, path, depth) => {
    if (out.length >= max || depth > 7) return;
    if (typeof v === 'string') { if (v) out.push({ path, text: v }); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1));
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) if (k !== 'social') walk(x, path ? `${path}.${k}` : k, depth + 1);
  };
  walk(content, 'content', 0);
  return out;
}

// ---------- JSON-LD ----------
/** The Store / Organization block of a previewMeta result, or null. */
export function storeBlock(meta) {
  const items = (Array.isArray(meta?.ld) ? meta.ld : []).flatMap(x => (Array.isArray(x) ? x : [x])).filter(isObj);
  const typed = items.filter(x => [].concat(x['@type'] || []).some(t => /^(Store|Organization|LocalBusiness|ElectronicsStore)$/.test(t)));
  return typed.find(x => String(x['@id'] || '').endsWith('#store')) || typed[0] || null;
}

// ---------- rows ----------
const row = (field, place, value, expected, match, severity, note = '') => ({ field, place, value: value ?? '', expected: expected ?? '', match: !!match, severity: match ? 'info' : severity, note });

function ldRows(place, block, info, { skipAddress }) {
  if (!block) return [row('store block', place, '', 'Store or Organization data', false, 'error', 'No Store or Organization structured data was found on this page')];
  const out = [], pa = block.address || {};
  out.push(row('phone', place, block.telephone || '', info.phone, info.phone ? phonesMatch(block.telephone, info.phone) : !block.telephone, 'error', info.phone ? '' : 'No phone is saved'));
  out.push(row('email', place, block.email || '', info.email, normEmail(block.email) === normEmail(info.email), 'error'));
  if (!skipAddress) {
    out.push(row('address', place, pa.streetAddress || '', info.address, addressesMatch(pa.streetAddress, info.address), 'error'));
    if (info.postalCode) out.push(row('postal code', place, pa.postalCode || '', info.postalCode, String(pa.postalCode || '') === info.postalCode, 'error'));
    if (info.locality) out.push(row('city', place, pa.addressLocality || '', info.locality, normText(pa.addressLocality) === normText(info.locality), 'error'));
  }
  if (info.legalName) out.push(row('legal name', place, block.legalName || '', info.legalName, normText(block.legalName) === normText(info.legalName), 'warning', 'The page does not use the saved legal name yet'));
  if (info.priceRange) out.push(row('price range', place, block.priceRange || '', info.priceRange, normText(block.priceRange) === normText(info.priceRange), 'warning', 'The page does not use the saved price range yet'));
  const sameAs = [].concat(block.sameAs || []).map(String);
  const links = Object.values(info.social || {});
  if (links.length) {
    const missing = links.filter(u => !sameAs.includes(u));
    out.push(row('social links', place, sameAs.join(', '), links.join(', '), missing.length === 0, 'warning', missing.length ? `Missing on the page: ${missing.join(', ')}` : ''));
  }
  return out;
}

/** The whole comparison, pure: every input is data. */
export function buildNapRows({ info, siteRow = {}, home = null, contact = null, content = {}, gbp = {} }) {
  const rows = [];
  const site = isObj(siteRow) ? siteRow : {};
  // settings
  if (!String(site.address || '').trim()) rows.push(row('address', 'Settings (site)', '', 'A full address', false, 'warning', 'No address is saved in the shop settings'));
  if (!String(site.phone || '').trim()) rows.push(row('phone', 'Settings (site)', '', 'A phone number', false, 'warning', 'No phone is saved in the shop settings'));
  if (!String(site.email || '').trim()) rows.push(row('email', 'Settings (site)', '', 'An e-mail address', false, 'warning', 'No e-mail is saved in the shop settings'));
  if (!info.legalName) rows.push(row('legal name', 'Settings (SEO)', '', 'The registered business name', false, 'info', 'No legal name is saved yet; add it in Business info'));
  if (info.whatsapp && info.phone && !phonesMatch(info.whatsapp, info.phone)) rows.push(row('whatsapp', 'Settings (site)', info.whatsapp, info.phone, false, 'info', 'The WhatsApp number differs from the phone number (fine if it is a separate line)'));

  // structured data of the pages
  const noAddress = !info.address;
  if (noAddress) rows.push(row('address', 'Home page structured data', home?.address?.streetAddress || '', 'A saved address', false, 'warning', DEFAULT_ADDRESS_NOTE));
  rows.push(...ldRows('Home page structured data', home, info, { skipAddress: noAddress }));
  rows.push(...ldRows('Contact page structured data', contact, info, { skipAddress: noAddress }));

  // texts
  const seen = new Set();
  for (const { path, text } of contentStrings(content)) {
    const { phones, emails } = extractContacts(text);
    for (const p of phones) {
      const k = path + '|' + normPhone(p); if (seen.has(k)) continue; seen.add(k);
      const ok = phonesMatch(p, info.phone) || phonesMatch(p, info.whatsapp);
      rows.push(row('phone', path, p, info.phone, ok, 'warning', ok ? '' : 'This number is not the saved phone or WhatsApp number'));
    }
    for (const m of emails) {
      const k = path + '|' + normEmail(m); if (seen.has(k)) continue; seen.add(k);
      rows.push(row('email', path, m, info.email, normEmail(m) === normEmail(info.email), 'warning', normEmail(m) === normEmail(info.email) ? '' : 'This e-mail is not the saved shop e-mail'));
    }
  }

  // manual Google Business Profile copy
  const g = isObj(gbp) ? gbp : {};
  const place = 'Google Business Profile (typed in)';
  if (!g.listedName && !g.listedPhone && !g.listedAddress && !g.listedHours) rows.push(row('profile copy', place, '', 'What your profile shows', false, 'info', 'Type in what your Google Business Profile shows to compare it'));
  else {
    if (g.listedName) { const ok = [info.name, info.legalName].filter(Boolean).some(n => normText(n) === normText(g.listedName)); rows.push(row('name', place, g.listedName, info.name, ok, 'error')); }
    if (g.listedPhone) rows.push(row('phone', place, g.listedPhone, info.phone, phonesMatch(g.listedPhone, info.phone), 'error'));
    if (g.listedAddress) rows.push(row('address', place, g.listedAddress, info.address, addressesMatch(g.listedAddress, info.address), 'error'));
    if (g.listedHours) {
      const lines = formatHours(info.hours);
      rows.push(lines.length ? row('hours', place, g.listedHours, lines.join('; '), hoursMatch(g.listedHours, lines), 'warning') : row('hours', place, g.listedHours, '', false, 'info', 'No opening hours are saved in Business info'));
    }
  }
  return rows;
}
export const countIssues = rows => rows.filter(r => !r.match && (r.severity === 'error' || r.severity === 'warning')).length;

// ---------- runner ----------
async function defaultDeps() {
  const sf = await import('./siteFiles.js');
  return { readGrowth: sf.readGrowth, saveGrowth: sf.saveGrowth, async previewMeta(p) { return (await import('../seo.js')).previewMeta(p); }, now: () => new Date() };
}
/** Runs the check now and stores the result in the growth row key `napLast` ({at, rows, issues}). deps are injectable. */
export async function runNapCheck(deps) {
  const d = withDeps({ ...(await defaultDeps()), ...(deps || {}) });
  const { info } = await getBusiness(d);
  const meta = async p => { try { return storeBlock(await d.previewMeta(p)); } catch { return undefined; } };
  const [home, contact] = [await meta('/'), await meta('/contact')];
  const [siteRow, content, gbp] = await Promise.all([
    Promise.resolve().then(d.readSite).catch(() => null), Promise.resolve().then(d.readContent).catch(() => null), getGbp(d)
  ]);
  const rows = [];
  if (home === undefined || contact === undefined) rows.push(row('pages', 'Structured data', '', 'The page can be rendered', false, 'warning', 'A page could not be rendered for the check'));
  rows.push(...buildNapRows({ info, siteRow: siteRow || {}, home: home ?? null, contact: contact ?? null, content: content || {}, gbp }));
  const res = { at: d.now().toISOString(), rows, issues: countIssues(rows) };
  await d.saveGrowth({ napLast: res });
  return res;
}
