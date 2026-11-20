// Admin API of the SEO product list, bulk actions and dashboard (permission seo.manage). The rules live in seoBulkMap.js (pure, tested).
import { pool } from '../db.js';
import { parseJson, wrap } from '../util.js';
import { published, hasPicture } from '../productImages.js';
import { mergeSeoSettings } from '../seoSettings.js';
import { buildBrandRows, manualFrom } from './seoItemMap.js';
import { isAutoTitle, isAutoDesc } from '../seoHelpers.js';
import { snapshot } from './seoHistoryMap.js';
import {
  FROM_SQL, TITLE_SET_SQL, DESC_SET_SQL, GTIN_SET_SQL, TITLE_TEXT_SQL, DESC_TEXT_SQL, LOW_SCORE, MAX_AFFECTED, CHUNK,
  whereFor, orderFor, parseListQuery, rowOut, summaryOut, parseBulkBody, capError, chunk, pickAffected, dryRunOut, planAltFills,
  scoreProductRow, dupMap, groupBy, aggregateIssues, groupDuplicates, brandStats, sitemapBrandCount
} from './seoBulkMap.js';

const META_JOIN = "LEFT JOIN seo_meta m ON m.entity_type = 'product' AND m.entity_id = CAST(p.id AS CHAR) COLLATE utf8mb4_unicode_ci";

async function bustSeo() { try { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); } catch { /* optional */ } }

async function settingsOnce() {
  const [rows] = await pool.query('SELECT v FROM settings WHERE k = ?', ['seo']);
  let stored = null;
  try { stored = rows.length ? parseJson(rows[0].v) : null; } catch { stored = null; }
  return mergeSeoSettings(stored);
}

/** Runs fn(connection) inside a transaction; always rolls back on error and releases the connection. */
async function inTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (e) {
    try { await conn.rollback(); } catch { /* connection already gone */ }
    throw e;
  } finally { conn.release(); }
}

/** The products an action works on, one row each with the flags pickAffected needs. At most MAX_AFFECTED (a 400 above it). */
async function selectProducts(ids, scope) {
  const cols = `SELECT p.id, p.name, p.noindex, (TRIM(p.meta_keywords) <> '') kw, ${TITLE_SET_SQL} ts, ${DESC_SET_SQL} ds, COALESCE(a.missing, 0) alt_missing `;
  let rows;
  if (ids) [rows] = await pool.query(`${cols}${FROM_SQL} WHERE p.id IN (?) ORDER BY p.id`, [ids]);
  else {
    const { where, params } = whereFor(scope);
    [rows] = await pool.query(`${cols}${FROM_SQL} ${where} ORDER BY p.id LIMIT ${MAX_AFFECTED + 1}`, params);
    if (rows.length > MAX_AFFECTED) throw capError(`more than ${MAX_AFFECTED}`);
  }
  return rows;
}

// ---------- the actions, one chunk of product ids at a time ----------
async function resetTemplate(ids) {
  await inTx(async conn => {
    await conn.query("UPDATE products SET meta_title = '', meta_desc = '', meta_keywords = '' WHERE id IN (?)", [ids]);
    await conn.query("UPDATE seo_meta SET meta_title = '', meta_description = '' WHERE entity_type = 'product' AND entity_id IN (?)", [ids.map(String)]);
  });
}
async function setIndex(ids, noindex) {
  await inTx(async conn => {
    await conn.query('UPDATE products SET noindex = ? WHERE id IN (?)', [noindex, ids]);
    await conn.query("UPDATE seo_meta SET robots_index = ? WHERE entity_type = 'product' AND entity_id IN (?)", [noindex ? 0 : 1, ids.map(String)]);
  });
}
async function altAutofill(ids) {
  const [prods] = await pool.query('SELECT id, name, brand FROM products WHERE id IN (?)', [ids]);
  const [imgs] = await pool.query('SELECT id, product_id, alt FROM product_images WHERE product_id IN (?) ORDER BY product_id, position, id', [ids]);
  const byProduct = groupBy(imgs, 'product_id');
  const fills = [];
  for (const p of prods) fills.push(...planAltFills(byProduct.get(p.id), p.name, p.brand));
  for (const part of chunk(fills, 100)) {
    await inTx(async conn => {
      await conn.query(`UPDATE product_images SET alt = CASE id ${'WHEN ? THEN ? '.repeat(part.length)}END WHERE id IN (?) AND TRIM(alt) = ''`,
        [...part.flatMap(f => [f.id, f.alt]), part.map(f => f.id)]);
    });
  }
}

