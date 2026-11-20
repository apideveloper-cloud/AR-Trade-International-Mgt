// SEO automation: purge the cached pages after every admin save and (optionally) tell IndexNow about changed URLs.
// Pure helpers + one small stateful queue. No timers or database access at import; everything outside is injectable for tests.
import crypto from 'node:crypto';
import { productPath } from './slug.js';

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const DEBOUNCE_MS = 60000;
export const BATCH_SIZE = 100;
export const PING_TIMEOUT_MS = 12000;

export const generateIndexNowKey = () => crypto.randomBytes(16).toString('hex');

// ---------- which admin writes change public pages ----------
const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SEO_ITEM_KIND = { product: 'product', category: 'category', brand: 'brand', blog: 'blog', page: 'page' };

/** Strips the host, query string and the /api/admin prefix; returns the segments. */
function segmentsOf(path) {
  let p = String(path || '').split('?')[0].split('#')[0];
  p = p.replace(/^\/api\/admin(?=\/|$)/, '');
  return p.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch { return s; } });
}

/** null (does not change public pages) or { kind, id } for a write that does. id is '' when unknown (a create). */
export function classifyAdminWrite(method, path) {
  if (!WRITE.has(String(method || '').toUpperCase())) return null;
  const [a, b, c, d] = segmentsOf(path);
  if (!a) return null;
  if (a === 'products') return { kind: 'product', id: b || '' }; // /products, /products/:id, /products/:id/specs
  if (a === 'categories') return { kind: 'category', id: b || '' };
  if (a === 'brands') return { kind: 'brand', id: b || '' };
  if (a === 'blog') return { kind: 'blog', id: b || '' };
  if (a === 'pages') return { kind: 'page', id: b || '' };
  if (a === 'content') return { kind: 'other', id: b || '' }; // site content sections (home, footer, ...)
  if (a === 'settings' && !b) return { kind: 'settings', id: '' };
  if (a === 'seo') {
    if (!b) return null;
    if (b === 'settings' || b === 'robots') return { kind: 'settings', id: '' };
    if (b === 'brands' && c) return { kind: 'brand', id: c };
    if (b === 'item' && SEO_ITEM_KIND[c] && d) return { kind: SEO_ITEM_KIND[c], id: d };
    if (SEO_ITEM_KIND[b] && c) return { kind: SEO_ITEM_KIND[b], id: c }; // /seo/product/:id/slug, /seo/product/:id/alt-autofill, /seo/blog/:slug/slug
    if (['bulk', 'recalculate', 'redirects', 'history', 'import'].includes(b)) {
      if (b === 'import' && c !== 'apply') return null; // preview only
      return { kind: 'seo', id: '' };
    }
    return null; // automation, preview, 404 monitor, ...
  }
  return null;
}

// ---------- URLs ----------
const trimBase = base => String(base || '').replace(/\/+$/, '');
/** Absolute public URL of a row, or '' when it cannot be built. */
export function urlOf(kind, row, base) {
  const b = trimBase(base);
  if (!b || !row) return '';
  let path = '';
  if (kind === 'product') path = row.id !== undefined || row.slug ? productPath(row) : '';
  else if (kind === 'category') path = row.id !== undefined && row.id !== null && row.id !== '' ? '/shop/' + row.id : '';
  else if (kind === 'brand') path = row.slug ? '/brand/' + row.slug : '';
  else if (kind === 'blog') path = row.slug ? '/blog/' + row.slug : '';
  else if (kind === 'page') path = row.slug ? '/services/' + row.slug : '';
  return path ? b + path : '';
}

/** One batched lookup (at most one SELECT) of the affected public URLs. `query(sql, params)` resolves to rows. */
export async function resolveUrls({ kind, id }, body, base, query) {
  const b = trimBase(base);
  if (!b) return [];
  const bid = body && typeof body === 'object' ? body : {};
  const key = String(id || bid.id || bid.slug || '');
  if (kind === 'settings' || kind === 'other' || kind === 'seo') return [b + '/'];
  if (kind === 'category') return key ? [b + '/shop/' + key] : [];
  if (kind === 'brand') return key ? [b + '/brand/' + key] : [];
  const numeric = /^\d+$/.test(key);
  if (kind === 'product') {
    if (!numeric) return [];
    const rows = await query('SELECT id, name, slug FROM products WHERE id = ?', [key]);
    return rows.map(r => urlOf('product', r, b)).filter(Boolean);
  }
  if (kind === 'blog' || kind === 'page') {
    if (!key) return [];
    const table = kind === 'blog' ? 'blog_posts' : 'site_pages';
    const rows = await query(`SELECT slug FROM ${table} WHERE ${numeric ? 'id' : 'slug'} = ?`, [key]);
    const out = rows.map(r => urlOf(kind, r, b)).filter(Boolean);
    if (!out.length && !numeric && bid.slug !== undefined) return [urlOf(kind, { slug: key }, b)].filter(Boolean);
    return out;
  }
  return [];
}

// ---------- the IndexNow ping ----------
/** Never throws. Resolves { ok, status, error }. 200 and 202 are success. */
export async function pingIndexNow({ fetchImpl, host, key, urls, timeoutMs = PING_TIMEOUT_MS } = {}) {
  const f = fetchImpl || globalThis.fetch;
  if (typeof f !== 'function') return { ok: false, status: 0, error: 'fetch is not available' };
  if (!host || !key || !Array.isArray(urls) || !urls.length) return { ok: false, status: 0, error: 'Nothing to send (host, key and urls are required)' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await f(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls }),
      signal: ctl.signal
    });
    const status = Number(res?.status) || 0;
    const ok = status === 200 || status === 202;
    return { ok, status, error: ok ? '' : `IndexNow answered ${status}` };
  } catch (e) {
    return { ok: false, status: 0, error: ctl.signal.aborted ? `Timed out after ${Math.round(timeoutMs / 1000)} s` : String(e?.message || e).slice(0, 200) };
  } finally { clearTimeout(timer); }
}

