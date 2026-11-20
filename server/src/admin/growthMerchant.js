// Admin routes of the Merchant Center tools (Search & Growth, Phase 4). Reads and settings need seo.manage, product edits products.manage,
// connecting / registering / the feed token growth.integrations. The feed core (seo.js) is imported lazily.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { fail, isLocalImg, wrap } from '../util.js';
import { GROWTH_INTEGRATIONS, can } from '../permissions.js';
import { getIntegration } from '../growth/http.js';
import { enqueue } from '../growth/jobs.js';
import { readSeo, siteOrigin } from '../growth/site.js';
import { MERCHANT_SCOPE, grantedScopes } from '../growth/google.js';
import { generateFeedToken, normalizeGoogleCategory, publicSettings, readMerchant, saveMerchant, suggestCategoryMap, validateMerchantSettings } from '../growth/merchant.js';
import * as merchantApi from '../growth/merchantApi.js';
import { ensureMerchantSync } from '../growth/merchantSync.js';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const seoMod = () => import('../seo.js');
const bump = async () => { const m = await seoMod(); if (typeof m.bumpFeedSettings === 'function') m.bumpFeedSettings(); };
const iso = d => (d ? new Date(d).toISOString() : null);
const lastManual = new Map();

/** Validates product edits: [{ id, excluded?, itemGroupId?, googleCategory? }] -> { ok, error, changes } (max 200). Pure. */
export function validateProductChanges(list) {
  if (!Array.isArray(list) || !list.length) return { ok: false, error: 'Nothing to save', changes: [] };
  if (list.length > 200) return { ok: false, error: 'Save at most 200 products at a time', changes: [] };
  const changes = [];
  for (const c of list) {
    const id = Number(c?.id);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad product id', changes: [] };
    const o = { id };
    if (c.excluded !== undefined) o.excluded = c.excluded === true || c.excluded === 1;
    if (c.itemGroupId !== undefined) {
      const g = String(c.itemGroupId ?? '').trim();
      if (g.length > 50 || /[\u0000-\u001F<>]/.test(g)) return { ok: false, error: `Product ${id}: the group id can be at most 50 characters`, changes: [] };
      o.itemGroupId = g;
    }
    if (c.googleCategory !== undefined) {
      const g = normalizeGoogleCategory(c.googleCategory);
      if (g === null) return { ok: false, error: `Product ${id}: the Google category must be a number or a path (max 250 characters)`, changes: [] };
      o.googleCategory = g;
    }
    changes.push(o);
  }
  return { ok: true, error: '', changes };
}

/** Pure: the settings patch + permission needs of a POST /settings body. */
export function planSettings(body, current) {
  const v = validateMerchantSettings(body);
  if (!v.ok) return { error: v.error };
  const next = { ...current, ...v.value };
  if (next.syncEnabled && (!next.accountId || !next.dataSourceId)) return { error: 'Enter the Merchant Center ID and the data source ID before turning the sync on' };
  const touchesApi = ['accountId', 'dataSourceId'].some(k => v.value[k] !== undefined && v.value[k] !== current[k]);
  return { patch: v.value, touchesApi };
}

