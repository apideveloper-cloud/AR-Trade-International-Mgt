// Admin API of the per-item SEO tab (permission seo.manage): read / save one item's SEO, schema preview, web address (slug) change, image alt text, brand list.
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { moveRedirect } from '../redirects.js';
import { isAutoTitle, isAutoDesc } from '../seoHelpers.js';
import { TYPES, LIMITS, autofillAlts, normaliseSlug, urlFor, manualFrom, buildBrandRows } from './seoItemMap.js';
import { settingsOf as settingsOfDb, loadItem, autoOf, imagesOf as imagesOfDb, scoreOf as scoreOfDb, saveAlts as saveAltsDb, saveManual } from './seoSave.js';


async function bustSeo() { try { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); } catch { /* optional */ } }
/** previewMeta(path) from ../seo.js, or null when it is missing or throws. */
async function preview(path) {
  try { const m = await import('../seo.js'); if (typeof m.previewMeta !== 'function') return null; return (await m.previewMeta(path)) || null; } catch { return null; }
}

const settingsOf = () => settingsOfDb(pool);
const load = (type, id) => loadItem(pool, type, id);
const imagesOf = id => imagesOfDb(pool, id);
const scoreOf = (it, manual, auto, resolved, images) => scoreOfDb(pool, it, manual, auto, resolved, images);
const saveAlts = (id, edits) => saveAltsDb(pool, id, edits);

const resolvedOut = p => (p ? { title: p.title ?? p.head?.title ?? '', description: p.description ?? p.head?.description ?? '', canonical: p.canonical ?? p.head?.canonical ?? '', robots: p.robots ?? p.head?.robots ?? '' } : null);

async function view(it) {
  const settings = await settingsOf();
  const manual = manualFrom(it.type, it.row, it.meta, { isAutoTitle, isAutoDesc });
  const auto = await autoOf(it, settings);
  const images = it.type === 'product' ? await imagesOf(it.row.id) : undefined;
  const resolved = resolvedOut(await preview(it.url));
  const score = await scoreOf(it, manual, auto, resolved, images);
  const out = {
    type: it.type, id: it.id, exists: true, url: it.url, name: it.name, manual, auto, limits: LIMITS,
    slug: { value: it.type === 'category' ? it.row.id : it.row.slug || '', editable: it.type === 'product' || it.type === 'blog' || it.type === 'page' }
  };
  if (it.type === 'product') {
    const r = it.row;
    out.product = { brand: r.brand || '', mpn: r.part || '', gtin: r.gtin || '', condition: r.item_condition || 'new', warrantyText: r.warranty_text || '', stockStatus: r.stock_status || 'auto', price: r.price, stock: r.stock, hasImage: !!(r.img || images.length) };
    out.images = images;
  }
  out.score = score;
  out.resolved = resolved;
  return out;
}

const SLUG_TABLE = { product: 'products', blog: 'blog_posts', page: 'site_pages' };
/**
 * Changes the web address of a product, blog article or page (shared by the slug routes and the history revert): checks, updates, keeps seo_meta and redirects consistent,
 * records one history entry. Does not clear the cache. Throws fail(404 / 400 / 409). Returns { slug, url, redirect, unchanged?, historyId? }.
 */
export async function changeSlug(db, type, id, newSlug, who = '', { source = 'editor', action = 'slug' } = {}) {
  const table = SLUG_TABLE[type];
  if (!table) throw fail(400, 'This item has no web address');
  const it = await loadItem(db, type, id);
  if (!it) throw fail(404, 'Item not found');
  const n = normaliseSlug(newSlug);
  if (n.error) throw fail(400, n.error);
  const old = it.row.slug;
  if (n.slug === old) return { slug: old, url: it.url, redirect: null, unchanged: true };
  const [dup] = await db.query(`SELECT 1 FROM ${table} WHERE slug = ? AND id <> ? LIMIT 1`, [n.slug, it.row.id]);
  if (dup.length) throw fail(409, 'This web address is already used by another ' + (type === 'product' ? 'product' : type === 'blog' ? 'article' : 'page'));
  await db.query(`UPDATE ${table} SET slug = ? WHERE id = ?`, [n.slug, it.row.id]);
  const byKey = type !== 'product';
  if (byKey) await db.query('UPDATE seo_meta SET entity_id = ? WHERE entity_type = ? AND entity_id = ?', [n.slug, type, old]);
  const url = urlFor(type, { ...it.row, slug: n.slug });
  let redirect = null;
  if (old) {
    try { const r = await moveRedirect(db, it.url, url); redirect = { source: r.source, target: r.target }; } catch (e) { console.error('Redirect not saved:', e.message); }
  }
  let historyId = null;
  try {
    const h = await import('./seoHistory.js');
    const newId = byKey ? n.slug : it.id; // blog and page items are keyed by slug: their earlier history follows the new key
    if (byKey) await db.query('UPDATE seo_history SET entity_id = ? WHERE entity_type = ? AND entity_id = ?', [newId, type, old]).catch(e => console.error('seo history re-key failed:', e.message));
    historyId = await h.recordHistory(db, { type, id: newId, action, source, before: { slug: old }, after: { slug: n.slug }, who });
  } catch (e) { console.error('seo history failed:', e.message); }
  return { slug: n.slug, url, redirect, ...(historyId ? { historyId } : {}) };
}

