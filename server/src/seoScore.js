// Pure SEO scoring of one item (product, category, brand, blog post, page). Deterministic, no database.
// Raw weights below sum to 100 for a product; other kinds use the applicable subset, re-normalised to 100.

const RAW = {
  title_length: 7, title_unique: 5, desc_length: 7, desc_unique: 5, body_words: 8, body_duplicate: 5,
  has_image: 7, image_alt: 5, image_size: 5, price: 7, stock: 4, brand: 4, gtin_mpn: 5, noindex: 6,
  kw_title: 4, kw_h1: 4, kw_slug: 4, kw_desc: 4, kw_body: 4
};
const APPLIES = {
  product: Object.keys(RAW),
  category: ['title_length', 'title_unique', 'desc_length', 'desc_unique', 'noindex', 'kw_title', 'kw_h1', 'kw_slug', 'kw_desc'],
  brand: ['title_length', 'title_unique', 'desc_length', 'desc_unique', 'noindex', 'kw_title', 'kw_h1', 'kw_slug', 'kw_desc'],
  blog: ['title_length', 'title_unique', 'desc_length', 'desc_unique', 'body_words', 'has_image', 'image_alt', 'noindex', 'kw_title', 'kw_h1', 'kw_slug', 'kw_desc', 'kw_body'],
  page: ['title_length', 'title_unique', 'desc_length', 'desc_unique', 'noindex', 'kw_title', 'kw_h1', 'kw_slug', 'kw_desc', 'kw_body']
};
const MIN_WORDS = { product: 250, blog: 300 };

const s = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const slugify = v => s(v).toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, '-').replace(/^-+|-+$/g, '');
const words = v => (s(v) ? s(v).split(' ').length : 0);

/** @returns {{score:number, issues:{id:string,level:'pass'|'warn'|'fail',weight:number,message:string,fix:string}[]}} */
export function scoreItem(kind, item, ctx) {
  const it = item || {}, c = ctx || {};
  const ids = (APPLIES[kind] || APPLIES.page).filter(id => !id.startsWith('kw_') || s(it.focusKeyword));
  const res = {};
  const set = (id, level, message, fix = '') => { res[id] = { level, message, fix: level === 'pass' ? '' : fix }; };

  const title = s(it.title), desc = s(it.description);
  set('title_length', title.length >= 30 && title.length <= 60 ? 'pass' : 'warn', `Title is ${title.length} characters (aim for 30 to 60).`, title.length < 30 ? 'Lengthen the title to at least 30 characters.' : 'Shorten the title to 60 characters or less.');
  if (!title) res.title_length.level = 'fail';
  set('title_unique', !(c.duplicateTitles > 0) ? 'pass' : 'fail', c.duplicateTitles > 0 ? `${c.duplicateTitles} other page(s) share this title.` : 'Title is unique.', 'Give this page its own title.');
  set('desc_length', desc.length >= 120 && desc.length <= 155 ? 'pass' : 'warn', `Description is ${desc.length} characters (aim for 120 to 155).`, desc.length < 120 ? 'Lengthen the description to at least 120 characters.' : 'Shorten the description to 155 characters or less.');
  if (!desc) res.desc_length.level = 'fail';
  set('desc_unique', !(c.duplicateDescriptions > 0) ? 'pass' : 'fail', c.duplicateDescriptions > 0 ? `${c.duplicateDescriptions} other page(s) share this description.` : 'Description is unique.', 'Write a different description for this page.');

  const wc = Number.isFinite(Number(it.wordCount)) && it.wordCount !== null && it.wordCount !== undefined ? Number(it.wordCount) : words(it.bodyText);
  const min = MIN_WORDS[kind] || 250;
  set('body_words', wc >= min ? 'pass' : 'fail', `Body text has ${wc} words (aim for ${min} or more).`, `Add more useful detail: at least ${min} words.`);
  set('body_duplicate', c.descriptionDuplicateOf ? 'fail' : 'pass', c.descriptionDuplicateOf ? `Description text is copied from ${c.descriptionDuplicateOf}.` : 'Description text is original.', 'Rewrite the description so it is not a copy of another item.');

  const imgs = Array.isArray(it.images) ? it.images.filter(i => i && s(i.src)) : [];
  set('has_image', imgs.length ? 'pass' : 'fail', imgs.length ? `${imgs.length} image(s).` : 'No image.', 'Add at least one image.');
  const noAlt = imgs.filter(i => !s(i.alt)).length;
  set('image_alt', imgs.length && !noAlt ? 'pass' : 'fail', !imgs.length ? 'No images to describe.' : noAlt ? `${noAlt} image(s) have no alt text.` : 'Every image has alt text.', 'Write alt text for every image.');
  const w = imgs.length ? Number(imgs[0].width) : NaN;
  set('image_size', Number.isFinite(w) && w >= 800 ? 'pass' : !imgs.length || Number.isFinite(w) && w > 0 ? 'fail' : 'warn',
    !imgs.length ? 'No main image.' : Number.isFinite(w) && w > 0 ? `Main image is ${w}px wide.` : 'Main image width is unknown.', 'Use a main image at least 800px wide.');
  if (Number.isFinite(w) && w <= 0 && imgs.length) res.image_size.level = 'warn';

  set('price', Number(it.price) > 0 ? 'pass' : 'fail', Number(it.price) > 0 ? 'Price is set.' : 'No price.', 'Set a price.');
  const st = it.stock;
  set('stock', st !== null && st !== undefined && s(st) !== '' ? 'pass' : 'fail', 'Stock status ' + (st !== null && st !== undefined && s(st) !== '' ? 'is set.' : 'is not set.'), 'Set the stock status.');
  set('brand', s(it.brand) ? 'pass' : 'fail', s(it.brand) ? 'Brand is set.' : 'No brand.', 'Set the brand.');
  set('gtin_mpn', s(it.gtin) || s(it.mpn) ? 'pass' : 'fail', s(it.gtin) || s(it.mpn) ? 'GTIN or MPN is present.' : 'No GTIN or MPN.', 'Add the GTIN (barcode) or the part number.');
  set('noindex', it.noindex ? 'fail' : 'pass', it.noindex ? 'Page is set to noindex: search engines will not list it.' : 'Page can be indexed.', 'Remove noindex unless this is intended.');

  const kw = s(it.focusKeyword).toLowerCase();
  if (kw) {
    const has = t => s(t).toLowerCase().includes(kw);
    const first = s(it.bodyText).split(' ').slice(0, 120).join(' ');
    const sl = slugify(kw);
    const f = (ok, what) => [ok ? 'pass' : 'fail', ok ? `Focus keyword is in the ${what}.` : `Focus keyword is missing from the ${what}.`, `Use "${s(it.focusKeyword)}" in the ${what}.`];
    set('kw_title', ...f(has(it.title), 'title'));
    set('kw_h1', ...f(has(it.h1), 'main heading'));
    set('kw_slug', ...f(!!sl && slugify(it.slug).includes(sl), 'address (slug)'));
    set('kw_desc', ...f(has(it.description), 'description'));
    set('kw_body', ...f(has(first), 'first paragraph'));
  }

  const total = ids.reduce((a, id) => a + RAW[id], 0);
  let earned = 0;
  const issues = ids.map(id => {
    const r = res[id];
    earned += r.level === 'pass' ? RAW[id] : r.level === 'warn' ? RAW[id] / 2 : 0;
    return { id, level: r.level, weight: Math.round((RAW[id] * 100 / total) * 100) / 100, message: r.message, fix: r.fix };
  });
  return { score: total ? Math.round((earned * 100) / total) : 0, issues };
}
