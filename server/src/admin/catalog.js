// Admin catalogue: products (list, edit, specs, create, hide) and categories.
import sanitizeHtml from 'sanitize-html';
import { pool } from '../db.js';
import { assignSlug } from '../productSlugs.js';
import { fail, parseJson, wrap, isLocalImg, localImg } from '../util.js';
import { buildProductReport } from '../overview.js';
import { whereOf } from '../listing.js';
import { SAN } from '../adminContent.js';
import { normalizeGtin, gtinValid } from '../gtin.js';
import { like, page } from '../adminHelpers.js';

const prodOut = r => ({
  id: r.id, cat: r.category_id, brand: r.brand, name: r.name, old: r.old_price, price: r.price, img: r.img, stock: r.stock, popular: !!r.popular,
  isNew: !!r.is_new, featured: !!r.featured, active: !!r.active, tech: r.tech, color: r.color, yield: r.yield_info, part: r.part, compat: r.compat, spec: r.spec,
  description: r.description || '', gallery: parseJson(r.gallery) || [], source: r.source_url || '', edited: !!r.edited,
  metaTitle: r.meta_title || '', metaDesc: r.meta_desc || '', metaKeywords: r.meta_keywords || '',
  warranty: !(r.warranty === 0 || r.warranty === false), gtin: r.gtin || ''
});
const PROD_COLS = { warranty: 'warranty', metaTitle: 'meta_title', metaDesc: 'meta_desc', metaKeywords: 'meta_keywords', cat: 'category_id', brand: 'brand', name: 'name', old: 'old_price', price: 'price', img: 'img', stock: 'stock', popular: 'popular', isNew: 'is_new', featured: 'featured', active: 'active', tech: 'tech', color: 'color', yield: 'yield_info', part: 'part', compat: 'compat', spec: 'spec' };
const BOOL = new Set(['popular', 'isNew', 'featured', 'active', 'warranty']);
const INT = new Set(['old', 'price', 'stock']);
const META_MAX = { metaTitle: 160, metaDesc: 320, metaKeywords: 500 };

function productPatch(body) {
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(PROD_COLS)) {
    if (!(k in body)) continue;
    let v = body[k];
    if (BOOL.has(k)) v = +!!v; else if (INT.has(k)) v = Math.max(0, parseInt(v, 10) || 0); else v = v == null ? '' : String(v);
    if (META_MAX[k]) v = v.slice(0, META_MAX[k]);
    if (k === 'img') v = localImg(v) || null;
    sets.push(`${col} = ?`); vals.push(v);
  }
  if ('description' in body) { sets.push('description = ?'); vals.push(sanitizeHtml(String(body.description || ''), SAN)); }
  if ('gallery' in body) { sets.push('gallery = ?'); vals.push(JSON.stringify((Array.isArray(body.gallery) ? body.gallery : []).map(u => String(u).trim()).filter(isLocalImg).slice(0, 12))); }
  if (sets.length) sets.push('edited = 1');
  return { sets, vals };
}

/** Reads body.gtin: undefined = not sent, null = clear, else the normalised digits (400 when malformed). */
function gtinOf(body) {
  if (!('gtin' in body)) return undefined;
  const raw = body.gtin == null ? '' : String(body.gtin).trim();
  if (!raw) return null;
  const g = normalizeGtin(raw);
  if (!g) throw fail(400, 'GTIN must be 8, 12, 13 or 14 digits');
  return g;
}
/** Warning text when another product already carries this GTIN (saving is still allowed). */
async function gtinWarning(g, id) {
  if (!g) return '';
  const [[o]] = await pool.query('SELECT id FROM products WHERE gtin = ? AND id <> ? ORDER BY id LIMIT 1', [g, id]);
  return [o && `Same GTIN as product ${o.id}`, !gtinValid(g) && 'GTIN check digit does not match (saved anyway)'].filter(Boolean).join('. ');
}

/** Runs UPDATE <table> SET <sets> WHERE id = ? and returns how many rows matched. */
const updateById = async (table, sets, vals, id) => (await pool.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]))[0].affectedRows;

