// Pure helpers of the Search Console sync (no database, no network): date windows, URL <-> product mapping, URL Inspection result mapping,
// index classification, batch selection and the small route validators.
import { createHash } from 'node:crypto';
import { productPath, legacySlug } from '../slug.js';

export const DAY = 86400e3, DHAKA_MS = 6 * 3600e3, LAG_DAYS = 2, DAILY_LIMIT = 400, BATCH_LIMIT = 60, MIN_AGE_MS = 24 * 3600e3;
export const NOT_ADDED = 'This website is not added in Search Console yet';

export const urlHash = url => createHash('sha1').update(String(url)).digest('hex');
/** 'YYYY-MM-DD' of now in Asia/Dhaka (UTC+6, no daylight saving). */
export const dhakaDate = (now = Date.now()) => new Date(Number(now) + DHAKA_MS).toISOString().slice(0, 10);
export const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
/** The instant the current Dhaka day started. */
export const dhakaDayStart = (now = Date.now()) => new Date(Math.floor((Number(now) + DHAKA_MS) / DAY) * DAY - DHAKA_MS);

/** Search Console data lags about 2 days. daily = last 90 days; cur = 28 days; prev = the 28 days before. */
export function windows(now = Date.now()) {
  const end = addDays(dhakaDate(now), -LAG_DAYS);
  return {
    end,
    daily: { startDate: addDays(end, -89), endDate: end },
    cur: { startDate: addDays(end, -27), endDate: end },
    prev: { startDate: addDays(end, -55), endDate: addDays(end, -28) }
  };
}

/** Picks the Search Console property for a host from listSites().sites: the exact URL-prefix property first, else the domain property. '' when none. */
export function pickProperty(sites, host) {
  const h = String(host || '').toLowerCase();
  if (!h) return '';
  const ok = (sites || []).filter(s => s?.siteUrl && s.permissionLevel !== 'siteUnverifiedUser').map(s => String(s.siteUrl));
  const exact = ok.find(u => u.toLowerCase() === `https://${h}/`) || ok.find(u => u.toLowerCase() === `http://${h}/`);
  if (exact) return exact;
  return ok.find(u => { const m = /^sc-domain:(.+)$/i.exec(u); return m && (h === m[1].toLowerCase() || h.endsWith('.' + m[1].toLowerCase())); }) || '';
}

/** Path -> product id map over the product list (stored slug and the old id form). */
export function buildProductMap(products) {
  const m = new Map();
  for (const p of products || []) { const id = Number(p.id); if (id > 0) { m.set(productPath(p), id); m.set('/product/' + legacySlug(p), id); } }
  return m;
}
const pathOf = u => { try { let p = decodeURIComponent(new URL(u).pathname); if (p.length > 1) p = p.replace(/\/+$/, ''); return p; } catch { return ''; } };
/** Product id of an absolute product page address, 0 when it is not a product page. */
export const productIdForUrl = (url, map) => map.get(pathOf(url)) || 0;
export const isProductUrl = url => pathOf(url).startsWith('/product/');
/** Product pages first, then the rest in their original order; duplicates dropped. */
export function orderUrls(urls) {
  const seen = new Set(), prod = [], rest = [];
  for (const u of urls || []) { if (typeof u !== 'string' || seen.has(u)) continue; seen.add(u); (isProductUrl(u) ? prod : rest).push(u); }
  return [...prod, ...rest];
}
/** Moves an address onto the public origin (the sitemap may have been built from another host). '' when it is not http(s). */
export function onOrigin(url, origin) {
  try { const u = new URL(url), o = new URL(origin); if (!/^https?:$/.test(u.protocol)) return ''; return o.origin + u.pathname + u.search; } catch { return ''; }
}

/** The inspection result of the API -> flat fields (strings cut to their column size). */
export function mapInspection(data) {
  const r = data?.inspectionResult?.indexStatusResult || {};
  const s = (v, n) => String(v ?? '').slice(0, n);
  const t = r.lastCrawlTime ? new Date(r.lastCrawlTime) : null;
  return { verdict: s(r.verdict, 20), coverageState: s(r.coverageState, 160), indexingState: s(r.indexingState, 60), robotsState: s(r.robotsTxtState, 40), fetchState: s(r.pageFetchState, 40), lastCrawl: t && !isNaN(t) ? t : null, googleCanonical: s(r.googleCanonical, 500), userCanonical: s(r.userCanonical, 500) };
}

