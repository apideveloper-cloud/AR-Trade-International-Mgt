// Stores the words-only web address of every product (products.slug) and keeps it unique.
import { productSlug } from './slug.js';

/**
 * The address for one product: the short keyword form; if another product already has it, the longer form; then with the part number;
 * the product id only as a last resort. `taken(slug)` says whether another product uses it.
 */
export async function pickSlug(taken, { id, name, part }) {
  const partSlug = productSlug(part, 40);
  const tries = [productSlug(name), productSlug(name, 100)];
  if (partSlug) tries.push(productSlug(name, 80) + '-' + partSlug);
  for (const s of tries) if (s && !(await taken(s))) return s;
  return (tries[0] || 'product') + '-' + id;
}

/** Gives product `id` its address when it has none (call right after inserting a product). */
export async function assignSlug(db, id) {
  const [[p]] = await db.query('SELECT id, name, part, slug FROM products WHERE id = ?', [id]);
  if (!p || p.slug) return p?.slug || null;
  const slug = await pickSlug(async s => (await db.query('SELECT 1 FROM products WHERE slug = ? AND id <> ? LIMIT 1', [s, id]))[0].length > 0, p);
  await db.query('UPDATE products SET slug = ? WHERE id = ?', [slug, id]);
  return slug;
}

/** Start-up upgrade: adds the column and gives every product without an address one. Live products are done first so they get the cleanest words. */
export async function ensureProductSlugs(pool) {
  const [t] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'");
  if (!t.length) return;
  if (!t.some(r => r.c === 'slug')) {
    await pool.query('ALTER TABLE products ADD COLUMN slug VARCHAR(120) NULL, ADD UNIQUE KEY uq_products_slug (slug)');
    console.log('Added products.slug (words-only product addresses)');
  }
  if (!t.some(r => r.c === 'merged_into')) {
    // set on a listing that was removed as a duplicate of a differently named one: its old address then redirects to that one
    await pool.query('ALTER TABLE products ADD COLUMN merged_into INT NULL');
    console.log('Added products.merged_into (removed duplicates redirect to the listing that stays)');
  }
  const [rows] = await pool.query('SELECT id, name, part FROM products WHERE slug IS NULL ORDER BY active DESC, price > 0 DESC, id');
  if (!rows.length) return;
  const used = new Set((await pool.query('SELECT slug FROM products WHERE slug IS NOT NULL'))[0].map(r => r.slug));
  for (const p of rows) {
    const slug = await pickSlug(async s => used.has(s), p);
    used.add(slug);
    await pool.query('UPDATE products SET slug = ? WHERE id = ?', [slug, p.id]);
  }
  console.log(`Gave ${rows.length} products a words-only address`);
}
