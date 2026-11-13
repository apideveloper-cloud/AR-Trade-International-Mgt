// Pieces the storefront route modules share: product serialisation, site settings and product addressing.
import { pool } from '../db.js';
import { parseJson } from '../util.js';
import { mergeDelivery } from '../delivery.js';
import { published } from '../productImages.js';

/** The columns productOut() reads. The catalogue list and best sellers select just these instead of SELECT *, so the long description, gallery and SEO text are never read for 2,000 products. */
export const LIST_COLS = 'id, category_id, brand, name, old_price, price, img, stock, popular, is_new, featured, tech, color, yield_info, part, compat, spec, extra, slug, warranty';
export const productOut = r => ({
  id: r.id, cat: r.category_id, brand: r.brand, name: r.name, old: r.old_price, price: r.price, img: r.img, stock: r.stock,
  popular: !!r.popular, isNew: !!r.is_new, featured: !!r.featured, tech: r.tech, color: r.color, yield: r.yield_info,
  part: r.part, compat: r.compat, spec: r.spec, extra: parseJson(r.extra) || [], slug: r.slug || '',
  ...(hasWarranty(r) ? {} : { warranty: false }) // only an explicit No is sent: a missing value means Yes, which keeps the 2,000-product list light
});

/** Product warranty available? The column defaults to 1, so a row without the value (older data) counts as Yes. */
export const hasWarranty = r => !(r.warranty === 0 || r.warranty === false);

export async function getSettings() {
  const [rows] = await pool.query('SELECT k, v FROM settings');
  const o = {};
  rows.forEach(r => { o[r.k] = parseJson(r.v); });
  return o;
}

/** The catalogue as the storefront (and the chat assistant) sees it: categories, published products, site settings and content.
 *  `full` adds the category blurbs and pictures and the newest-first order that the bootstrap payload carries. */
export async function loadCatalogue({ full = true } = {}) {
  const [cats] = await pool.query(full
    ? 'SELECT id, title AS t, description AS d, img FROM categories WHERE hidden = 0 ORDER BY sort_order'
    : 'SELECT id, title AS t FROM categories WHERE hidden = 0 ORDER BY sort_order');
  const [prods] = await pool.query(`SELECT ${LIST_COLS} FROM products WHERE active = 1${full ? ' ORDER BY id DESC' : ''}`);
  const s = await getSettings();
  return { cats, products: published(prods).map(productOut), site: s.site && { ...s.site, delivery: mergeDelivery(s.site.delivery) }, content: s.content };
}

/** A product is addressed by its number (/api/products/12552) or by the words of its page address (hp-05a-…); anything else is 0, never NaN. */
export async function productIdParam(v) {
  if (/^\d+$/.test(String(v))) return parseInt(v, 10);
  const [[r]] = await pool.query('SELECT id FROM products WHERE slug = ?', [String(v).slice(0, 120)]);
  return r ? r.id : 0;
}
