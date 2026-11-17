// Plain-HTML version of a page, placed inside <div id="root"> of the HTML shell. Crawlers that do not run JavaScript read the
// headings, text and real links from it; React replaces it as soon as the app starts (createRoot clears the container).
// Everything that comes from the database is escaped.
import { NAME, esc, pageUrl, pageWindow, pagesOf, taka } from './seoHelpers.js';
import { productPath } from './slug.js';

const a = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const wrap = inner => `<div class="seo-fb" data-seo-fallback>${inner}</div>`;
const list = items => (items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : '');
export const productLine = p => a(productPath(p), p.name) + (Number(p.price) > 0 ? ` – ${taka(p.price)}` : '');

/** Site navigation: the same links on every page, so every product category is reachable from every page. */
const navHtml = cats => `<nav aria-label="Main">${list([
  a('/', 'Home'), a('/shop', 'Shop all products'), ...cats.map(c => a('/shop/' + c.id, c.title)),
  a('/offers', 'Offers'), a('/services', 'Printer servicing'), a('/blog', 'Blog'), a('/about', 'About us'), a('/contact', 'Contact'), a('/faq', 'FAQ')
])}</nav>`;
const footHtml = site => `<footer><p>${esc(NAME)}${site.address ? ' – ' + esc(site.address) : ''}${site.phone ? '. Phone: ' + esc(site.phone) : ''}</p></footer>`;
const crumbs = items => `<nav aria-label="Breadcrumb"><ol>${items.map(([name, href]) => `<li>${href ? a(href, name) : esc(name)}</li>`).join('')}</ol></nav>`;

export function productFallback({ x, cat, price, related, cats, site, desc }) {
  const spec = [['Brand', x.brand], ['Part number', x.part], ['SKU', x.sku], ['Technology', x.tech], ['Colour', x.color], ['Page yield', x.yield_info], ['Compatible printers', x.compat]]
    .filter(([, v]) => String(v || '').trim());
  return wrap(`${navHtml(cats)}<main>${crumbs([['Home', '/'], [cat?.title || 'Shop', cat ? '/shop/' + cat.id : '/shop'], [x.name]])}
<article><h1>${esc(x.name)}</h1>
<p>${Number(price) > 0 ? `Price: ${taka(price)}. ${x.stock > 0 ? 'In stock.' : 'Currently out of stock.'}` : 'Price on request: call or message us for the latest price.'}</p>
${desc ? `<section><h2>About this product</h2><p>${esc(desc)}</p></section>` : ''}
${spec.length ? `<section><h2>Specifications</h2><dl>${spec.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v).slice(0, 400))}</dd>`).join('')}</dl></section>` : ''}
${related.length ? `<section><h2>More ${esc(cat?.title || 'products')}</h2>${list(related.map(productLine))}</section>` : ''}</article></main>${footHtml(site)}`);
}

export function listFallback({ title, intro, trail, rows, page, pages, path, cats, site }) {
  const nav = pages > 1 ? `<nav aria-label="Pagination">${list(pageWindow(page, pages).map(n => (n === '…' ? '…' : n === page ? `<strong>Page ${n}</strong>` : a(pageUrl(path, n), `Page ${n}`))))}</nav>` : '';
  return wrap(`${navHtml(cats)}<main>${crumbs(trail)}<h1>${esc(title)}</h1>${intro ? `<p>${esc(intro)}</p>` : ''}${list(rows.map(productLine))}${nav}</main>${footHtml(site)}`);
}

/** A page made of a title, a paragraph and optional lists of links / text (home, blog, services, about ...). */
export function pageFallback({ title, intro, blocks = [], cats, site }) {
  return wrap(`${navHtml(cats)}<main><h1>${esc(title)}</h1>${intro ? `<p>${esc(intro)}</p>` : ''}${blocks.join('')}</main>${footHtml(site)}`);
}
export const linkBlock = (heading, items) => (items.length ? `<section><h2>${esc(heading)}</h2>${list(items)}</section>` : '');
export const textBlock = (heading, text) => (text ? `<section>${heading ? `<h2>${esc(heading)}</h2>` : ''}<p>${esc(text)}</p></section>` : '');
export { a as link, pagesOf };