const REASONS = [
  [/crawled\s*-?\s*currently not indexed/i, 'Google visited the page but chose not to index it yet. Improve the page content or add links to it.'],
  [/discovered\s*-?\s*currently not indexed/i, 'Google knows the page but has not visited it yet. It usually needs more time or more links to the page.'],
  [/soft 404/i, 'Google thinks the page is empty and treats it like a missing page.'],
  [/duplicate|alternate page with proper canonical/i, 'Google treats this page as a copy of another page and indexes the other one.'],
  [/redirect/i, 'This address redirects to another page, so the other page is the one indexed.'],
  [/not found|404/i, 'The page was not found (404). Remove it from the sitemap or restore the page.'],
  [/noindex/i, 'The page tells Google not to index it (noindex).'],
  [/blocked by robots/i, 'The page is blocked by the robots.txt file.'],
  [/server error|5xx/i, 'The server returned an error when Google visited the page.'],
  [/excluded|not indexed|unknown to google|url is not on google/i, 'Google has not indexed this page.']
];
/** { classification: 'indexed'|'not_indexed'|'unknown', coverageNote } of an inspection row (verdict + coverageState). Pure. */
export function classifyFull(row) {
  const verdict = String(row?.verdict || '').toUpperCase(), cs = String(row?.coverageState ?? row?.coverage_state ?? '');
  if (verdict === 'PASS') return { classification: 'indexed', coverageNote: '' };
  if (verdict === 'FAIL' || verdict === 'NEUTRAL' || verdict === 'PARTIAL') {
    const hit = REASONS.find(([re]) => re.test(cs));
    if (hit) return { classification: 'not_indexed', coverageNote: hit[1] };
    if (verdict === 'FAIL') return { classification: 'not_indexed', coverageNote: 'Google reports a problem with this page' + (cs ? ': ' + cs : '.') };
  }
  return { classification: 'unknown', coverageNote: '' };
}
export const classify = row => classifyFull(row).classification;

/**
 * Which URLs to inspect now. urls = ordered candidates; done = Map url_hash -> Date of the last inspection (absent/null = never).
 * Never-inspected first (list order), then the oldest inspection (younger than minAgeMs is skipped); at most `limit`, and never more
 * than the daily budget left (dailyLimit - usedToday).
 */
export function selectBatch(urls, done, { limit = BATCH_LIMIT, usedToday = 0, dailyLimit = DAILY_LIMIT, now = Date.now(), minAgeMs = MIN_AGE_MS } = {}) {
  const n = Math.max(0, Math.min(limit, dailyLimit - usedToday));
  if (!n) return [];
  const fresh = [], old = [];
  urls.forEach((u, i) => {
    const at = done.get(urlHash(u));
    if (!at) fresh.push(u); else if (now - new Date(at).getTime() >= minAgeMs) old.push({ u, t: new Date(at).getTime(), i });
  });
  old.sort((a, b) => a.t - b.t || a.i - b.i);
  return [...fresh, ...old.map(o => o.u)].slice(0, n);
}

/** Checks an address typed by staff belongs to this site: { ok, url, error }. */
export function validateSiteUrl(url, origin) {
  const raw = String(url ?? '').trim();
  if (!raw || raw.length > 500) return { ok: false, url: '', error: 'Enter a page address (max 500 characters)' };
  let u, o;
  try { u = new URL(raw); o = new URL(origin); } catch { return { ok: false, url: '', error: 'That is not a valid web address' }; }
  if (!/^https?:$/.test(u.protocol) || u.host.toLowerCase() !== o.host.toLowerCase()) return { ok: false, url: '', error: 'The address must be a page of this website (' + o.host + ')' };
  return { ok: true, url: o.origin + u.pathname + u.search, error: '' };
}
/** Sliding-window limiter: mutates `list`, returns false when `max` calls were already made within `windowMs`. */
export function allow(list, now = Date.now(), max = 20, windowMs = 600e3) {
  while (list.length && now - list[0] >= windowMs) list.shift();
  if (list.length >= max) return false;
  list.push(now); return true;
}
export const CONSOLE_HOME = 'https://search.google.com/search-console';
/** Best effort only: Search Console has no documented deep link; this form opens the URL Inspection page, and the console home is the fallback. */
export const deepLink = (siteUrl, url) => (siteUrl && url ? `${CONSOLE_HOME}/inspect?resource_id=${encodeURIComponent(siteUrl)}&id=${encodeURIComponent(url)}` : CONSOLE_HOME);

/** Percent change; null when the earlier value is 0. */
export const pctDelta = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
/** Sums daily rows: ctr = clicks / impressions, position = impression-weighted average. */
export function totals(rows) {
  let clicks = 0, impressions = 0, pos = 0;
  for (const r of rows) { clicks += Number(r.clicks) || 0; const i = Number(r.impressions) || 0; impressions += i; pos += (Number(r.position) || 0) * i; }
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? Math.round((pos / impressions) * 10) / 10 : 0 };
}
/** Percent change for clicks / impressions / ctr, point change for position; null when the earlier value is 0. */
export function deltas(cur, prev) {
  return { clicks: pctDelta(cur.clicks, prev.clicks), impressions: pctDelta(cur.impressions, prev.impressions), ctr: pctDelta(cur.ctr, prev.ctr), position: prev.position ? Math.round((cur.position - prev.position) * 10) / 10 : null };
}
