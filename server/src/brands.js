// Brands: one row per distinct products.brand, with a web address (slug) like /brand/hp.
// brandSlug rule (the storefront derives slugs with the SAME rule, keep them identical):
//   trim, lower case, every run of characters other than a-z / 0-9 becomes one '-', no leading or trailing '-'.
//   'HP' -> 'hp', 'D-Link' -> 'd-link', 'TP Link' -> 'tp-link', ' brother' -> 'brother'.
export function brandSlug(name) {
  return String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** Inserts a brand row for every distinct non-empty products.brand (INSERT IGNORE by slug: two names with one slug keep the first). Returns how many were added. */
export async function ensureBrands(pool) {
  const [rows] = await pool.query("SELECT DISTINCT TRIM(brand) b FROM products WHERE brand IS NOT NULL AND TRIM(brand) <> '' ORDER BY b");
  const seen = new Set(), vals = [];
  for (const r of rows) {
    const name = String(r.b).slice(0, 80), slug = brandSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug); vals.push([slug, name]);
  }
  if (!vals.length) return 0;
  const [res] = await pool.query('INSERT IGNORE INTO brands (slug, name) VALUES ?', [vals]);
  return res.affectedRows || 0;
}