// ---------- the debounced queue ----------
const realTimer = { set: (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; }, clear: t => clearTimeout(t) };

export class IndexNowQueue {
  /** send(urls) -> { ok, status, error }. timer: { set(fn, ms), clear(handle) } (injectable). */
  constructor({ send, timer = realTimer, debounceMs = DEBOUNCE_MS, batchSize = BATCH_SIZE, now = () => Date.now() } = {}) {
    this.send = send; this.timer = timer; this.debounceMs = debounceMs; this.batchSize = batchSize; this.now = now;
    this.pending = new Set(); this.handle = null; this.running = false;
    this.last = { at: null, count: 0, ok: null, status: 0, error: '' };
  }
  get queued() { return this.pending.size; }
  add(url) {
    if (typeof url !== 'string' || !url) return;
    this.pending.add(url);
    if (!this.handle) this.handle = this.timer.set(() => { this.handle = null; this.flush().catch(() => {}); }, this.debounceMs);
  }
  /** Sends everything queued, up to batchSize distinct URLs per ping. Never throws. */
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.size) {
        const batch = [...this.pending].slice(0, this.batchSize);
        batch.forEach(u => this.pending.delete(u));
        let r;
        try { r = await this.send(batch); } catch (e) { r = { ok: false, status: 0, error: String(e?.message || e) }; }
        this.last = { at: new Date(this.now()).toISOString(), count: batch.length, ok: !!r?.ok, status: Number(r?.status) || 0, error: r?.error || '' };
      }
    } finally { this.running = false; }
  }
  /** Records a ping made outside the queue (the admin test button). */
  record(count, r) { this.last = { at: new Date(this.now()).toISOString(), count, ok: !!r?.ok, status: Number(r?.status) || 0, error: r?.error || '' }; }
}

// ---------- singleton state ----------
const cfg = { host: '', key: '' };
let skipNote = '';
let queue = null;
export function getQueue() {
  if (!queue) queue = new IndexNowQueue({ send: urls => pingIndexNow({ host: cfg.host, key: cfg.key, urls }) });
  return queue;
}
export function getIndexNowState() {
  const q = getQueue();
  return { lastPing: q.last.at, count: q.last.count, ok: q.last.ok, status: q.last.status, error: q.last.error || skipNote, queued: q.queued };
}
export function hostOf(settings) {
  const d = String(settings?.general?.preferredDomain || '');
  return /^https:\/\/[^/]+$/i.test(d) ? d.replace(/^https:\/\//i, '') : '';
}
/** Test hook. */
export function _resetIndexNowState() { queue = null; skipNote = ''; cfg.host = ''; cfg.key = ''; }

// ---------- default dependencies (loaded lazily so tests never touch the database) ----------
async function bustAll() {
  try { const m = await import('./seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); if (typeof m.markSitemapDirty === 'function') m.markSitemapDirty(); } catch { /* optional */ }
}
async function dbQuery(sql, params) { const { pool } = await import('./db.js'); const [rows] = await pool.query(sql, params); return rows; }
async function readSettings() {
  const { mergeSeoSettings } = await import('./seoSettings.js');
  const rows = await dbQuery('SELECT v FROM settings WHERE k = ?', ['seo']);
  let stored = null;
  try { stored = rows.length ? (typeof rows[0].v === 'string' ? JSON.parse(rows[0].v) : rows[0].v) : null; } catch { stored = null; }
  return mergeSeoSettings(stored);
}

/** Builds the middleware. deps are injectable: bust(), getSettings(), query(sql, params), queue. */
export function makeAfterAdminWrite(deps = {}) {
  const bust = deps.bust || bustAll;
  const getSettings = deps.getSettings || readSettings;
  const query = deps.query || dbQuery;
  return function afterAdminWrite(req, res, next) {
    let cls = null, body = null, early = null;
    try {
      cls = classifyAdminWrite(req.method, req.originalUrl || req.url);
      if (cls) {
        const json = res.json?.bind(res); // remember the created id / slug of a POST; the response itself is untouched
        if (json) res.json = b => { body = b; return json(b); };
      }
    } catch { cls = null; }

    const work = async () => {
      const q = deps.queue || getQueue();
      try { await bust(); } catch { /* purge is best effort */ }
      let s;
      try { s = await getSettings(); } catch { return; }
      if (!s?.flags?.indexNow) return;
      if (!s.indexNow?.key) { skipNote = ''; return; }
      const host = hostOf(s);
      if (!host) { skipNote = 'No preferred domain set'; return; }
      skipNote = '';
      cfg.host = host; cfg.key = s.indexNow.key;
      let urls = [];
      try { urls = early ? await early : await resolveUrls(cls, body, 'https://' + host, query); } catch { urls = []; }
      urls.forEach(u => q.add(u));
    };

    if (cls) {
      if (String(req.method).toUpperCase() === 'DELETE' && ['product', 'blog', 'page'].includes(cls.kind)) { // the row is gone after the delete: look it up first (best effort, errors ignored)
        early = getSettings().then(s => { const host = hostOf(s); return s?.flags?.indexNow && s.indexNow?.key && host ? resolveUrls(cls, null, 'https://' + host, query) : []; }).catch(() => []);
      }
      res.on('finish', () => {
        if (res.statusCode >= 400) return;
        work().catch(() => {});
      });
    }
    next();
  };
}
export const afterAdminWrite = makeAfterAdminWrite();
