// Finds products that fit what the customer asked for.
import { squash } from './text.js';

/** True when the product fits the type, brand, technology and feature wishes in ctx. */
function matches(p, ctx) {
  if (ctx.cat && p.cat !== ctx.cat) return false;
  if (ctx.brand && String(p.brand).toLowerCase() !== ctx.brand.toLowerCase()) return false;
  const label = `${p.name} ${p.tech || ''} ${p.spec || ''} ${p.color || ''}`.toLowerCase();
  if (ctx.tech && !(String(p.tech || '').toLowerCase().includes(ctx.tech.toLowerCase()) || label.includes(ctx.tech.toLowerCase()))) return false;
  const f = ctx.flags || {};
  if (f.color && !/colou?r/.test(label)) return false;
  if (f.mono && /colou?r/.test(label) && !/mono/.test(label)) return false;
  if (f.wifi && !/wi-?fi|wireless/.test(label)) return false;
  if (f.multi && !/multi|all[\s-]*in[\s-]*one|mfp|3\s*in\s*1|scan/.test(label)) return false;
  if (f.duplex && !/duplex/.test(label)) return false;
  return true;
}

/** Picks up to 3 products: exact model matches first, otherwise by wishes and budget, relaxing the wishes when nothing fits. */
export function searchProducts(ctx, models, products) {
  if (models.length) {
    const test = p => {
      const label = `${p.name} ${p.part || ''} ${p.sku || ''} ${p.brand || ''} ${p.compat || ''}`;
      const hay = squash(label), words = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      return models.every(m => words.includes(m) || (m.length >= 6 && hay.includes(m)));
    };
    let hits = products.filter(test);
    // "toner for HP M12w": the product type asked for wins over the printer the model number belongs to
    if (ctx.cat) hits = hits.filter(p => p.cat === ctx.cat);
    return { list: hits.sort((a, b) => (b.stock > 0) - (a.stock > 0) || (b.price > 0) - (a.price > 0)).slice(0, 3), exact: true, total: hits.length };
  }
  const run = c => {
    let pool = products.filter(p => matches(p, c));
    const priced = pool.filter(p => p.price > 0);
    const budgeted = c.min != null || c.max != null;
    if (budgeted) pool = priced.filter(p => p.price >= (c.min || 0) && p.price <= (c.max ?? Infinity));
    else if (priced.length) pool = priced;
    const inStock = pool.filter(p => p.stock > 0);
    if (inStock.length) pool = inStock;
    if (c.sort === 'cheap' || budgeted) pool = pool.slice().sort((a, b) => a.price - b.price);
    else if (c.sort === 'best') pool = pool.slice().sort((a, b) => b.price - a.price);
    else pool = pool.slice().sort((a, b) => (b.popular - a.popular) || (b.featured - a.featured) || (b.price > 0) - (a.price > 0));
    return pool;
  };
  const budgeted = ctx.min != null || ctx.max != null;
  let pool = run(ctx);
  let list = pool.slice(0, 3);
  let near = false, relaxed = null;
  // no match for every wish: first drop the extras (Wi-Fi, colour...), then the budget, and say so
  if (!list.length) {
    const steps = [{ ...ctx, flags: {}, tech: null }, { ...ctx, flags: {}, tech: null, min: null, max: null }];
    for (const c of steps) {
      const p2 = run(c);
      if (p2.length) {
        pool = p2; list = p2.slice(0, 3); near = true; relaxed = c;
        if (budgeted && c.min == null) {
          const target = ctx.max !== Infinity && ctx.max != null ? ctx.max : ctx.min;
          const priced = products.filter(p => matches(p, c) && p.price > 0 && p.stock > 0);
          if (priced.length) list = priced.sort((a, b) => Math.abs(a.price - target) - Math.abs(b.price - target)).slice(0, 3);
        }
        break;
      }
    }
  }
  return { list, exact: false, total: pool.length, near, relaxed };
}
