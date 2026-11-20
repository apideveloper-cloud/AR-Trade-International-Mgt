// Product picker, new-product creation, stock list, movement history and stock-count adjustments.
import { Router } from 'express';
import sanitizeHtml from 'sanitize-html';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { SAN } from '../adminContent.js';
import { assignSlug } from '../productSlugs.js';
import { fail, localImg, text, tx, wrap } from '../util.js';
import { addSearch, pageOf, whereOf, wantsPage } from '../listing.js';
import { VIEW, MANAGE, LOW } from './constants.js';
import { move } from './helpers.js';
import { noteCatalogChange } from '../growth/changeHooks.js';

const router = Router();
const LAST_COST = "(SELECT unit_cost FROM stock_moves m WHERE m.product_id = products.id AND m.kind = 'Purchase' ORDER BY m.id DESC LIMIT 1)";

router.get('/products', guard(VIEW), wrap(async (req, res) => {
  const q = '%' + text(req.query.q, 60).replace(/[%_]/g, '') + '%';
  const [rows] = await pool.query(`SELECT id, brand, name, price, stock, img, ${LAST_COST} lastCost FROM products WHERE (name LIKE ? OR brand LIKE ? OR CAST(id AS CHAR) LIKE ?) ORDER BY active DESC, name LIMIT 25`, [q, q, q]);
  res.json({ items: rows });
}));

/** The categories a new product can be filed under (the Products page is only for editing). */
router.get('/categories', guard(VIEW), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, title FROM categories ORDER BY sort_order');
  res.json({ items: rows });
}));

/** A product that is bought for the first time is created here, with the purchase. Price and stock start at 0 and stay hidden from the shop until its first purchase is stocked in. */
router.post('/products', guard(MANAGE), wrap(async (req, res) => {
  const b = req.body || {};
  const name = text(b.name, 200), brand = text(b.brand, 80), cat = text(b.cat, 60);
  if (!name || !brand || !cat) throw fail(400, 'Name, brand and category are required');
  const [[c]] = await pool.query('SELECT id FROM categories WHERE id = ?', [cat]);
  if (!c) throw fail(400, 'Choose a category');
  const [[dup]] = await pool.query('SELECT id FROM products WHERE name = ? AND brand = ? LIMIT 1', [name, brand]);
  if (dup) throw fail(409, 'This product already exists (#' + dup.id + '). Search for it instead.');
  const [[{ m }]] = await pool.query('SELECT COALESCE(MAX(id), 29999) m FROM products WHERE id >= 30000');
  const id = Math.max(30000, m + 1);
  const gallery = (Array.isArray(b.gallery) ? b.gallery : []).map(u => localImg(u)).filter(Boolean).slice(0, 12);
  const img = localImg(b.img) || gallery[0] || null;
  await tx(async conn => {
    await conn.query("INSERT INTO products (id, category_id, brand, name, old_price, price, img, stock, is_new, active, part, tech, color, yield_info, spec, compat, description, gallery, meta_title, meta_desc, meta_keywords, edited) VALUES (?,?,?,?,0,0,?,0,1,0,?,?,?,?,?,?,?,?,?,?,?,1)",
      [id, cat, brand, name, img, text(b.part, 80), text(b.tech, 80), text(b.color, 60), text(b.yield, 80), text(b.spec, 200), text(b.compat, 500), sanitizeHtml(String(b.description || ''), SAN), JSON.stringify(gallery), text(b.metaTitle, 160), text(b.metaDesc, 320), text(b.metaKeywords, 500)]);
    const specs = (Array.isArray(b.specs) ? b.specs : []).map(s => [text(s.name, 80), text(s.value, 500)]).filter(s => s[0] && s[1]).slice(0, 40);
    for (const [i, [n, v]] of specs.entries()) await conn.query('INSERT INTO product_specs (product_id, position, name, value) VALUES (?,?,?,?)', [id, i, n, v]);
  });
  await assignSlug(pool, id);
  res.json({ id, brand, name, price: 0, stock: 0, img: img || '', lastCost: null });
}));

router.get('/stock', guard(VIEW), wrap(async (req, res) => {
  const filter = req.query.filter;
  const cond = [], args = [];
  addSearch(cond, args, ['name', 'brand', 'sku'], req.query.q);
  if (filter === 'low') cond.push(`stock BETWEEN 1 AND ${LOW}`);
  if (filter === 'out') cond.push('stock <= 0');
  if (filter === 'hidden') cond.push('active = 0');
  if (req.query.brand) { cond.push('brand = ?'); args.push(text(req.query.brand, 80)); }
  const where = whereOf(cond);
  const paged = wantsPage(req);
  const { size, offset } = paged ? pageOf(req) : { size: 300, offset: 0 };
  const [[rows], [[t]]] = await Promise.all([pool.query(`SELECT id, brand, name, price, stock, img, active, ${LAST_COST} last_cost FROM products ${where} ORDER BY stock, name LIMIT ${size} OFFSET ${offset}`, args), pool.query(`SELECT COUNT(*) products, COALESCE(SUM(stock), 0) units, COALESCE(SUM(price * stock), 0) value, COALESCE(SUM(stock <= 0 AND active = 1), 0) out_n, COALESCE(SUM(stock BETWEEN 1 AND ${LOW} AND active = 1), 0) low_n FROM products`)]);
  const out = rows.map(r => ({ id: r.id, brand: r.brand, name: r.name, price: r.price, stock: r.stock, img: r.img, active: !!r.active, lastCost: r.last_cost }));
  const body = { low: LOW, items: out, totals: { products: Number(t.products), units: Number(t.units), value: Number(t.value), out: Number(t.out_n), lowCount: Number(t.low_n) } };
  if (!paged) return res.json(body);
  const [[[c]], [brands]] = await Promise.all([pool.query(`SELECT COUNT(*) n FROM products ${where}`, args), pool.query("SELECT DISTINCT brand FROM products WHERE brand <> '' ORDER BY brand")]);
  res.json({ ...body, total: Number(c.n), rows: out, brands: brands.map(b => b.brand) });
}));

router.get('/stock/:id/moves', guard(VIEW), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, kind, qty, unit_cost, balance, ref, note, staff_name, created_at FROM stock_moves WHERE product_id = ? ORDER BY id DESC LIMIT 100', [req.params.id]);
  res.json({ items: rows.map(m => ({ id: m.id, kind: m.kind, qty: m.qty, unitCost: m.unit_cost, balance: m.balance, ref: m.ref, note: m.note, by: m.staff_name, at: m.created_at })) });
}));

router.post('/stock/adjust', guard(MANAGE), wrap(async (req, res) => {
  const productId = parseInt(req.body.productId, 10), counted = req.body.counted === null || req.body.counted === '' || req.body.counted === undefined ? NaN : Math.round(Number(req.body.counted)); // empty must not mean 0
  const note = text(req.body.note, 300);
  if (!productId || !Number.isInteger(counted) || counted < 0) throw fail(400, 'Enter the quantity you counted');
  if (!note) throw fail(400, 'Write the reason for the correction');
  await tx(async conn => {
    const [[p]] = await conn.query('SELECT stock FROM products WHERE id = ? FOR UPDATE', [productId]);
    if (!p) throw fail(404, 'Product not found');
    if (counted !== p.stock) await move(conn, { productId, delta: counted - p.stock, kind: 'Adjust', note, by: req.staff.name });
  });
  noteCatalogChange({ productIds: [productId], reason: 'inventory' });
  res.json({ ok: true });
}));

export default router;
