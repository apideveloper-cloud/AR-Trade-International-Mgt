// Catalogue change hook: any stock / price change made outside the admin catalogue routes (orders, inventory, field app) calls
// noteCatalogChange({ productIds, reason }) AFTER its database write. It purges the SEO caches, tells IndexNow about the product pages
// and (only for big or add/remove changes) queues a delayed sitemap re-submit. Fire-and-forget: it never throws and nothing awaits it.
// Calls within DEBOUNCE_MS collapse into one run and their product ids accumulate.
import { IndexNowQueue, hostOf, pingIndexNow, urlOf } from '../seoAutomation.js';

export const DEBOUNCE_MS = 5000;
export const BIG_CHANGE = 20;
export const SITEMAP_DELAY_MS = 15 * 60000;
const SITEMAP_REASONS = new Set(['product_added', 'product_removed']);

// ---------- default dependencies (lazy, so importing this file never touches the database) ----------
const defaults = {
  async bust() { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); },
  async query(sql, params) { const { pool } = await import('../db.js'); const [rows] = await pool.query(sql, params); return rows; },
  async getSettings() {
    const { mergeSeoSettings } = await import('../seoSettings.js');
    const rows = await deps.query('SELECT v FROM settings WHERE k = ?', ['seo']);
    let stored = null;
    try { stored = rows.length ? (typeof rows[0].v === 'string' ? JSON.parse(rows[0].v) : rows[0].v) : null; } catch { stored = null; }
    return mergeSeoSettings(stored);
  },
  async enqueue(type, payload, opts) { const m = await import('./jobs.js'); return m.enqueue(type, payload, opts); },
  queue: null, // built on first use: own debounced IndexNow queue (the shared one only knows its host/key after an admin write)
  now: () => Date.now(),
  setTimer: (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; },
  clearTimer: t => clearTimeout(t)
};
let deps = { ...defaults };
const ping = { host: '', key: '' };
let ownQueue = null;
const getOwnQueue = () => ownQueue || (ownQueue = new IndexNowQueue({ send: urls => pingIndexNow({ host: ping.host, key: ping.key, urls }) }));

/** Test hook: replace any of bust, query, getSettings, enqueue, queue, now, setTimer, clearTimer. Call with no argument to restore. */
export function _setDeps(over) { deps = { ...defaults, ...(over || {}) }; ownQueue = null; reset(); }

// ---------- debounce state ----------
let pendingIds = new Set(), pendingReasons = new Set(), handle = null;
function reset() { if (handle) { try { deps.clearTimer(handle); } catch { /* ignore */ } } handle = null; pendingIds = new Set(); pendingReasons = new Set(); }

async function run(ids, reasons) {
  try { await deps.bust(); } catch { /* the purge is best effort */ }
  let s = null;
  try { s = await deps.getSettings(); } catch { /* no settings: skip IndexNow */ }
  if (s?.flags?.indexNow && s.indexNow?.key && ids.length) {
    try {
      const host = hostOf(s);
      if (host) {
        const q = deps.queue || getOwnQueue();
        ping.host = host; ping.key = s.indexNow.key;
        const rows = await deps.query('SELECT id, name, slug FROM products WHERE id IN (?)', [ids]);
        for (const r of rows || []) { const u = urlOf('product', r, 'https://' + host); if (u) q.add(u); }
      }
    } catch { /* IndexNow is optional */ }
  }
  if (ids.length >= BIG_CHANGE || [...reasons].some(r => SITEMAP_REASONS.has(r))) {
    try { await deps.enqueue('sitemap_resubmit', { reason: [...reasons].join(',') }, { dedupeKey: 'sitemap_resubmit', runAt: new Date(deps.now() + SITEMAP_DELAY_MS) }); } catch { /* optional */ }
  }
}

/** Never throws, returns nothing. Do not await it. */
export function noteCatalogChange({ productIds = [], reason = '' } = {}) {
  try {
    for (const id of Array.isArray(productIds) ? productIds : [productIds]) { const n = parseInt(id, 10); if (Number.isInteger(n) && n > 0) pendingIds.add(n); }
    if (reason) pendingReasons.add(String(reason));
    if (handle) return;
    handle = deps.setTimer(() => {
      const ids = [...pendingIds], reasons = pendingReasons;
      handle = null; pendingIds = new Set(); pendingReasons = new Set();
      run(ids, reasons).catch(() => {});
    }, DEBOUNCE_MS);
  } catch { /* a hook must never fail the request */ }
}

/** Test hook: run the pending batch now. */
export async function _flushNow() {
  if (handle) { try { deps.clearTimer(handle); } catch { /* ignore */ } handle = null; }
  const ids = [...pendingIds], reasons = pendingReasons;
  pendingIds = new Set(); pendingReasons = new Set();
  await run(ids, reasons).catch(() => {});
}
