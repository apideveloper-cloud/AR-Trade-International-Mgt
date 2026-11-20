// Pure mapping and validation for the per-item SEO tab (no database, unit-tested).
import { brandSlug } from '../brands.js';

export const TYPES = ['product', 'category', 'brand', 'blog', 'page'];
export const LIMITS = { title: [30, 60], description: [120, 155] };
const CTRL = /[\u0000-\u001f\u007f-\u009f]/g;

/** Text made safe: not a string/number -> '', HTML tags and control characters removed, whitespace collapsed. */
export function cleanText(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v).replace(/<[^>]*>/g, ' ').replace(CTRL, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}
const bool = v => (v === true || v === 1 || v === '1' || v === 'true' ? true : v === false || v === 0 || v === '0' || v === 'false' ? false : null);

export function isHttpsUrl(s) {
  if (!/^https:\/\/[^\s"'<>]+$/i.test(s)) return false;
  try { return !!new URL(s).hostname; } catch { return false; }
}

/**
 * Validates the `manual` part of a save request. Only the keys that were sent are returned.
 * @returns {{ values: object, errors: string[] }}
 */
export function validateManual(manual) {
  const m = manual && typeof manual === 'object' && !Array.isArray(manual) ? manual : {};
  const values = {}, errors = [];
  const text = (key, max, label) => {
    if (!(key in m)) return;
    const s = cleanText(m[key]);
    if (s.length > max) errors.push(`${label} can be at most ${max} characters`); else values[key] = s;
  };
  text('metaTitle', 160, 'Meta title'); text('metaDescription', 320, 'Meta description'); text('metaKeywords', 500, 'Meta keywords');
  text('focusKeyword', 120, 'Focus keyword');
  text('ogTitle', 160, 'Social title'); text('ogDescription', 320, 'Social description');
  text('twitterTitle', 160, 'Twitter title'); text('twitterDescription', 320, 'Twitter description');
  if ('secondaryKeywords' in m) {
    const a = m.secondaryKeywords;
    if (!Array.isArray(a)) errors.push('Secondary keywords must be a list');
    else {
      const list = a.map(cleanText).filter(Boolean);
      if (list.length > 12) errors.push('At most 12 secondary keywords');
      else if (list.some(k => k.length > 60)) errors.push('A secondary keyword can be at most 60 characters');
      else values.secondaryKeywords = [...new Set(list)];
    }
  }
  if ('canonicalUrl' in m) {
    const s = typeof m.canonicalUrl === 'string' ? m.canonicalUrl.trim() : '';
    if (!s) values.canonicalUrl = '';
    else if (s.length > 500 || !isHttpsUrl(s)) errors.push('Canonical URL must be an absolute https address');
    else values.canonicalUrl = s;
  }
  if ('ogImage' in m) {
    const s = typeof m.ogImage === 'string' ? m.ogImage.trim() : '';
    if (!s) values.ogImage = '';
    else if (s.length > 500 || /[\s"'<>]/.test(s) || !(isHttpsUrl(s) || (s.startsWith('/') && !s.startsWith('//')))) errors.push('Social image must be an https address or a path starting with /');
    else values.ogImage = s;
  }
  for (const k of ['robotsIndex', 'robotsFollow']) {
    if (!(k in m)) continue;
    const b = bool(m[k]);
    if (b === null) errors.push(`${k === 'robotsIndex' ? 'Index' : 'Follow'} must be true or false`); else values[k] = b;
  }
  if ('faq' in m) {
    if (!Array.isArray(m.faq)) errors.push('FAQ must be a list');
    else {
      const out = [];
      let bad = false;
      for (const it of m.faq) {
        const q = cleanText(it?.q), a = cleanText(it?.a);
        if (!q && !a) continue;
        if (!q || !a) { errors.push('Every FAQ needs both a question and an answer'); bad = true; break; }
        if (q.length > 200) { errors.push('A FAQ question can be at most 200 characters'); bad = true; break; }
        if (a.length > 2000) { errors.push('A FAQ answer can be at most 2000 characters'); bad = true; break; }
        out.push({ q, a });
      }
      if (!bad) { if (out.length > 20) errors.push('At most 20 FAQs'); else values.faq = out; }
    }
  }
  return { values, errors };
}

/** Alt text edits from a request: [{src, alt}] clean; entries without a string src are ignored. Throws Error when an alt is longer than 255. */
export function cleanImageAlts(images) {
  if (!Array.isArray(images)) return [];
  const out = [];
  for (const i of images.slice(0, 40)) {
    if (!i || typeof i.src !== 'string') continue;
    const alt = cleanText(i.alt);
    if (alt.length > 255) throw new Error('Image alt text can be at most 255 characters');
    out.push({ src: i.src.trim(), alt });
  }
  return out;
}

/** Fills only EMPTY alts: '{name} - {brand}' (or just the name) for the first image, '{name} - view {n}' for the others. */
export function autofillAlts(images, name, brand) {
  const n = cleanText(name), b = cleanText(brand);
  return (images || []).map((im, idx) => {
    if (cleanText(im.alt)) return im;
    return { ...im, alt: (idx === 0 ? (b ? `${n} - ${b}` : n) : `${n} - view ${idx + 1}`).slice(0, 255) };
  });
}

/** The slug typed by an editor -> { slug } or { error }. Lower case, a-z 0-9 and '-', 3 to 120 characters. */
export function normaliseSlug(v) {
  const s = String(v ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length < 3) return { error: 'The web address needs at least 3 letters or digits' };
  if (s.length > 120) return { error: 'The web address can be at most 120 characters' };
  return { slug: s };
}

/** Public address of an item. Site pages: servicing -> /services/x, clients -> /clients/x, company -> /about/x. */
export function urlFor(type, row) {
  if (type === 'product') return '/product/' + (row.slug || row.id);
  if (type === 'category') return '/shop/' + row.id;
  if (type === 'brand') return '/brand/' + row.slug;
  if (type === 'blog') return '/blog/' + row.slug;
  return (row.grp === 'clients' ? '/clients/' : row.grp === 'company' ? '/about/' : '/services/') + row.slug;
}

export const jsonList = v => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; } };

/**
 * The manual values shown in the editor. `row` = the item's own row, `meta` = its seo_meta row ({} when none).
 * Product meta columns count only when hand-written (isAuto* says whether a stored value is generated).
 */
export function manualFrom(type, row, meta, { isAutoTitle = () => false, isAutoDesc = () => false } = {}) {
  const r = row || {}, m = meta || {};
  const own = type === 'product' || type === 'blog' || type === 'page';
  const out = {
    // a product's manual title/description live in seo_meta (always manual: "...| AR Trade" is NOT mistaken for a generated title); an older hand-written column value still counts
    metaTitle: type === 'product' ? String(m.meta_title || (isAutoTitle(r.meta_title) ? '' : r.meta_title || '')) : own ? String(r.meta_title || '') : String(m.meta_title || ''),
    metaDescription: type === 'product' ? String(m.meta_description || (isAutoDesc(r.meta_desc) ? '' : r.meta_desc || '')) : own ? String(r.meta_desc || '') : String(m.meta_description || ''),
    focusKeyword: String(m.focus_keyword || ''),
    secondaryKeywords: jsonList(m.secondary_keywords).map(String),
    canonicalUrl: String(m.canonical_url || ''),
    robotsIndex: own ? !r.noindex : m.robots_index == null ? true : !!m.robots_index,
    robotsFollow: m.robots_follow == null ? true : !!m.robots_follow,
    ogTitle: String(m.og_title || ''), ogDescription: String(m.og_description || ''), ogImage: String(m.og_image || ''),
    twitterTitle: String(m.twitter_title || ''), twitterDescription: String(m.twitter_description || ''),
    faq: jsonList(m.faq).filter(x => x && x.q && x.a).map(x => ({ q: String(x.q), a: String(x.a) }))
  };
  if (own) out.metaKeywords = String(r.meta_keywords || '');
  return out;
}

const SEO_COLS = { focusKeyword: 'focus_keyword', canonicalUrl: 'canonical_url', robotsIndex: 'robots_index', robotsFollow: 'robots_follow', ogTitle: 'og_title', ogDescription: 'og_description', ogImage: 'og_image', twitterTitle: 'twitter_title', twitterDescription: 'twitter_description' };

/**
 * Splits validated manual values into the writes: { own: {column: value} for the item's own table, seo: {column: value} for seo_meta }.
 * Products, blog posts and pages keep title/description/keywords/noindex in their own columns; categories and brands keep all in seo_meta.
 */
export function splitWrites(type, v) {
  const own = {}, seo = {};
  const ownMeta = type === 'product' || type === 'blog' || type === 'page';
  for (const [k, col] of Object.entries(SEO_COLS)) if (k in v) seo[col] = typeof v[k] === 'boolean' ? +v[k] : v[k];
  if ('secondaryKeywords' in v) seo.secondary_keywords = JSON.stringify(v.secondaryKeywords);
  if ('faq' in v) seo.faq = JSON.stringify(v.faq);
  if (ownMeta) {
    if ('metaTitle' in v) own.meta_title = v.metaTitle;
    if ('metaDescription' in v) own.meta_desc = v.metaDescription;
    if (type === 'product') { // also kept in seo_meta, where a stored value is always treated as hand-written (the product column heuristics drop titles ending in "| AR Trade")
      if ('metaTitle' in v) seo.meta_title = v.metaTitle;
      if ('metaDescription' in v) seo.meta_description = v.metaDescription;
    }
    if ('metaKeywords' in v) own.meta_keywords = v.metaKeywords;
    if ('robotsIndex' in v) own.noindex = +!v.robotsIndex;
  } else {
    if ('metaTitle' in v) seo.meta_title = v.metaTitle;
    if ('metaDescription' in v) seo.meta_description = v.metaDescription;
  }
  return { own, seo };
}

/** Rows of the brands list. brands = [{slug,name,hidden}], counts = [{brand,n}] (active products per raw brand), metas = [seo_meta rows of type brand]. */
export function buildBrandRows(brands, counts, metas, minProducts = 3) {
  const per = new Map();
  for (const c of counts || []) { const s = brandSlug(c.brand); if (s) per.set(s, (per.get(s) || 0) + Number(c.n || 0)); }
  const meta = new Map((metas || []).map(m => [String(m.entity_id), m]));
  const hasValue = m => !!m && !!(m.focus_keyword || m.canonical_url || m.meta_title || m.meta_description || m.og_title || m.og_description || m.og_image || m.twitter_title || m.twitter_description
    || jsonList(m.secondary_keywords).length || jsonList(m.faq).length || m.robots_index === 0 || m.robots_index === false);
  return (brands || []).map(b => {
    const products = per.get(b.slug) || 0, m = meta.get(b.slug), hidden = !!b.hidden;
    return { slug: b.slug, name: b.name, products, hidden, indexable: products >= minProducts && !hidden, hasSeo: hasValue(m), score: m && m.seo_score != null ? Number(m.seo_score) : null };
  }).sort((a, b) => b.products - a.products || String(a.name).localeCompare(String(b.name)));
}
