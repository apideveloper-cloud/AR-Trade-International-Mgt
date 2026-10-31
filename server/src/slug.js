// Product web addresses: /product/hp-230a-cmyk-toner-cartridge-full-set-21554
//   keywords from the name, lower case, words joined by hyphens, filler words and symbols dropped, short, and the product id at the end so the address is unique and never breaks when a name is edited.
// The storefront has an identical copy of this file (client/src/slug.js): keep the two the same.
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'of', 'with', 'in', 'on', 'at', 'to', 'by', 'from', 'is', 'are', 'as', 'its', 'this', 'that']);
const MAX = 60; // characters of keywords, cut at a whole word

export function productSlug(name) {
  const words = String(name || '').toLowerCase().replace(/&/g, ' ').split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w));
  let out = '';
  for (const w of words) {
    if (out && out.length + 1 + w.length > MAX) break;
    out = out ? out + '-' + w : w.slice(0, MAX);
  }
  return out;
}
/** '/product/hp-230a-cmyk-toner-cartridge-full-set-21554' (or '/product/21554' for a name with no Latin letters or digits). */
export const productPath = p => {
  const s = productSlug(p?.name);
  return '/product/' + (s ? s + '-' : '') + p?.id;
};
/** The product id at the end of the address segment: '...-21554' or '21554' -> '21554'. */
export const productIdOf = seg => (String(seg ?? '').match(/(\d+)$/) || [])[1] || '';
