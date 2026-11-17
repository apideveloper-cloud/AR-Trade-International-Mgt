// Pure helpers for search-engine output (titles, descriptions, paging, structured data). No database, no request: easy to test.

export const NAME = 'AR Trade International';
export const SHORT = 'AR Trade';
/** Products per category page. Keep equal to PG in client/src/pages/Shop.jsx. */
export const PER_PAGE = 24;

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const plain = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
/** Cuts at a word boundary, never inside a word. */
export const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, ''));
export const taka = n => '৳' + Math.round(Number(n) || 0).toLocaleString('en-US');
const oneLine = s => String(s || '').replace(/\s+/g, ' ').trim();

/** "{Name} – Price in BD | AR Trade" within 60 characters. A product without a price never claims one. */
export function productTitle(name, priced) {
  const n = oneLine(name);
  const options = priced ? [`${n} – Price in BD | ${SHORT}`, `${n} – Price in BD`, `${n} | ${SHORT}`] : [`${n} | ${SHORT}, Dhaka`, `${n} | ${SHORT}`];
  return options.find(t => t.length <= 60) || clip(n, 60);
}

/** Meta description of at most 155 characters: what it is, the price (when there is one), and the real benefits. */
export function productDescription({ name, price, cod = true }) {
  const n = oneLine(name), priced = Number(price) > 0;
  const tail = priced ? ` Genuine product, fast delivery in Dhaka${cod ? ' and cash on delivery' : ''}.` : ' Genuine product with fast delivery in Dhaka. Call or message us for the latest price.';
  const make = nm => (priced ? `Buy ${nm} at ${taka(price)} in Bangladesh.` : `${nm} from ${NAME}, Dhaka.`) + tail;
  let d = make(n);
  if (d.length > 155) d = make(clip(n, Math.max(10, n.length - (d.length - 155) - 1)));
  return d.length > 155 ? clip(d, 155) : d;
}

/** The catalogue import stored generated titles and descriptions; a value written by hand is kept, a generated one is replaced. */
export const isAutoTitle = t => !t || /\|\s*AR Trade( International)?\s*$/i.test(t);
export const isAutoDesc = d => !d || /Genuine, fast delivery\.\s*$/i.test(d);

// ---------- paging ----------
export const pagesOf = total => Math.max(1, Math.ceil(total / PER_PAGE));
/** `?page=` value -> { page, bad }. Anything that is not a positive whole number is "bad" (it is redirected to the plain address). */
export function parsePage(v) {
  if (v === undefined) return { page: 1, bad: false };
  const s = String(v);
  if (!/^\d{1,6}$/.test(s)) return { page: 1, bad: true };
  const n = Number(s);
  return { page: Math.max(1, n), bad: n < 1 };
}
export const pageUrl = (path, n) => (n > 1 ? `${path}?page=${n}` : path);
/** Page numbers to show: first, last, current and two either side, with '…' for gaps. */
export function pageWindow(page, pages) {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter(n => n >= 1 && n <= pages));
  const out = [];
  let last = 0;
  for (const n of [...keep].sort((a, b) => a - b)) { if (n - last > 1) out.push('…'); out.push(n); last = n; }
  return out;
}
/** Title of a list page: page 1 keeps the full title, later pages say which page it is. */
export function listTitle(page, mains, short) {
  if (page <= 1) return mains.find(t => t.length <= 60) || clip(mains[mains.length - 1], 60);
  const t = `${short} – Page ${page} | ${SHORT}`;
  return t.length <= 60 ? t : `${clip(short, 60 - ` – Page ${page} | ${SHORT}`.length)} – Page ${page} | ${SHORT}`;
}

// ---------- structured data ----------
export const breadcrumbLd = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item }))
});
/** A category page: the page itself, its position in the site and the products listed on it. */
export function collectionLd({ name, url, description, total, offset, items }) {
  return {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name, url, description,
    mainEntity: {
      '@type': 'ItemList', numberOfItems: total,
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: offset + i + 1, url: it.url, name: it.name }))
    }
  };
}
