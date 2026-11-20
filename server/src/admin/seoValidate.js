// Pure validators for the SEO product fields and the preview request (no database, unit-tested).
export const CONDITIONS = ['new', 'refurbished', 'used'];
export const STOCK_STATUSES = ['auto', 'in_stock', 'out_of_stock', 'preorder', 'backorder'];
export const PREVIEW_FIELDS = ['title', 'description', 'ogTitle', 'ogDescription'];
export const PREVIEW_KINDS = ['product', 'category', 'brand', 'blog', 'page', 'home'];
export const WARRANTY_MAX = 300;
export const TEMPLATE_MAX = 300;
export const MAX_FOR = { title: 60, ogTitle: 60, description: 155, ogDescription: 155 };

/** Each of these returns the clean value or throws Error (the message is user-facing). */
export function conditionOf(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!CONDITIONS.includes(s)) throw new Error('Condition must be new, refurbished or used');
  return s;
}
export function stockStatusOf(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!STOCK_STATUSES.includes(s)) throw new Error('Stock status must be one of: ' + STOCK_STATUSES.join(', '));
  return s;
}
/** '' / null -> null (no end date); otherwise a real calendar date YYYY-MM-DD. */
export function saleEndsOf(v) {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error('Sale end date must be YYYY-MM-DD');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new Error('Sale end date is not a real date');
  return s;
}
export function warrantyTextOf(v) {
  const s = v == null ? '' : String(v).trim();
  if (s.length > WARRANTY_MAX) throw new Error(`Warranty text can be at most ${WARRANTY_MAX} characters`);
  return s;
}
export const noindexOf = v => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

/** Reads the five new product fields from a request body: { sets: ['col = ?'], vals } for the keys that were sent. Throws Error on bad input. */
export function productSeoFields(body) {
  const sets = [], vals = [];
  const add = (key, col, fn) => { if (key in body) { sets.push(`${col} = ?`); vals.push(fn(body[key])); } };
  add('itemCondition', 'item_condition', conditionOf);
  add('saleEnds', 'sale_ends', saleEndsOf);
  add('stockStatus', 'stock_status', stockStatusOf);
  add('warrantyText', 'warranty_text', warrantyTextOf);
  add('noindex', 'noindex', noindexOf);
  return { sets, vals };
}

/** A preview request made safe: { kind, field, template (clamped; null = use the saved one), id }. Throws Error on a bad kind or field. */
export function previewInput(b) {
  b = b && typeof b === 'object' ? b : {};
  const kind = String(b.kind || 'product');
  if (!PREVIEW_KINDS.includes(kind)) throw new Error('Unknown page kind');
  const field = String(b.field || 'title');
  if (!PREVIEW_FIELDS.includes(field)) throw new Error('Unknown field');
  const template = typeof b.template === 'string' ? b.template.slice(0, TEMPLATE_MAX) : null;
  const id = b.id == null ? '' : String(b.id).trim().slice(0, 80);
  return { kind, field, template, id };
}
