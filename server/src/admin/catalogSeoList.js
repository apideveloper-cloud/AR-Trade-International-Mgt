// SEO pieces of the admin product list: the optional `seo` filter and the join that brings in each product's score.

/** LEFT JOIN of the product SEO row (alias sm); products is aliased p. entity_id is the product id as text; the unique key keeps it one row per product. */
export const SEO_JOIN = "LEFT JOIN seo_meta sm ON sm.entity_type = 'product' AND sm.entity_id = CAST(p.id AS CHAR) COLLATE utf8mb4_unicode_ci";

/** WHERE condition for ?seo= : 'low' (score under 50), 'unscored' (no score), 'noindex'; null for anything else. */
export function seoCondition(v) {
  if (v === 'low') return 'sm.seo_score < 50';
  if (v === 'unscored') return 'sm.seo_score IS NULL';
  if (v === 'noindex') return 'p.noindex = 1';
  return null;
}

/** The score of a list row as a number, or null when the product has not been scored. */
export const seoScoreOf = r => (r && r.seo_score != null ? Number(r.seo_score) : null);
