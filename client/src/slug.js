// Product web addresses are words only: /product/hp-230a-cmyk-toner-cartridge-full-set
//   keywords from the name, lower case, words joined by hyphens, filler words and symbols dropped (Google: descriptive words, not ID numbers).
//   The address is stored in products.slug when the product is created and stays the same when the name is edited.
//   Older addresses that end in the product id (/product/hp-230a-toner-21554, /product/21554) still work: the server redirects them to the stored one.
// The storefront has an identical copy of this file (client/src/slug.js): keep the two the same.
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'of', 'with', 'in', 'on', 'at', 'to', 'by', 'from', 'is', 'are', 'as', 'its', 'this', 'that']);
const MAX = 60; // characters of keywords, cut at a whole word

export function productSlug(name, max = MAX) {
  const words = String(name || '').toLowerCase().replace(/&/g, ' ').split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w));
  let out = '';
  for (const w of words) {
    if (out && out.length + 1 + w.length > max) break;
    out = out ? out + '-' + w : w.slice(0, max);
  }
  return out;
}
/** The old address form, with the product id at the end: 'hp-230a-cmyk-toner-cartridge-full-set-21554' (or '21554' for a name with no Latin letters or digits). */
export const legacySlug = p => {
  const s = productSlug(p?.name);
  return (s ? s + '-' : '') + p?.id;
};
/** '/product/hp-230a-cmyk-toner-cartridge-full-set'. A product that has no stored address yet falls back to the old id form, which the server redirects. */
export const productPath = p => '/product/' + (p?.slug || legacySlug(p));
/** The product id at the end of an old address segment: '...-21554' or '21554' -> '21554'. */
export const productIdOf = seg => (String(seg ?? '').match(/(\d+)$/) || [])[1] || '';
