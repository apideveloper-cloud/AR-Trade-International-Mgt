// Product search for the field app: price + stock. READ-ONLY view of the web shop's `products` table.
//   GET /api/field/products?q=&brand=&mode=stock&level=low|out&sort=name|price|stock&limit=40&offset=0
//     -> { total, brands: [{ name, count }], items: [{ id, name, sku, brand, price, stock, img }] }
// Products priced 0 ("ask for a quotation" in the shop) are hidden from sales unless mode=stock (Purchase Officer's stock view).
// Stock is NOT reduced when an order is placed; it is reduced when the delivery is confirmed (see deliveries.js).
import { Router } from 'express';
import { pool, wrap, guard } from '../common.js';

const router = Router();

/** SKU from the product row, else the "(CF279A)" part of the name, else the first two words. */
export const skuOf = p => {
  if (p.sku) return p.sku;
  const m = /\(([^)]+)\)/.exec(p.name || '');
  if (m) return m[1];
  return String(p.name || '').split(/\s+/).slice(0, 2).join('-').toUpperCase();
};

export const productOut = p => ({ id: p.id, name: p.name, sku: skuOf(p), brand: p.brand, price: p.price, stock: p.stock, img: p.img || '' });

router.get('/', guard(), wrap(async (req, res) => {
  const stockMode = req.query.mode === 'stock';
  const q = String(req.query.q || '').trim().slice(0, 80);
  const brand = String(req.query.brand || '').trim();
  const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 40));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const base = ['active = 1'];
  if (!stockMode) base.push('price > 0');

  const [brands] = await pool.query(`SELECT brand name, COUNT(*) count FROM products WHERE ${base.join(' AND ')} GROUP BY brand ORDER BY count DESC LIMIT 8`);

  const where = [...base], args = [];
  if (brand) { where.push('brand = ?'); args.push(brand); }
  if (req.query.level === 'low') where.push('stock > 0 AND stock <= 5');
  if (req.query.level === 'out') where.push('stock <= 0');
  if (q) { where.push('(name LIKE ? OR sku LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  const order = { price: 'price DESC', stock: 'stock ASC, name', name: 'name' }[req.query.sort] || (stockMode ? 'stock ASC, name' : 'popular DESC, name');
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM products WHERE ${where.join(' AND ')}`, args);
  const [rows] = await pool.query(`SELECT id, name, sku, brand, price, stock, img FROM products WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, [...args, limit, offset]);
  res.json({ total: n, brands, items: rows.map(productOut) });
}));

export default router;