function feedUrls(base, token) {
  const q = token ? '?token=' + token : '';
  return Object.fromEntries(['xml', 'csv', 'tsv'].map(e => [e, base ? `${base}/feeds/google-merchant.${e}${q}` : '']));
}
async function dims(img) {
  try {
    if (!isLocalImg(img)) return {};
    const sharp = (await import('sharp')).default, m = await sharp(path.join(SERVER_ROOT, img.replace(/^\//, ''))).metadata();
    return { imgW: m.width || null, imgH: m.height || null };
  } catch { return {}; }
}
const parseIssues = v => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
const page = (q, d, max) => Math.min(max, Math.max(1, parseInt(q, 10) || d));

async function productRows(q) {
  const m = await seoMod();
  const base = await siteOrigin();
  const report = typeof m.loadFeedReport === 'function' ? await m.loadFeedReport(base || REPORT_BASE) : { rows: [] };
  const rep = new Map((report.rows || []).map(r => [Number(r.pid), r]));
  await ensureMerchantSync();
  const [prods] = await pool.query('SELECT p.id, p.sku, p.name, p.img, (SELECT i.width FROM product_images i WHERE i.product_id = p.id ORDER BY i.position, i.id LIMIT 1) AS img_w, (SELECT i.height FROM product_images i WHERE i.product_id = p.id ORDER BY i.position, i.id LIMIT 1) AS img_h, p.merchant_exclude, p.item_group_id, p.google_category, c.title AS category FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.id');
  const [st] = await pool.query('SELECT product_id, status, issues FROM merchant_sync_state');
  const sync = new Map(st.map(s => [Number(s.product_id), s]));
  const needle = String(q.q || '').trim().toLowerCase(), want = String(q.status || '');
  const rows = prods.map(p => {
    const r = rep.get(p.id) || {}, s = sync.get(p.id) || {};
    return { id: p.id, sku: p.sku, name: p.name, category: p.category || '', included: r.included === true, reason: r.reason || '', warnings: r.warnings || [], excluded: Number(p.merchant_exclude) === 1, itemGroupId: p.item_group_id || '', googleCategory: p.google_category || '', img: p.img, imgDbW: Number(p.img_w) || 0, imgDbH: Number(p.img_h) || 0, syncStatus: s.status || '', issues: parseIssues(s.issues) };
  }).filter(r => (!needle || `${r.name} ${r.sku}`.toLowerCase().includes(needle)) && (!want || { included: r.included, skipped: !r.included, warning: r.warnings.length > 0, excluded: r.excluded, error: r.syncStatus === 'Error' }[want]));
  return rows;
}

const REPORT_BASE = 'https://example.invalid'; // only used to build the report when no public domain is set yet (links are not shown)
export function mountGrowthMerchantRoutes(router, guard) {
  const R = guard('seo.manage'), W = guard('products.manage'), C = guard(GROWTH_INTEGRATIONS);

  router.get('/growth/merchant/status', R, wrap(async (req, res) => {
    const [seo, s, base, gi, mi, m] = await Promise.all([readSeo(), readMerchant(), siteOrigin(), getIntegration('google'), getIntegration('merchant'), seoMod()]);
    let report = { items: [], skipped: [], warnings: [] };
    if (typeof m.loadFeedReport === 'function') report = await m.loadFeedReport(base || REPORT_BASE);
    const fs = typeof m.feedStatus === 'function' ? await m.feedStatus().catch(() => null) : null;
    await ensureMerchantSync();
    const [cnt] = await pool.query('SELECT status, COUNT(*) AS n FROM merchant_sync_state GROUP BY status');
    const n = k => Number(cnt.find(c => c.status === k)?.n || 0);
    const synced = n('Synced'), errors = n('Error');
    res.json({
      flagEnabled: seo.flags?.merchantFeed === true,
      feed: { itemCount: (report.items || []).length, skipped: report.skipped || [], warnings: report.warnings || [], generatedAt: fs?.generatedAt || null, urls: feedUrls(base, s.feedToken), tokenSet: !!s.feedToken },
      settings: publicSettings(s),
      api: {
        googleConnected: gi.status === 'connected', merchantScopeOk: (await grantedScopes()).includes(MERCHANT_SCOPE), accountId: s.accountId, dataSourceId: s.dataSourceId, syncEnabled: s.syncEnabled,
        lastSync: iso(mi.last_sync), lastError: mi.last_error || '', counts: { synced, pending: Math.max(0, (report.items || []).length - synced - errors), errors, deleted: n('Deleted') },
        redirectNote: 'If you connected Google before Merchant Center was added, press Connect Google again so the new permission is granted.'
      }
    });
  }));

  router.post('/growth/merchant/settings', R, wrap(async (req, res) => {
    const cur = await readMerchant(), plan = planSettings(req.body, cur);
    if (plan.error) throw fail(400, plan.error);
    if (plan.touchesApi && !can(req.staff, GROWTH_INTEGRATIONS)) throw fail(403, 'Changing the Merchant Center ID or data source needs the integrations permission');
    const next = await saveMerchant(plan.patch);
    await bump();
    res.json({ settings: publicSettings(next) });
  }));

  router.post('/growth/merchant/token', C, wrap(async (req, res) => {
    const token = generateFeedToken(); await saveMerchant({ feedToken: token }); await bump();
    res.json({ token, urls: feedUrls(await siteOrigin(), token) });
  }));
  router.delete('/growth/merchant/token', C, wrap(async (req, res) => { await saveMerchant({ feedToken: '' }); await bump(); res.json({ ok: true }); }));

  router.get('/growth/merchant/categories', R, wrap(async (req, res) => {
    const s = await readMerchant();
    const [cats] = await pool.query('SELECT c.id, c.title, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS products FROM categories c ORDER BY c.sort_order, c.title');
    const sug = new Map(suggestCategoryMap(cats).map(x => [x.categoryId, x]));
    res.json({ rows: cats.map(c => ({ id: c.id, title: c.title, products: Number(c.products), google: s.categoryMap[c.id] || '', excluded: s.excludedCategories.includes(c.id), suggestion: sug.get(c.id)?.suggestion || null, note: sug.get(c.id)?.note || '' })) });
  }));

  router.get('/growth/merchant/products', R, wrap(async (req, res) => {
    const all = await productRows(req.query), limit = page(req.query.limit, 15, 100), pages = Math.max(1, Math.ceil(all.length / limit)), pg = Math.min(page(req.query.page, 1, 1e6), pages);
    const rows = await Promise.all(all.slice((pg - 1) * limit, pg * limit).map(async ({ img, imgDbW, imgDbH, ...r }) => ({ ...r, ...(imgDbW > 0 && imgDbH > 0 ? { imgW: imgDbW, imgH: imgDbH } : await dims(img)) })));
    res.json({ rows, total: all.length, page: pg, pages });
  }));

  router.post('/growth/merchant/products', W, wrap(async (req, res) => {
    const v = validateProductChanges(req.body?.changes);
    if (!v.ok) throw fail(400, v.error);
    let updated = 0;
    for (const c of v.changes) {
      const set = [], p = [];
      if (c.excluded !== undefined) { set.push('merchant_exclude = ?'); p.push(c.excluded ? 1 : 0); }
      if (c.itemGroupId !== undefined) { set.push('item_group_id = ?'); p.push(c.itemGroupId || null); }
      if (c.googleCategory !== undefined) { set.push('google_category = ?'); p.push(c.googleCategory || null); }
      if (set.length) { const [r] = await pool.query(`UPDATE products SET ${set.join(', ')} WHERE id = ?`, [...p, c.id]); updated += r.affectedRows ? 1 : 0; }
    }
    if (updated) await bump();
    res.json({ updated });
  }));

  router.post('/growth/merchant/api/test', R, wrap(async (req, res) => {
    const s = await readMerchant();
    if (!s.accountId) throw fail(400, 'Enter the Merchant Center ID first');
    const r = await merchantApi.getAccount(s.accountId);
    res.json({ ok: r.ok, account: r.ok ? { name: r.data?.accountName || r.data?.name || '', id: s.accountId } : null, error: r.ok ? '' : r.error });
  }));
  router.post('/growth/merchant/api/register', C, wrap(async (req, res) => {
    const s = await readMerchant(), email = String(req.body?.developerEmail || '').trim();
    if (!s.accountId) throw fail(400, 'Enter the Merchant Center ID first');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw fail(400, 'Enter a valid email address');
    const r = await merchantApi.registerGcp(s.accountId, email);
    res.json({ ok: r.ok, error: r.ok ? '' : r.error });
  }));

  const queue = (type, key, payload) => wrap(async (req, res) => {
    if (Date.now() - (lastManual.get(key) || 0) < 60000) return res.status(429).json({ error: 'Wait a minute before starting this again' });
    lastManual.set(key, Date.now());
    res.json({ queued: (await enqueue(type, payload(req), { dedupeKey: key })) !== null });
  });
  router.post('/growth/merchant/sync', R, queue('merchant_sync', 'merchant_sync_manual', req => ({ full: req.body?.full === true })));
  router.post('/growth/merchant/api/status-refresh', R, queue('merchant_status', 'merchant_status_manual', () => ({})));
}

