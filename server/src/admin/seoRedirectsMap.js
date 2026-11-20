// Pure logic of the redirect manager and the 404 list (no database): validation, chain / loop analysis, flatten planning, list query parsing, summaries.
import { checkRedirect, normaliseRedirectPath, detectLoop } from '../redirects.js';

export const MAX_HOPS = 5;
export const RESERVED = /^\/(admin|api|hub|email|field|assets)(\/|$)/i;
export const SORTS = { hits: 'hits', last_hit: 'lastHit', created: 'createdAt', source: 'source' };
export const KINDS = ['all', 'auto', 'manual'];
export const SORTS_404 = { hits: 'hits', last_seen: 'lastSeen', first_seen: 'firstSeen' };
export const STATUS_404 = ['open', 'ignored', 'all'];

const isInternal = t => typeof t === 'string' && t.startsWith('/');
/** The path part of an internal target ('/shop?x=1' -> '/shop'); '' for an absolute URL. */
export const pathOfTarget = t => (isInternal(t) ? normaliseRedirectPath(t) : '');
/** Positive integer id or 0. */
export const posInt = v => { const n = Number(v); return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0; };

/** Validates a redirect. Returns { source, target, code } clean or throws Error with .status = 400. */
export function validateRedirect(input) {
  const bad = m => Object.assign(new Error(m), { status: 400 });
  let r;
  try { r = checkRedirect({ source: input?.source, target: input?.target, code: input?.code ?? 301 }); } catch (e) { throw bad(e.message); }
  if (r.source === '/') throw bad('The home page cannot be redirected');
  if (RESERVED.test(r.source)) throw bad('Addresses under /admin, /api, /hub, /email, /field and /assets cannot be redirected');
  return r;
}

/** Follows target -> source rows from `target`. Returns { hops, finalTarget, loop }. rows = [{source,target}], `own` = the starting row's source (a return to it is a loop). */
export function followChain(bySource, own, target) {
  const seen = new Set([own]);
  let cur = target, hops = 0;
  while (isInternal(cur)) {
    const key = pathOfTarget(cur);
    if (!key) break;
    if (seen.has(key)) return { hops, finalTarget: cur, loop: true };
    const next = bySource.get(key);
    if (next === undefined) break;
    if (hops >= MAX_HOPS) break;
    seen.add(key);
    cur = next;
    hops++;
  }
  return { hops, finalTarget: cur, loop: false };
}
const mapOf = rows => new Map((rows || []).map(r => [r.source, r.target]));

/** Adds hops / finalTarget / loop to every row (new objects). */
export function analyseRows(rows) {
  const by = mapOf(rows);
  return (rows || []).map(r => ({ ...r, ...followChain(by, r.source, r.target) }));
}

/** Summary counts of an analysed row list (rows with .auto, .hits, .hops, .loop, .targetOk). */
export function summarise(rows) {
  const s = { total: 0, auto: 0, manual: 0, hits: 0, chains: 0, loops: 0, deadTargets: 0 };
  for (const r of rows || []) {
    s.total++;
    if (r.auto) s.auto++; else s.manual++;
    s.hits += Number(r.hits) || 0;
    if (r.hops >= 1 && !r.loop) s.chains++;
    if (r.loop) s.loops++;
    if (r.targetOk === false) s.deadTargets++;
  }
  return s;
}

/** Plan to repoint every chained redirect straight to its final target. Loops are skipped and reported. */
export function planFlatten(rows) {
  const fix = [], loops = [];
  for (const r of analyseRows(rows)) {
    if (r.loop) loops.push({ id: r.id, source: r.source });
    else if (r.hops >= 1 && r.finalTarget !== r.target) fix.push({ id: r.id, source: r.source, from: r.target, to: r.finalTarget });
  }
  return { fix, loops };
}

/**
 * Plans a create (or an update, with the row's own source in `source`). rows = every existing row [{id,source,target}].
 * Returns { loop, target (final), warnings, flattened } ; `flattened` lists other rows whose target is this source and must be repointed.
 */
