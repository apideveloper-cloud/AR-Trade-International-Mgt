// Link checker of the backlink tracker: an SSRF-safe page fetch, an anchor scan, the status state machine and the run loop.
// Staff type the addresses that are fetched here, so every request (and every redirect hop) is checked before it is made.
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { pool } from '../db.js';
import { siteOrigin } from './site.js';
import { ensureBacklinks, STATUSES } from './backlinks.js';

export const MAX_REDIRECTS = 3, TIMEOUT_MS = 10000, MAX_BYTES = 1024 * 1024, MAX_PER_RUN = 200, PAUSE_MS = 300, STRIKE_GAP_MS = 6 * 24 * 3600e3;

// ---- address rules ----
function v4parts(s) { const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s); if (!m) return null; const p = m.slice(1).map(Number); return p.every(n => n <= 255) ? p : null; }
function v6groups(s) {
  s = s.toLowerCase().split('%')[0];
  const m = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (m) { const p = v4parts(m[2]); if (!p) return null; s = m[1] + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16); }
  const halves = s.split('::'); if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [], rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < (halves.length === 2 ? 1 : 0) || (halves.length === 1 && head.length !== 8)) return null;
  const all = [...head, ...Array(fill).fill('0'), ...rest];
  if (all.length !== 8 || !all.every(g => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map(g => parseInt(g, 16));
}
/** True when the address is not a normal public internet address (loopback, private, link-local, unique-local, metadata, multicast, unspecified, unparsable). */
export function isBlockedIp(ip) {
  ip = String(ip || '').trim().replace(/^\[|\]$/g, '');
  const a = v4parts(ip);
  if (a) {
    const [x, y] = a;
    return x === 0 || x === 10 || x === 127 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127) || (x === 198 && (y === 18 || y === 19)) || (x === 192 && y === 0 && a[2] === 0) || x >= 224;
  }
  const g = v6groups(ip);
  if (!g) return true;
  if (g.every(n => n === 0)) return true; // ::
  if (g.slice(0, 7).every(n => n === 0) && g[7] === 1) return true; // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return true; // fe80::/10 and old site-local
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g.slice(0, 5).every(n => n === 0) && (g[5] === 0xffff || g[5] === 0)) return isBlockedIp(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`); // IPv4-mapped / compatible
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(n => n === 0)) return isBlockedIp(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`); // NAT64
  return false;
}

const BLOCKED = 'Blocked: this address is not allowed';
const blocked = why => ({ ok: false, blocked: true, error: BLOCKED, why });

// ---- the default network layer: node http(s) with the already-checked address pinned, so DNS cannot change between the check and the connection ----
export function pinnedFetch(url, { signal, headers, address, family, maxBytes = MAX_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      protocol: u.protocol, hostname: u.hostname.replace(/^\[|\]$/g, ''), port: u.port || undefined, path: u.pathname + u.search, method: 'GET', headers, signal, servername: u.hostname.replace(/^\[|\]$/g, ''),
      lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address, family }]) : cb(null, address, family)),
    }, r => {
      const chunks = []; let n = 0, done = false;
      const finish = () => { if (done) return; done = true; const buf = Buffer.concat(chunks); resolve({ status: r.statusCode, headers: { get: k => { const v = r.headers[String(k).toLowerCase()]; return Array.isArray(v) ? v[0] : v ?? null; } }, text: async () => buf.toString('utf8') }); };
      r.on('data', c => { if (done) return; n += c.length; chunks.push(c); if (n >= maxBytes) { r.destroy(); finish(); } });
      r.on('end', finish); r.on('close', finish); r.on('error', e => { if (!done) { done = true; reject(e); } });
    });
    req.on('error', reject); req.end();
  });
}
const defaultDns = async host => dns.lookup(host, { all: true, verbatim: true });

/**
 * SSRF-safe GET. deps: { dns(host)->[{address,family}], fetch(url, init), timeoutMs, maxBytes, maxRedirects, site }.
 * Returns { ok:true, status, body, finalUrl, truncated, redirects } or { ok:false, blocked?, error }.
 */
