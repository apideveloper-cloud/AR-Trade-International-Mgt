import { MEGA, MENUS } from '../../data.js';

/** Shop link, optionally filtered by a search term. */
export const shopLink = (c, qq) => `/shop/${c}${qq ? '?q=' + encodeURIComponent(qq) : ''}`;

/** Mega-menu groups with product counts, a cover image and up to three product picks each. */
export function buildGroups(products) {
  return MEGA.map(g => {
    const pr = products.filter(p => p.cat === g.c);
    return { ...g, n: pr.length, img: pr.find(p => p.img)?.img || '', picks: pr.filter(p => p.img).slice(0, 3) };
  });
}

/** Dropdowns for the main categories: everything, then the five biggest brands with product counts. */
export function buildMenus(products, cats, content) {
  return MENUS.map(m => {
    if (m.k && content.menus && Array.isArray(content.menus[m.k]) && content.menus[m.k].length) return { ...m, items: content.menus[m.k] };
    if (!m.cat) return m;
    const pr = products.filter(p => p.cat === m.cat);
    const brands = {};
    pr.forEach(p => { brands[p.brand] = (brands[p.brand] || 0) + 1; });
    const top = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const title = (cats.find(c => c.id === m.cat) || {}).t || m.t;
    return { ...m, title, items: [{ t: `All ${title} (${pr.length})`, to: '/shop/' + m.cat }, ...top.map(([b, n]) => ({ t: `${b} (${n})`, to: shopLink(m.cat, b) }))] };
  });
}