/** Comparable snapshots (manual fields + image alts) of products, in three batched queries. Best effort: an empty map on failure. */
async function snapsOf(ids) {
  const out = new Map();
  try {
    const [prods] = await pool.query('SELECT * FROM products WHERE id IN (?)', [ids]);
    const [imgs] = await pool.query('SELECT product_id, path, alt FROM product_images WHERE product_id IN (?) ORDER BY product_id, position, id', [ids]);
    let metas = [];
    try { [metas] = await pool.query("SELECT * FROM seo_meta WHERE entity_type = 'product' AND entity_id IN (?)", [ids.map(String)]); } catch (e) { if (e?.code !== 'ER_NO_SUCH_TABLE') throw e; }
    const imgBy = groupBy(imgs, 'product_id'), metaBy = new Map(metas.map(m => [String(m.entity_id), m]));
    for (const p of prods) out.set(p.id, snapshot('product', manualFrom('product', p, metaBy.get(String(p.id)) || {}, { isAutoTitle, isAutoDesc }), { imageAlts: (imgBy.get(p.id) || []).map(i => ({ src: i.path, alt: i.alt || '' })) }));
  } catch (e) { console.error('seo history snapshot failed:', e.message); out.clear(); }
  return out;
}

/** Duplicate-title / description counts of the whole catalogue (products columns), two GROUP BY queries. */
async function dupMaps() {
  const [t] = await pool.query("SELECT meta_title t, COUNT(*) n FROM products WHERE meta_title <> '' GROUP BY meta_title");
  const [d] = await pool.query("SELECT meta_desc t, COUNT(*) n FROM products WHERE meta_desc <> '' GROUP BY meta_desc");
  return { titles: dupMap(t), descs: dupMap(d) };
}

/** Recomputes score + issues of the given products in chunks and stores them in seo_meta. Returns how many were scored. */
async function recalculate(ids, who) {
  const settings = await settingsOnce();
  const dup = await dupMaps();
  const by = String(who || '').slice(0, 80);
  let scored = 0;
  for (const part of chunk(ids, CHUNK)) {
    const [prods] = await pool.query('SELECT p.*, c.title AS category_title FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id IN (?)', [part]);
    const [imgs] = await pool.query('SELECT product_id, path, alt, width, height FROM product_images WHERE product_id IN (?) ORDER BY product_id, position, id', [part]);
    const [metas] = await pool.query("SELECT * FROM seo_meta WHERE entity_type = 'product' AND entity_id IN (?)", [part.map(String)]);
    const imgBy = groupBy(imgs, 'product_id'), metaBy = new Map(metas.map(m => [String(m.entity_id), m]));
    const now = new Date();
    const rows = prods.map(p => {
      const { score, issues } = scoreProductRow(p, metaBy.get(String(p.id)) || {}, imgBy.get(p.id) || [], settings, dup);
      return ['product', String(p.id), score, JSON.stringify(issues), by, now];
    });
    if (!rows.length) continue;
    await inTx(conn => conn.query(
      'INSERT INTO seo_meta (entity_type, entity_id, seo_score, seo_issues, updated_by, updated_at) VALUES ? '
      + 'ON DUPLICATE KEY UPDATE seo_score = VALUES(seo_score), seo_issues = VALUES(seo_issues), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)', [rows]));
    scored += rows.length;
  }
  return scored;
}

async function runBulk({ action, ids, scope, dryRun }, who) {
  const t0 = Date.now();
  const sel = await selectProducts(ids, scope);
  if (dryRun) return dryRunOut(action, sel);
  const { affected } = pickAffected(action, sel);
  const list = affected.map(r => r.id);
  let done = list.length;
  if (action === 'recalculate') done = await recalculate(list, who);
  else for (const part of chunk(list, CHUNK)) {
    const before = await snapsOf(part); // best effort history: one row per product, one INSERT per chunk
    if (action === 'reset_template') await resetTemplate(part);
    else if (action === 'noindex') await setIndex(part, 1);
    else if (action === 'index') await setIndex(part, 0);
    else await altAutofill(part);
    if (before.size) {
      try {
        const after = await snapsOf(part);
        const { recordMany } = await import('./seoHistory.js');
        await recordMany(pool, part.filter(id => before.has(id) && after.has(id)).map(id => ({ type: 'product', id, action: 'bulk', source: 'bulk', before: before.get(id), after: after.get(id), who })));
      } catch (e) { console.error('seo history failed:', e.message); }
    }
  }
  if (done) await bustSeo();
  const requested = ids ? ids.length : sel.length;
  return { ok: true, affected: done, skipped: Math.max(0, requested - done), durationMs: Date.now() - t0 };
}

