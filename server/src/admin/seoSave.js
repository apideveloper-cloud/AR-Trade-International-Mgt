// Saving one item's SEO (validate, write, re-score). Shared by PUT /seo/item/:type/:id and the CSV import.
// Every function takes the database handle first (a pool or a connection), so a caller may run them inside a transaction.
import { parseJson } from '../util.js';
import { isAutoTitle, isAutoDesc, plain } from '../seoHelpers.js';
import { scoreItem } from '../seoScore.js';
import { snapshot } from './seoHistoryMap.js';
import { TYPES, validateManual, cleanImageAlts, urlFor, manualFrom, splitWrites } from './seoItemMap.js';

const tpl = () => import('../seoTemplate.js');
const cfg = () => import('../seoSettings.js');
const words = t => (t ? t.split(' ').length : 0);

export async function settingsOf(db) {
  const { mergeSeoSettings } = await cfg();
  const [rows] = await db.query('SELECT v FROM settings WHERE k = ?', ['seo']);
  return mergeSeoSettings(rows.length ? parseJson(rows[0].v) : null);
}

/** Loads one item: its row, seo_meta row, name, address, kind for templates. null when unknown. */
export async function loadItem(db, type, id) {
  if (!TYPES.includes(type)) return null;
  id = String(id ?? '');
  let row;
  if (type === 'product') {
    if (!/^\d{1,10}$/.test(id)) return null;
    [[row]] = await db.query('SELECT p.*, c.title AS category_title FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?', [id]);
  } else if (type === 'category') [[row]] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
  else if (type === 'brand') [[row]] = await db.query('SELECT * FROM brands WHERE slug = ?', [id]);
  else if (type === 'blog') [[row]] = await db.query('SELECT * FROM blog_posts WHERE slug = ?', [id]);
  else [[row]] = await db.query('SELECT * FROM site_pages WHERE slug = ?', [id]);
  if (!row) return null;
  let meta = {};
  try { [[meta = {}]] = await db.query('SELECT * FROM seo_meta WHERE entity_type = ? AND entity_id = ? LIMIT 1', [type, id]); } catch (e) { if (e?.code !== 'ER_NO_SUCH_TABLE') throw e; }
  const name = type === 'product' ? row.name : type === 'brand' ? row.name : row.title;
  const entity = type === 'product' ? { ...row, category: row.category_title } : row;
  return { type, id, row, meta: meta || {}, name: String(name || ''), url: urlFor(type, row), entity };
}

export async function autoOf(it, settings) {
  const { renderTemplate, varsFor, DEFAULT_TEMPLATES } = await tpl();
  const vars = varsFor(it.type, it.entity, settings);
  const t = f => settings.templates?.[it.type]?.[f] ?? DEFAULT_TEMPLATES?.[it.type]?.[f] ?? '';
  return {
    title: renderTemplate(t('title'), vars, { max: 60 }), description: renderTemplate(t('description'), vars, { max: 155 }),
    ogTitle: renderTemplate(t('ogTitle'), vars, { max: 60 }), ogDescription: renderTemplate(t('ogDescription'), vars, { max: 155 })
  };
}

export async function imagesOf(db, productId) {
  const [rows] = await db.query('SELECT path, alt, width, height FROM product_images WHERE product_id = ? ORDER BY position, id', [productId]);
  return rows.map(r => ({ src: r.path, alt: r.alt || '', width: r.width || 0, height: r.height || 0 }));
}

/** Score of an item as it is saved now. Uses the live resolved meta when available, else manual or auto values. */
export async function scoreOf(db, it, manual, auto, resolved, images) {
  const r = it.row, m = it.meta;
  const title = resolved?.title || manual.metaTitle || auto.title, description = resolved?.description || manual.metaDescription || auto.description;
  const bodyText = plain(it.type === 'blog' || it.type === 'page' || it.type === 'product' ? r.body || r.description : it.type === 'category' ? r.description : r.description);
  let dupT = 0, dupD = 0;
  if (it.type === 'product') {
    if (manual.metaTitle) [[{ n: dupT }]] = await db.query("SELECT COUNT(*) n FROM products WHERE meta_title = ? AND id <> ?", [manual.metaTitle, r.id]);
    if (manual.metaDescription) [[{ n: dupD }]] = await db.query("SELECT COUNT(*) n FROM products WHERE meta_desc = ? AND id <> ?", [manual.metaDescription, r.id]);
  }
  const imgs = it.type === 'product' ? images : (r.cover ? [{ src: r.cover, alt: it.name, width: 0 }] : []);
  return scoreItem(it.type, {
    title, description, slug: it.type === 'product' || it.type === 'blog' || it.type === 'page' || it.type === 'brand' ? r.slug : r.id, focusKeyword: manual.focusKeyword || m.focus_keyword || '',
    h1: it.name, bodyText, wordCount: words(bodyText), images: imgs, price: r.price, stock: r.stock, brand: r.brand, gtin: r.gtin, mpn: r.part, noindex: !manual.robotsIndex
  }, { duplicateTitles: Number(dupT) || 0, duplicateDescriptions: Number(dupD) || 0 });
}