export async function safeFetch(url, deps = {}) {
  const lookup = deps.dns || defaultDns, doFetch = deps.fetch || pinnedFetch;
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS, maxBytes = deps.maxBytes ?? MAX_BYTES, maxRedirects = deps.maxRedirects ?? MAX_REDIRECTS;
  const deadline = Date.now() + timeoutMs, ctl = new AbortController();
  let timer; const timeout = new Promise((_, rej) => { timer = setTimeout(() => { ctl.abort(); rej(Object.assign(new Error('timeout'), { timeout: true })); }, timeoutMs); });
  timeout.catch(() => {});
  const run = async () => {
    let cur = String(url || '');
    for (let hop = 0; ; hop++) {
      let u; try { u = new URL(cur); } catch { return blocked('bad address'); }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return blocked('scheme');
      if (u.username || u.password) return blocked('credentials');
      const port = u.port || (u.protocol === 'https:' ? '443' : '80');
      if (port !== '80' && port !== '443') return blocked('port');
      const host = u.hostname.replace(/^\[|\]$/g, '');
      if (!host || /^localhost$/i.test(host) || /\.localhost$/i.test(host)) return blocked('localhost');
      if ((v4parts(host) || host.includes(':')) && isBlockedIp(host)) return blocked('private address'); // an IP typed in the address is judged as it is, never trusted to a resolver
      let addrs;
      try { addrs = await lookup(host); } catch { return { ok: false, error: 'Could not load: address not found' }; }
      if (typeof addrs === 'string') addrs = [{ address: addrs, family: addrs.includes(':') ? 6 : 4 }];
      if (!Array.isArray(addrs) || !addrs.length) return { ok: false, error: 'Could not load: address not found' };
      if (addrs.some(a => isBlockedIp(a.address))) return blocked('private address');
      const pick = addrs[0];
      if (Date.now() > deadline) return { ok: false, error: 'Could not load: timeout' };
      const res = await doFetch(cur, {
        method: 'GET', redirect: 'manual', signal: ctl.signal, address: pick.address, family: pick.family || (pick.address.includes(':') ? 6 : 4), maxBytes,
        headers: { 'User-Agent': `ARTradeLinkChecker/1.0 (+${deps.site || 'site'})`, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
      });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers?.get?.('location');
        if (!loc) return { ok: true, status: res.status, body: '', finalUrl: cur, truncated: false, redirects: hop };
        if (hop >= maxRedirects) return { ok: false, error: 'Could not load: too many redirects' };
        try { cur = new URL(loc, cur).toString(); } catch { return blocked('bad redirect'); }
        continue;
      }
      let body = ''; try { body = String((await res.text()) ?? ''); } catch { body = ''; }
      let truncated = false;
      if (Buffer.byteLength(body) > maxBytes) { body = Buffer.from(body).subarray(0, maxBytes).toString('utf8'); truncated = true; }
      return { ok: true, status: res.status, body, finalUrl: cur, truncated, redirects: hop };
    }
  };
  try { return await Promise.race([run(), timeout]); }
  catch (e) { return { ok: false, error: e.timeout || e.name === 'AbortError' ? 'Could not load: timeout' : 'Could not load: ' + String(e.code || e.message || 'error').slice(0, 60) }; }
  finally { clearTimeout(timer); }
}