export function mountSeoBulkRoutes(router, guard) {
  const G = guard('seo.manage');

  // ---------- product list ----------
  router.get('/seo/products', G, wrap(async (req, res) => {
    const o = parseListQuery(req.query);
    const { where, params } = whereFor(o);
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n ${FROM_SQL} ${where}`, params);
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.sku, p.slug, p.img, p.category_id, c.title cat_title, p.brand, p.price, p.active, p.noindex, m.seo_score, m.seo_issues, `
      + `${TITLE_SET_SQL} title_set, ${DESC_SET_SQL} desc_set, ${GTIN_SET_SQL} gtin_set, COALESCE(a.missing, 0) alt_missing, COALESCE(a.n, 0) image_count `
      + `${FROM_SQL} ${where} ORDER BY ${orderFor(o.sort, o.dir)} LIMIT ? OFFSET ?`, [...params, o.size, o.offset]);
    const [[s]] = await pool.query(
      `SELECT COUNT(*) total, SUM(NOT ${TITLE_SET_SQL}) missing_title, SUM(NOT ${DESC_SET_SQL}) missing_desc, SUM(m.seo_score < ${LOW_SCORE}) low_score, `
      + `SUM(NOT ${GTIN_SET_SQL}) missing_gtin, SUM(COALESCE(a.missing, 0) > 0) alt_missing, SUM(p.noindex = 1) noindex, SUM(m.seo_score IS NULL) unscored ${FROM_SQL}`);
    res.json({ total: Number(n), rows: rows.map(r => rowOut(r, !!r.active && hasPicture(r.img))), summary: summaryOut(s) });
  }));

  // ---------- bulk actions ----------
  router.post('/seo/bulk', G, wrap(async (req, res) => { res.json(await runBulk(parseBulkBody(req.body), req.staff?.name)); }));

  router.post('/seo/recalculate', G, wrap(async (req, res) => {
    const t0 = Date.now();
    const [rows] = await pool.query('SELECT id FROM products ORDER BY id');
    const scored = await recalculate(rows.map(r => r.id), req.staff?.name);
    await bustSeo();
    res.json({ ok: true, scored, durationMs: Date.now() - t0 });
  }));

  // ---------- dashboard ----------
  router.get('/seo/dashboard', G, wrap(async (req, res) => {
    const [[pt]] = await pool.query(`SELECT COUNT(*) total, SUM(m.seo_score IS NOT NULL) scored, AVG(m.seo_score) avg_score, SUM(p.noindex = 1) noindex FROM products p ${META_JOIN}`);
    const [issueRows] = await pool.query("SELECT m.seo_issues FROM seo_meta m JOIN products p ON m.entity_type = 'product' AND m.entity_id = CAST(p.id AS CHAR) COLLATE utf8mb4_unicode_ci WHERE m.seo_score IS NOT NULL AND m.seo_issues IS NOT NULL");
    const [dupRows] = await pool.query(`SELECT p.id, ${TITLE_TEXT_SQL} t, ${DESC_TEXT_SQL} d FROM products p ${META_JOIN}`);
    const [active] = await pool.query('SELECT id, img, brand FROM products WHERE active = 1');
    const live = published(active);
    const [brands] = await pool.query('SELECT slug, name, hidden FROM brands').catch(() => [[]]);
    const [counts] = await pool.query("SELECT brand, COUNT(*) n FROM products WHERE active = 1 AND brand IS NOT NULL AND TRIM(brand) <> '' GROUP BY brand");
    let metas = [];
    try { [metas] = await pool.query("SELECT * FROM seo_meta WHERE entity_type = 'brand'"); } catch (e) { if (e?.code !== 'ER_NO_SUCH_TABLE') throw e; }
    let red = { total: 0, auto: 0, hits: 0 };
    try { const [[r]] = await pool.query('SELECT COUNT(*) total, SUM(auto = 1) auto, SUM(hits) hits FROM seo_redirects'); red = { total: Number(r.total) || 0, auto: Number(r.auto) || 0, hits: Number(r.hits) || 0 }; } catch { /* table missing */ }
    const one = async sql => { try { const [[r]] = await pool.query(sql); return Number(r.n) || 0; } catch { return 0; } };
    const [[last]] = await pool.query('SELECT MAX(updated_at) t FROM seo_meta WHERE seo_score IS NOT NULL');
    const total = Number(pt.total) || 0, scored = Number(pt.scored) || 0;
    let smStatus = null;
    try { const m = await import('../seo.js'); if (typeof m.sitemapStatus === 'function') smStatus = await m.sitemapStatus(); } catch { /* optional */ }
    const smAt = smStatus?.generatedAt ? new Date(smStatus.generatedAt) : null;
    const smTime = smAt && !Number.isNaN(smAt.getTime()) ? smAt.toISOString() : null;
    res.json({
      products: { total, scored, unscored: total - scored, avgScore: scored && pt.avg_score != null ? Math.round(Number(pt.avg_score)) : null, noindex: Number(pt.noindex) || 0, live: live.length },
      issues: aggregateIssues(issueRows),
      duplicates: groupDuplicates(dupRows),
      brands: brandStats(buildBrandRows(brands, counts, metas)),
      redirects: red,
      sitemap: {
        products: live.length,
        categories: await one('SELECT COUNT(*) n FROM categories WHERE hidden = 0'),
        blog: await one('SELECT COUNT(*) n FROM blog_posts WHERE status = "Published" AND noindex = 0'),
        pages: await one('SELECT COUNT(*) n FROM site_pages WHERE status = "Published" AND grp = "servicing" AND noindex = 0'),
        brands: sitemapBrandCount(brands, live),
        generatedAt: smTime
      },
      sitemapNote: smStatus ? 'Cached; rebuilt after every save or every 10 minutes' + (smTime ? ` (last built ${smTime})` : '') : 'Built live on every request',
      lastScoredAt: last?.t ? new Date(last.t).toISOString() : null
    });
  }));
}
