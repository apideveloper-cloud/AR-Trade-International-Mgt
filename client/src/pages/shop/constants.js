/** Shop constants. PG must equal PG in server/src/seoHelpers.js (server-side pagination SEO). */
export const PG = 24;
export const SORTS = [['pop', '★', 'Popular'], ['low', '↑', 'Price low'], ['high', '↓', 'Price high'], ['off', '%', 'Discount'], ['new', '✦', 'Newest']];
export const SORT_FN = {
  pop: (a, b) => b.popular - a.popular, low: (a, b) => (a.price || 1e9) - (b.price || 1e9), high: (a, b) => b.price - a.price,
  off: (a, b) => (b.old && b.price ? 1 - b.price / b.old : 0) - (a.old && a.price ? 1 - a.price / a.old : 0), new: (a, b) => b.isNew - a.isNew
};
export const FILTERS0 = { brand: 'all', inStock: false, fSale: false, fNew: false, pmin: null, pmax: null };
/** Short taka label: 12500 -> "৳ 12.5k". */
export const fmtK = n => (n >= 1000 ? '৳ ' + Math.round(n / 100) / 10 + 'k' : '৳ ' + n);