// ---- anchor scan ----
const attr = (tag, name) => { const m = new RegExp(`[\\s"'/]${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag); return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null; };
const unescapeHtml = s => s.replace(/&amp;/gi, '&').replace(/&#38;/g, '&').replace(/&quot;/gi, '"').replace(/&#x2f;/gi, '/').replace(/&#47;/g, '/');
const bareHost = h => String(h || '').toLowerCase().replace(/^www\./, '');
const norm = u => u.protocol + '//' + u.host.toLowerCase() + u.pathname.replace(/\/+$/, '') + u.search;

/** Finds our link in a page. base = the page address (to resolve relative links), origin = 'https://ourhost', target = the page it should point to. */
export function scanLinks(html, { base, origin, target } = {}) {
  const ourHost = (() => { try { return bareHost(new URL(origin).hostname); } catch { return ''; } })();
  let tgt = null; try { tgt = target ? new URL(target, origin || undefined) : null; } catch { tgt = null; }
  const re = /<a\b[^>]*>/gi; let m, n = 0;
  while ((m = re.exec(String(html || ''))) && n++ < 20000) {
    const href = attr(m[0], 'href'); if (href == null) continue;
    let u; try { u = new URL(unescapeHtml(href.trim()), base); } catch { continue; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    const hostHit = ourHost && bareHost(u.hostname) === ourHost, tgtHit = tgt && norm(u) === norm(tgt);
    if (hostHit || tgtHit) return { linkFound: true, rel: (attr(m[0], 'rel') || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: u.toString() };
  }
  return { linkFound: false, rel: '', href: '' };
}

/** Checks one row. deps: safeFetch deps plus origin (a string; default: the preferred domain). Never throws. */
export async function checkBacklink(row, deps = {}) {
  try {
    const origin = deps.origin ?? await (deps.siteOrigin || siteOrigin)();
    const r = await safeFetch(row.url, { ...deps, site: deps.site || origin || undefined });
    if (!r.ok) return { ok: false, httpStatus: null, linkFound: null, rel: '', note: r.error, blocked: !!r.blocked };
    if (r.status === 404 || r.status === 410) return { ok: true, httpStatus: r.status, linkFound: false, rel: '', note: `Page not found (${r.status})` };
    if (r.status >= 500) return { ok: false, httpStatus: r.status, linkFound: null, rel: '', note: `Could not load: the site had an error (${r.status})` };
    if (r.status >= 300) return { ok: false, httpStatus: r.status, linkFound: null, rel: '', note: `Could not load: the site answered ${r.status}` };
    const s = scanLinks(r.body, { base: r.finalUrl, origin, target: row.target });
    return { ok: true, httpStatus: r.status, linkFound: s.linkFound, rel: s.rel, note: s.linkFound ? 'Link found' : 'Page loads but has no link to your site' };
  } catch (e) { return { ok: false, httpStatus: null, linkFound: null, rel: '', note: 'Could not load: ' + String(e.message || e).slice(0, 60) }; }
}

/** Rows the checker looks at: anything with a page address except Rejected. Planned rows without an address are skipped. */
export const isEligible = row => !!row && row.status !== 'Rejected' && STATUSES.includes(row.status) && !!String(row.url || '').trim();

/**
 * Pure state machine. Returns the columns to write, or null when the row is skipped.
 * Found: Planned/Submitted/Live/Lost -> Live, strikes reset. Not found: Submitted/Planned stay; Live gets a strike (at most one per ~week) and becomes Lost on the second.
 * A page that could not be checked (timeout, blocked, 5xx) changes nothing but the time and the note.
 */
export function applyCheck(row, result, now = new Date()) {
  if (!isEligible(row)) return null;
  const patch = { last_checked: now, http_status: result.httpStatus ?? null };
  if (!result.ok || result.linkFound == null) return { ...patch, status: row.status, link_found: row.link_found ?? null, rel: row.rel || '', fail_count: row.fail_count || 0 };
  if (result.linkFound) return { ...patch, status: 'Live', link_found: 1, rel: result.rel || '', fail_count: 0 };
  let status = row.status, fails = row.fail_count || 0;
  if (row.status === 'Live') {
    const last = row.last_checked ? new Date(row.last_checked).getTime() : 0;
    if (!last || now.getTime() - last >= STRIKE_GAP_MS) { fails += 1; if (fails >= 2) status = 'Lost'; }
  }
  return { ...patch, status, link_found: 0, rel: '', fail_count: Math.min(fails, 100) };
}

const sleepReal = ms => new Promise(r => setTimeout(r, ms));
const defaultQuery = (sql, p) => pool.query(sql, p);
/** Checks one row and saves the outcome. Returns { row, result } (row null if it vanished). */
export async function checkAndSave(row, deps = {}) {
  const q = deps.query || defaultQuery, now = deps.now ? deps.now() : new Date();
  const result = await (deps.check || checkBacklink)(row, deps);
  const p = applyCheck(row, result, now);
  if (p) await q('UPDATE growth_backlinks SET status = ?, link_found = ?, rel = ?, http_status = ?, last_checked = ?, fail_count = ? WHERE id = ?', [p.status, p.link_found, p.rel, p.http_status, p.last_checked, p.fail_count, row.id]);
  return { result, patch: p };
}

/** Weekly (or manual) run. deps: { query, sleep, check, now, + safeFetch deps }. Returns counters; a row that blows up never stops the run. */
export async function runLinkCheck({ id, deps = {} } = {}) {
  const q = deps.query || defaultQuery, sleep = deps.sleep || sleepReal;
  await ensureBacklinks(q);
  const [rows] = id
    ? await q('SELECT * FROM growth_backlinks WHERE id = ?', [id])
    : await q("SELECT * FROM growth_backlinks WHERE status <> 'Rejected' AND url <> '' ORDER BY (last_checked IS NULL) DESC, last_checked, id LIMIT ?", [MAX_PER_RUN]);
  const out = { total: rows.length, checked: 0, found: 0, notFound: 0, lost: 0, errors: 0, skipped: 0 };
  const list = rows.filter(isEligible).slice(0, MAX_PER_RUN);
  out.skipped = rows.length - list.length;
  for (let i = 0; i < list.length; i++) {
    if (i > 0) await sleep(PAUSE_MS);
    try {
      const { result, patch } = await checkAndSave(list[i], deps);
      out.checked++;
      if (!result.ok) out.errors++; else if (result.linkFound) out.found++; else out.notFound++;
      if (patch && patch.status === 'Lost' && list[i].status !== 'Lost') out.lost++;
    } catch { out.errors++; }
  }
  return out;
}