export async function writeSeoMeta(db, it, seo, who = '', extra = {}) {
  const cols = { ...seo, ...extra };
  const keys = Object.keys(cols);
  if (!keys.length) return;
  await db.query(
    `INSERT INTO seo_meta (entity_type, entity_id, ${keys.join(', ')}, updated_by) VALUES (?, ?, ${keys.map(() => '?').join(', ')}, ?) ON DUPLICATE KEY UPDATE ${keys.map(k => `${k} = VALUES(${k})`).join(', ')}, updated_by = VALUES(updated_by)`,
    [it.type, it.id, ...keys.map(k => cols[k]), String(who || '').slice(0, 80)]);
}

export async function saveAlts(db, productId, edits) {
  if (!edits.length) return 0;
  const [rows] = await db.query('SELECT path FROM product_images WHERE product_id = ?', [productId]);
  const have = new Set(rows.map(r => r.path));
  let n = 0;
  for (const e of edits) if (have.has(e.src)) { await db.query('UPDATE product_images SET alt = ? WHERE product_id = ? AND path = ?', [e.alt, productId, e.src]); n++; }
  return n;
}

/**
 * Validates and saves the `manual` values of one item (plus image alts for a product), then recomputes its score and stores it in seo_meta.
 * Does NOT clear the public cache: the caller calls bustSeo() once. `resolve(url)` (optional) returns the live resolved { title, description } used for scoring.
 * @returns {Promise<{ok:true, score:number, issues:object[], resolved:object|null}|{ok:false, errors:string[], status:number}>}
 */
export async function saveManual(db, type, id, manual, { who = '', images, resolve, source = 'editor', action = source === 'csv' ? 'csv' : source === 'revert' ? 'revert' : 'save' } = {}) {
  const it = await loadItem(db, type, id);
  if (!it) return { ok: false, errors: ['Item not found'], status: 404 };
  const { values, errors } = validateManual(manual);
  let alts = [];
  try { alts = it.type === 'product' ? cleanImageAlts(images) : []; } catch (e) { errors.push(e.message); }
  if (errors.length) return { ok: false, errors, status: 400 };
  const { own, seo } = splitWrites(it.type, values);
  const before = await historySnap(db, it); // best effort: null when it cannot be read
  const table = { product: 'products', blog: 'blog_posts', page: 'site_pages' }[it.type];
  if (table && Object.keys(own).length) {
    const sets = Object.keys(own).map(k => `${k} = ?`);
    if (it.type === 'product') sets.push('edited = 1');
    await db.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, [...Object.values(own), it.row.id]);
  }
  if (it.type === 'product') await saveAlts(db, it.row.id, alts);
  await writeSeoMeta(db, it, seo, who);
  const fresh = await loadItem(db, it.type, it.id);
  const settings = await settingsOf(db);
  const m = manualFrom(it.type, fresh.row, fresh.meta, { isAutoTitle, isAutoDesc });
  const auto = await autoOf(fresh, settings);
  const resolved = typeof resolve === 'function' ? await resolve(fresh.url) : null;
  const imgs = it.type === 'product' ? await imagesOf(db, fresh.row.id) : undefined;
  const { score, issues } = await scoreOf(db, fresh, m, auto, resolved, imgs);
  await writeSeoMeta(db, fresh, { seo_score: score, seo_issues: JSON.stringify(issues) }, who);
  const historyId = before ? await historyRecord(db, it, before, m, imgs, who, source, action) : null;
  return { ok: true, score, issues, resolved, ...(historyId ? { historyId } : {}) };
}

/** Comparable state of an item for the change history (manual fields + product image alts). null on any failure. */
async function historySnap(db, it, manual, imgs) {
  try {
    const m = manual || manualFrom(it.type, it.row, it.meta, { isAutoTitle, isAutoDesc });
    const list = it.type === 'product' ? imgs || await imagesOf(db, it.row.id) : undefined;
    return snapshot(it.type, m, { imageAlts: list });
  } catch (e) { console.error('seo history snapshot failed:', e.message); return null; }
}
async function historyRecord(db, it, before, m, imgs, who, source, action) {
  try {
    const { recordHistory } = await import('./seoHistory.js');
    const after = await historySnap(db, it, m, imgs);
    if (!after) return null;
    return await recordHistory(db, { type: it.type, id: it.id, action, source, before, after, who });
  } catch (e) { console.error('seo history failed:', e.message); return null; }
}