const known = async (req) => {
  const it = await load(req.params.type, req.params.id);
  if (!it) throw fail(404, 'Item not found');
  return it;
};

export function mountSeoItemRoutes(router, guard) {
  const G = guard('seo.manage');

  // ---------- brands list (before /seo/item so nothing shadows it) ----------
  router.get('/seo/brands', G, wrap(async (req, res) => {
    const [brands] = await pool.query('SELECT slug, name, hidden FROM brands');
    const [counts] = await pool.query("SELECT brand, COUNT(*) n FROM products WHERE active = 1 AND brand IS NOT NULL AND TRIM(brand) <> '' GROUP BY brand");
    let metas = [];
    try { [metas] = await pool.query("SELECT * FROM seo_meta WHERE entity_type = 'brand'"); } catch (e) { if (e?.code !== 'ER_NO_SUCH_TABLE') throw e; }
    res.json({ rows: buildBrandRows(brands, counts, metas) });
  }));
  router.put('/seo/brands/:slug', G, wrap(async (req, res) => {
    if (typeof req.body?.hidden !== 'boolean') throw fail(400, 'hidden must be true or false');
    const [r] = await pool.query('UPDATE brands SET hidden = ? WHERE slug = ?', [+req.body.hidden, req.params.slug]);
    if (!r.affectedRows) { const [[b]] = await pool.query('SELECT 1 x FROM brands WHERE slug = ?', [req.params.slug]); if (!b) throw fail(404, 'Brand not found'); }
    await bustSeo();
    res.json({ ok: true });
  }));

  // ---------- one item ----------
  router.get('/seo/item/:type/:id', G, wrap(async (req, res) => { res.json(await view(await known(req))); }));

  router.put('/seo/item/:type/:id', G, wrap(async (req, res) => {
    const r = await saveManual(pool, req.params.type, req.params.id, req.body?.manual, { who: req.staff?.name, images: req.body?.images, resolve: async url => { await bustSeo(); return resolvedOut(await preview(url)); } });
    if (!r.ok) {
      if (r.status === 404) throw fail(404, 'Item not found');
      return res.status(r.status).json({ error: r.errors[0], errors: r.errors });
    }
    res.json({ ok: true, score: r.score, issues: r.issues, resolved: r.resolved });
  }));

  router.get('/seo/item/:type/:id/schema', G, wrap(async (req, res) => {
    const it = await known(req);
    const p = await preview(it.url);
    if (!p) return res.json({ ld: [], head: null });
    const head = p.head || { title: p.title ?? '', description: p.description ?? '', canonical: p.canonical ?? '', robots: p.robots ?? '', og: p.og ?? {}, twitter: p.twitter ?? {} };
    res.json({ head, ld: Array.isArray(p.ld) ? p.ld : [] });
  }));

  // ---------- web address (slug) ----------
  // product :id is the product id; blog and page items are keyed by slug (in the URL and in seo_meta), so their :id is the current slug
  for (const [type, param] of [['product', 'id'], ['blog', 'slug'], ['page', 'slug']]) {
    router.put(`/seo/${type}/:${param}/slug`, G, wrap(async (req, res) => {
      const r = await changeSlug(pool, type, req.params[param], req.body?.slug, req.staff?.name);
      await bustSeo();
      res.json(r.unchanged ? { ok: true, slug: r.slug, url: r.url, redirect: null } : { ok: true, slug: r.slug, url: r.url, redirect: r.redirect });
    }));
  }

  // ---------- image alt text ----------
  router.post('/seo/product/:id/alt-autofill', G, wrap(async (req, res) => {
    const it = await load('product', req.params.id);
    if (!it) throw fail(404, 'Product not found');
    const before = await imagesOf(it.row.id);
    const after = autofillAlts(before, it.name, it.row.brand);
    await saveAlts(it.row.id, after.filter((a, i) => a.alt !== before[i].alt));
    try {
      const alts = list => ({ imageAlts: list.map(i => ({ src: i.src, alt: i.alt })) });
      const { recordHistory } = await import('./seoHistory.js');
      await recordHistory(pool, { type: 'product', id: it.id, action: 'save', source: 'editor', before: alts(before), after: alts(after), who: req.staff?.name });
    } catch (e) { console.error('seo history failed:', e.message); }
    await bustSeo();
    res.json({ images: after });
  }));
}
