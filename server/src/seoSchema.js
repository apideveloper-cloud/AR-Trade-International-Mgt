// Pure JSON-LD / sitemap / robots builders. No database, no request. Every value comes from the caller (database or settings);
// anything missing is left out, nothing is invented.
import { NAME, clip, esc, plain } from './seoHelpers.js';

const CTX = 'https://schema.org';
const has = v => v !== undefined && v !== null && String(v).trim() !== '';
const strip = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

// ---------- FAQ ----------
/** FAQPage from settings content.faqs ([{q, a}]). Entries without both a question and an answer are skipped; null when none are left. */
export function faqLd(faqs) {
  const items = (Array.isArray(faqs) ? faqs : []).filter(f => f && has(f.q) && has(f.a)).map(f => ({
    '@type': 'Question', name: plain(f.q), acceptedAnswer: { '@type': 'Answer', text: plain(f.a) }
  }));
  return items.length ? { '@context': CTX, '@type': 'FAQPage', mainEntity: items } : null;
}

// ---------- Service ----------
/** A servicing page. provider points at the Store block by its @id. */
export function serviceLd({ name, description, url, storeId }) {
  return strip({
    '@context': CTX, '@type': 'Service', name: plain(name), description: has(description) ? clip(plain(description), 500) : undefined, url,
    areaServed: { '@type': 'City', name: 'Dhaka', address: { '@type': 'PostalAddress', addressCountry: 'BD' } },
    provider: storeId ? { '@id': storeId } : undefined
  });
}

// ---------- Product extras ----------
/** GTIN property by digit count; only an all-digit value of 8, 12, 13 or 14 digits is used. */
export function gtinProp(gtin) {
  const g = String(gtin ?? '').trim();
  if (!/^\d+$/.test(g)) return {};
  const k = { 8: 'gtin8', 12: 'gtin12', 13: 'gtin13', 14: 'gtin14' }[g.length];
  return k ? { [k]: g } : {};
}
const COLOURS = ['Black', 'Cyan', 'Magenta', 'Yellow', 'White', 'Grey', 'Gray', 'Blue', 'Red', 'Silver'];
/** A real colour word (Black, Cyan ...). Printing-mode text such as "Color" or "Black & White" gives undefined. */
export function colourOf(c) {
  const s = String(c ?? '').trim();
  const hit = COLOURS.find(k => k.toLowerCase() === s.toLowerCase());
  return hit;
}
/** Latest approved reviews as schema.org Review objects (rows: name, rating, title, body, created_at). */
export function reviewsLd(rows, max = 10) {
  return (Array.isArray(rows) ? rows : []).filter(r => r && Number(r.rating) >= 1 && Number(r.rating) <= 5).slice(0, max).map(r => {
    const d = r.created_at ? new Date(r.created_at) : null;
    return strip({
      '@type': 'Review', author: { '@type': 'Person', name: String(r.name || '').trim() || 'Customer' },
      reviewRating: { '@type': 'Rating', ratingValue: Number(r.rating), bestRating: 5, worstRating: 1 },
      datePublished: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : undefined,
      name: has(r.title) ? String(r.title).trim() : undefined, reviewBody: has(r.body) ? String(r.body).trim() : undefined
    });
  });
}
export const aggregateLd = (n, avg) => ({ '@type': 'AggregateRating', ratingValue: Number(avg).toFixed(1), reviewCount: Number(n), bestRating: 5, worstRating: 1 });
/** Optional Product fields. `x` is the products row; unknown columns are simply undefined. vatShown: the page says "Prices include VAT". */
export function productExtras(x, { vatShown = true } = {}) {
  const out = { ...gtinProp(x.gtin) };
  const color = colourOf(x.color);
  if (color) out.color = color;
  if (has(x.part)) out.model = String(x.part).trim();
  return out;
}
/** Extra Offer fields: VAT note (only when the visible page says it) and pre-order availability (only when x.preorder is set). */
export function offerExtras(x, price, { vatShown = true } = {}) {
  const out = {};
  if (vatShown) out.priceSpecification = { '@type': 'UnitPriceSpecification', price: String(price), priceCurrency: 'BDT', valueAddedTaxIncluded: true };
  if (x.preorder) out.availability = 'https://schema.org/PreOrder';
  return out;
}