export function mountCatalogRoutes(router, guard) {
  // ---------- products ----------
  router.get('/products', guard('products.view'), wrap(async (req, res) => {
    const { size, offset } = page(req);
    const cond = [], params = [];
    if (req.query.q) { cond.push('(name LIKE ? OR brand LIKE ? OR part LIKE ? OR id = ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q), Number(req.query.q) || 0); }
    if (req.query.cat && req.query.cat !== 'all') { cond.push('category_id = ?'); params.push(req.query.cat); }
    if (req.query.priced === '1') cond.push('price > 0'); // products with a selling price (the New order picker: a product without one cannot be ordered)
    if (req.query.stock === 'low') cond.push('price > 0 AND stock <= 5');
    if (req.query.live === '0') cond.push('active = 0');
    const where = whereOf(cond);
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM products ${where}`, params);
    const [rows] = await pool.query(`SELECT * FROM products ${where} ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`, params);
    const [[a]] = await pool.query(`SELECT COUNT(*) total, SUM(active = 1) live, SUM(active = 0) hidden,
      SUM(active = 1 AND price > 0 AND stock <= 0) outOfStock, SUM(active = 1 AND price > 0 AND stock BETWEEN 1 AND 5) low,
      SUM(active = 1 AND price = 0) quote, SUM(active = 1 AND (img IS NULL OR img = '')) noImage,
      COALESCE(SUM(CASE WHEN active = 1 THEN price * stock END), 0) stockValue FROM products`);
    const [[cc]] = await pool.query('SELECT COUNT(*) n FROM categories WHERE hidden = 0');
    const summary = { total: Number(a.total), live: Number(a.live), hidden: Number(a.hidden), outOfStock: Number(a.outOfStock), low: Number(a.low), quote: Number(a.quote), noImage: Number(a.noImage), stockValue: Number(a.stockValue), categories: cc.n };
    res.json({ total: n, summary, rows: rows.map(prodOut) });
  }));

  router.put('/products/:id', guard('products.manage'), wrap(async (req, res) => {
    const { sets, vals } = productPatch(req.body);
    const gtin = gtinOf(req.body);
    if (gtin !== undefined) { sets.push('gtin = ?'); vals.push(gtin); if (sets.length === 1) sets.push('edited = 1'); }
    if (!sets.length) throw fail(400, 'Nothing to update');
    if (!(await updateById('products', sets, vals, req.params.id))) throw fail(404, 'Product not found');
    const [[p]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    const warn = await gtinWarning(p.gtin, p.id);
    res.json(warn ? { ...prodOut(p), gtinWarning: warn } : prodOut(p));
  }));

  router.get('/products/:id/report', guard(['products.view', 'dashboard.view']), wrap(async (req, res) => { res.json(await buildProductReport(pool, req.params.id, req.query.asOf, Number(req.query.range) || 30)); }));
  router.get('/products/:id/full', guard('products.view'), wrap(async (req, res) => {
    const [[p]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) throw fail(404, 'Product not found');
    const [specs] = await pool.query('SELECT name, value FROM product_specs WHERE product_id = ? ORDER BY position', [p.id]);
    res.json({ ...prodOut(p), specs, short: p.short_desc || '', sku: p.sku || '' });
  }));
  router.put('/products/:id/specs', guard('products.manage'), wrap(async (req, res) => {
    const [[ex]] = await pool.query('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (!ex) throw fail(404, 'Product not found');
    const rows = (Array.isArray(req.body.specs) ? req.body.specs : []).map(s => [String(s.name || '').trim().slice(0, 80), String(s.value || '').trim().slice(0, 500)]).filter(s => s[0] && s[1]).slice(0, 40);
    await pool.query('DELETE FROM product_specs WHERE product_id = ?', [req.params.id]);
    for (const [i, [n, v]] of rows.entries()) await pool.query('INSERT INTO product_specs (product_id, position, name, value) VALUES (?,?,?,?)', [req.params.id, i, n, v]);
    await pool.query('UPDATE products SET edited = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true, count: rows.length });
  }));
  router.post('/products', guard('products.manage'), wrap(async (req, res) => {
    const b = req.body;
    if (typeof b.name !== 'string' || typeof b.cat !== 'string' || typeof b.brand !== 'string' || !b.name || !b.cat || !b.brand) throw fail(400, 'Name, brand and category are required');
    const gtin = gtinOf(b);
    const [[{ m }]] = await pool.query('SELECT COALESCE(MAX(id), 29999) m FROM products WHERE id >= 30000');
    const id = Math.max(30000, m + 1);
    await pool.query('INSERT INTO products (id,category_id,brand,name,old_price,price,img,stock,is_new,active,tech,color,yield_info,part,compat,spec,description,gallery,edited) VALUES (?,?,?,?,?,?,?,?,1,1,?,?,?,?,?,?,?,?,1)',
      [id, b.cat, b.brand, b.name, Math.max(0, parseInt(b.old, 10) || 0), Math.max(0, parseInt(b.price, 10) || 0), localImg(b.img) || null, Math.max(0, parseInt(b.stock, 10) || 0), String(b.tech || ''), String(b.color || ''), String(b.yield || ''), String(b.part || ''), String(b.compat || ''), String(b.spec || ''), sanitizeHtml(String(b.description || ''), SAN), JSON.stringify((Array.isArray(b.gallery) ? b.gallery : (b.img ? [b.img] : [])).map(u => String(u).trim()).filter(isLocalImg).slice(0, 12))]);
    await assignSlug(pool, id);
    if ('warranty' in b) await pool.query('UPDATE products SET warranty = ? WHERE id = ?', [+!!b.warranty, id]);
    if (gtin) await pool.query('UPDATE products SET gtin = ? WHERE id = ?', [gtin, id]);
    const [[p]] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    const warn = await gtinWarning(gtin, id);
    res.json(warn ? { ...prodOut(p), gtinWarning: warn } : prodOut(p));
  }));

  router.delete('/products/:id', guard('products.manage'), wrap(async (req, res) => {
    await pool.query('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  }));

  // ---------- categories ----------
  router.get('/categories', guard('products.view'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT c.id, c.title, c.description, c.hidden, c.img, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) n, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) total FROM categories c ORDER BY c.sort_order');
    res.json(rows.map(r => ({ id: r.id, title: r.title, description: r.description, hidden: !!r.hidden, img: r.img || '', count: r.n, total: r.total })));
  }));
  /** New product category. The id is made from the name (it becomes the shop address /shop/<id>) and made unique. */
  router.post('/categories', guard('categories.manage'), wrap(async (req, res) => {
    const title = String(req.body.title || '').trim().slice(0, 120);
    if (title.length < 2) throw fail(400, 'Give the category a name (at least 2 characters)');
    const [[dupe]] = await pool.query('SELECT id FROM categories WHERE LOWER(title) = LOWER(?)', [title]);
    if (dupe) throw fail(409, 'A category with this name already exists');
    // keep Bangla vowel signs and joiners (they are marks, not letters), otherwise a name like ক্যামেরা falls apart in the address
    const base = (title.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'category');
    let id = ['all', 'new', 'search'].includes(base) ? base + '-category' : base;
    for (let i = 2; (await pool.query('SELECT 1 FROM categories WHERE id = ?', [id]))[0].length; i++) id = base + '-' + i;
    const img = req.body.image ? localImg(req.body.image, 'The picture must be uploaded here') : null;
    const [[m]] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) m FROM categories');
    await pool.query('INSERT INTO categories (id, title, description, sort_order, hidden, img) VALUES (?,?,?,?,?,?)', [id, title, String(req.body.description || '').trim().slice(0, 255), m.m + 1, +!!req.body.hidden, img || null]);
    res.json({ id });
  }));
  /** Only a category with no products at all can be deleted. */
  router.delete('/categories/:id', guard('categories.manage'), wrap(async (req, res) => {
    const [[n]] = await pool.query('SELECT COUNT(*) n FROM products WHERE category_id = ?', [req.params.id]);
    if (n.n) throw fail(409, `This category still has ${n.n} product${n.n === 1 ? '' : 's'}. Move or delete them first, or just hide the category.`);
    const [r] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) throw fail(404, 'Category not found');
    res.json({ ok: true });
  }));
  router.put('/categories/:id', guard('categories.manage'), wrap(async (req, res) => {
    const sets = [], vals = [];
    if ('title' in req.body) {
      const title = String(req.body.title || '').trim().slice(0, 120);
      if (title.length < 2) throw fail(400, 'Give the category a name (at least 2 characters)');
      const [[dupe]] = await pool.query('SELECT id FROM categories WHERE LOWER(title) = LOWER(?) AND id <> ?', [title, req.params.id]);
      if (dupe) throw fail(409, 'Another category already has this name');
      sets.push('title = ?'); vals.push(title);
    }
    if ('description' in req.body) { sets.push('description = ?'); vals.push(String(req.body.description || '').trim().slice(0, 255)); }
    if ('hidden' in req.body) { sets.push('hidden = ?'); vals.push(+!!req.body.hidden); }
    if ('image' in req.body) { // the picture shown on the storefront category tile; empty = go back to the automatic one
      const u = localImg(req.body.image, 'The picture must be uploaded here');
      sets.push('img = ?'); vals.push(u || null);
    }
    if (!sets.length) throw fail(400, 'Nothing to update');
    if (!(await updateById('categories', sets, vals, req.params.id))) throw fail(404, 'Category not found');
    res.json({ ok: true });
  }));
}