export function planRedirect(rows, { source, target }) {
  const others = (rows || []).filter(r => r.source !== source);
  if (detectLoop(others, source, target)) return { loop: true, target, warnings: [], flattened: [] };
  const by = mapOf(others);
  const f = followChain(by, source, target);
  if (f.loop) return { loop: true, target, warnings: [], flattened: [] };
  const warnings = [];
  let final = target;
  if (f.hops >= 1 && f.finalTarget !== target) {
    final = f.finalTarget;
    warnings.push(`The new address is itself redirected, so the final address ${final} was saved instead`);
  }
  if (final === source) return { loop: true, target, warnings: [], flattened: [] };
  const flattened = others.filter(r => pathOfTarget(r.target) === source && r.target !== final).map(r => ({ id: r.id, source: r.source, from: r.target, to: final }));
  return { loop: false, target: final, warnings, flattened };
}

/** Is an internal path a live page? live = { exact:Set, products:Set, categories:Set, brands:Set, blog:Set, pages:Set, policies:Set } of ids / slugs. */
export function pathIsLive(path, live) {
  const p = pathOfTarget(path);
  if (!p) return false;
  if (live.exact?.has(p)) return true;
  const m = p.match(/^\/(product|shop|brand|blog|services|policy)\/([^/]+)$/);
  if (!m) return false;
  let seg = m[2];
  try { seg = decodeURIComponent(seg); } catch { /* keep */ }
  const set = { product: live.products, shop: live.categories, brand: live.brands, blog: live.blog, services: live.pages, policy: live.policies }[m[1]];
  return !!set?.has(seg);
}
/** true | false | null: null for an absolute URL (unknown). Follows the final target. */
export const targetOkOf = (finalTarget, live) => (isInternal(finalTarget) ? pathIsLive(finalTarget, live) : null);

const clampStr = (v, n) => String(Array.isArray(v) ? v[0] : v ?? '').trim().slice(0, n);
const pick = (v, allowed, dflt) => { const s = clampStr(v, 20).toLowerCase(); return allowed.includes(s) ? s : dflt; };
function paging(query) {
  const size = Math.min(100, Math.max(10, parseInt(query.size, 10) || 25));
  const page = Math.min(1000000, Math.max(1, parseInt(query.page, 10) || 1));
  return { size, page };
}
/** Whitelisted list query for /seo/redirects. */
export function parseRedirectQuery(query = {}) {
  const sort = pick(query.sort, Object.keys(SORTS), 'created');
  return { q: clampStr(query.q, 200).toLowerCase(), kind: pick(query.kind, KINDS, 'all'), sort, dir: pick(query.dir, ['asc', 'desc'], 'desc'), ...paging(query) };
}
/** Whitelisted list query for /seo/404. */
export function parse404Query(query = {}) {
  const sort = pick(query.sort, Object.keys(SORTS_404), 'hits');
  return { q: clampStr(query.q, 200).toLowerCase(), status: pick(query.status, STATUS_404, 'open'), sort, dir: pick(query.dir, ['asc', 'desc'], 'desc'), ...paging(query) };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const time = v => (v ? new Date(v).getTime() || 0 : 0);
/** Filters (q on source / target, kind), sorts and pages analysed rows. Returns { total, rows }. */
export function listRedirects(rows, query) {
  const { q, kind, sort, dir, page, size } = query;
  let out = (rows || []).filter(r => (kind === 'all' || (kind === 'auto') === !!r.auto) && (!q || r.source.toLowerCase().includes(q) || String(r.target).toLowerCase().includes(q)));
  const key = SORTS[sort];
  const val = r => (key === 'lastHit' || key === 'createdAt' ? time(r[key]) : key === 'hits' ? Number(r.hits) || 0 : r.source.toLowerCase());
  const sign = dir === 'asc' ? 1 : -1;
  out = out.slice().sort((a, b) => sign * cmp(val(a), val(b)) || cmp(a.id, b.id));
  return { total: out.length, rows: out.slice((page - 1) * size, page * size) };
}

/** Does the 404 path look like something the monitor should never need (used by the admin list, mirrors notFoundLog)? */
export const redirectSourceSet = rows => new Set((rows || []).map(r => r.source));