// ---------- Store ----------
/** Postal code and city from the settings address ("159 Santinagar, Dhaka-1217"). Only what is actually in the text. */
export function parseAddress(addr) {
  const s = String(addr || '');
  const m = s.match(/\bDhaka\s*[-–,]?\s*(\d{4})\b/i);
  return { locality: /\bDhaka\b/i.test(s) ? 'Dhaka' : undefined, postalCode: m ? m[1] : undefined };
}
const hhmm = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** site.hours = [{days:['Saturday',...], opens:'09:00', closes:'18:00'}]. Invalid rows are skipped; undefined when none are valid. */
export function hoursLd(hours) {
  const rows = (Array.isArray(hours) ? hours : []).map(h => ({
    days: (Array.isArray(h?.days) ? h.days : []).map(d => DAYS.find(k => k.toLowerCase() === String(d).trim().toLowerCase())).filter(Boolean), opens: h?.opens, closes: h?.closes
  })).filter(h => h.days.length && hhmm(h.opens) && hhmm(h.closes));
  return rows.length ? rows.map(h => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes })) : undefined;
}
const validGeo = o => o && Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lng)) && o.lat !== '' && o.lng !== '' && Math.abs(Number(o.lat)) <= 90 && Math.abs(Number(o.lng)) <= 180;
/** The Store block (same @id on home and contact). site = settings "site"; sameAs = real social links. */
export function storeLd({ base, site = {}, sameAs = [], logo }) {
  const a = parseAddress(site.address);
  const digits = String(site.whatsapp || '').replace(/\D/g, '');
  const contact = [
    has(site.phone) ? { '@type': 'ContactPoint', telephone: String(site.phone), contactType: 'customer service', areaServed: 'BD', availableLanguage: ['en', 'bn'] } : null,
    digits.length >= 8 ? { '@type': 'ContactPoint', telephone: '+' + digits, contactType: 'customer service', contactOption: 'https://schema.org/None', url: 'https://wa.me/' + digits, areaServed: 'BD', availableLanguage: ['en', 'bn'] } : null
  ].filter(Boolean);
  const office = site.delivery?.office;
  const geo = validGeo(office) ? { '@type': 'GeoCoordinates', latitude: Number(office.lat), longitude: Number(office.lng) } : undefined;
  const l = logo || base + '/api/uploads/site/artrade-logo.png';
  return strip({
    '@context': CTX, '@type': ['Store', 'ElectronicsStore'], '@id': base + '/#store', name: NAME,
    legalName: has(site.legalName) ? String(site.legalName).trim() : undefined, url: base, logo: l, image: l,
    telephone: site.phone, email: site.email,
    address: { '@type': 'PostalAddress', streetAddress: site.address || '159 Santinagar', addressLocality: a.locality || 'Dhaka', postalCode: a.postalCode || '1217', addressCountry: 'BD' },
    geo, contactPoint: contact.length ? contact : undefined, openingHoursSpecification: hoursLd(site.hours),
    priceRange: '৳', areaServed: 'BD', sameAs: sameAs.length ? sameAs : undefined
  });
}
/** Real https social links from content.social. */
export const sameAsOf = social => Object.values(social || {}).filter(u => /^https?:\/\//.test(u || ''));

// ---------- category URL variants ----------
/** ?sort= ?view= ?order= (and search ?q= ?new=) are variants of the clean category page: noindex,follow + canonical to the clean URL. */
export const isVariantQuery = q => !!q && ['sort', 'view', 'order'].some(k => k in q);

// ---------- policies ----------
/** Meta for /policy/<key>: title "<Title> | AR Trade International" (<=60), description from the first paragraph (<=155). */
export function policyMeta(policy) {
  const t = plain(policy?.t) || 'Policy';
  let title = `${t} | ${NAME}`;
  if (title.length > 60) title = `${t} | AR Trade`.length <= 60 ? `${t} | AR Trade` : clip(t, 60);
  const first = (policy?.secs || []).map(s => plain(s.p)).find(Boolean) || '';
  const desc = first ? clip(first, 155) : clip(`${t} of ${NAME}, Dhaka, Bangladesh.`, 155);
  return { title, desc };
}

// ---------- robots / sitemap ----------
export const robotsTxt = base => ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /hub', 'Disallow: /email', 'Disallow: /field', 'Disallow: /api/', 'Disallow: /cart', 'Disallow: /checkout', 'Disallow: /account', 'Disallow: /track', 'Disallow: /success/',
  'Disallow: /wishlist', 'Disallow: /compare', 'Disallow: /login', 'Disallow: /*?sort=', 'Disallow: /*?q=', 'Disallow: /*?new=', '',
  'Allow: /api/uploads/', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n');
export const CHILD_SITEMAPS = ['/sitemap-products.xml', '/sitemap-categories.xml', '/sitemap-blog.xml', '/sitemap-pages.xml'];
const isoDay = d => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : '');
/** One <url>; lastmod only when a real YYYY-MM-DD is given. */
export const urlEntry = (loc, pri, extra = '', lm = '') => `<url><loc>${esc(loc)}</loc>${isoDay(lm) ? `<lastmod>${isoDay(lm)}</lastmod>` : ''}<priority>${pri}</priority>${extra}</url>`;
export const urlset = entries => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>`;
/** items: [{path, lm?}] */
export const sitemapIndex = (base, items) => `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.map(i => `<sitemap><loc>${esc(base + i.path)}</loc>${isoDay(i.lm) ? `<lastmod>${isoDay(i.lm)}</lastmod>` : ''}</sitemap>`).join('\n')}\n</sitemapindex>`;
/** Latest real YYYY-MM-DD among values; '' when none. */
export const latestDay = ds => ds.map(isoDay).filter(Boolean).sort().pop() || '';

// ---------- home hero ----------
/** URL of the first enabled image slide of the home hero (content.slides), or undefined. */
export const heroImage = slides => (Array.isArray(slides) ? slides : []).find(s => s && s.type === 'image' && s.on !== false && s.img)?.img;
