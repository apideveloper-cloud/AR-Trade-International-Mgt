// Pure rules of the nightly JSON-LD validator (Search & Growth, Phase 5). They follow Google's rich result requirements:
// error = the rich result is blocked, warning = recommended. validateLd(ld, kind) -> [{ type, severity, code, detail }]. No database here.

/** code -> sentence for the owner (label), what to do (hint) and severity (error | warning). */
export const CODES = {
  ld_invalid: { label: 'A structured data block on the page is not valid JSON.', hint: 'Save the page again. If it stays, tell the developer: the page writes broken structured data.', severity: 'error' },
  no_ld: { label: 'The product page has no structured data at all.', hint: 'Open the product page and check that it loads; run the check again after saving the product.', severity: 'warning' },
  duplicate_type: { label: 'The product page describes the same product twice in its structured data.', hint: 'Remove the duplicate so Google reads one Product per page.', severity: 'warning' },
  product_name_missing: { label: 'A Product has no name, so Google cannot show a product result.', hint: 'Give the product a name and save it.', severity: 'error' },
  product_image_missing: { label: 'A Product has no image, so Google cannot show a product result.', hint: 'Upload a picture for the product.', severity: 'error' },
  product_offers_missing: { label: 'A Product has no offer (price), so Google cannot show price or stock.', hint: 'Set a price above 0 on the product.', severity: 'error' },
  offer_price_invalid: { label: 'The offer has no price or the price is not a number.', hint: 'Check the product price and save the product again.', severity: 'error' },
  offer_currency_invalid: { label: 'The offer has no valid 3-letter currency (for example BDT).', hint: 'Tell the developer: the offer currency is missing.', severity: 'error' },
  offer_availability_invalid: { label: 'The offer has no valid stock status (a schema.org address such as https://schema.org/InStock).', hint: 'Check the stock status setting of the product and save it again.', severity: 'error' },
  product_brand_missing: { label: 'The product has no brand in its structured data.', hint: 'Choose a brand on the product.', severity: 'warning' },
  product_identifier_missing: { label: 'The product has no SKU, GTIN or part number (MPN).', hint: 'Add a SKU or part number to the product.', severity: 'warning' },
  offer_valid_until_missing: { label: 'A sale price has no end date (priceValidUntil).', hint: 'Set the sale end date on the product.', severity: 'warning' },
  rating_incomplete: { label: 'The star rating is missing its rating value or review count.', hint: 'Tell the developer: the aggregate rating is incomplete.', severity: 'warning' },
  review_incomplete: { label: 'A customer review is missing its author or star rating.', hint: 'Check the review in Reviews and complete or reject it.', severity: 'warning' },
  org_name_missing: { label: 'The business (Organization) has no name in its structured data.', hint: 'Fill in the shop name in the site settings.', severity: 'error' },
  org_url_missing: { label: 'The business (Organization) has no web address in its structured data.', hint: 'Set the preferred domain in SEO settings.', severity: 'error' },
  org_logo_missing: { label: 'The business has no logo in its structured data.', hint: 'Upload the shop logo in the site settings.', severity: 'warning' },
  org_sameas_missing: { label: 'The business lists no social profile links (sameAs).', hint: 'Add the Facebook, YouTube or other social links in the storefront settings.', severity: 'warning' },
  org_contact_missing: { label: 'The business has no phone, contact point or address in its structured data.', hint: 'Fill in the phone and address in the site settings.', severity: 'warning' },
  breadcrumb_empty: { label: 'The breadcrumb trail is empty.', hint: 'Tell the developer: the breadcrumb list has no items.', severity: 'error' },
  breadcrumb_item_incomplete: { label: 'A breadcrumb item is missing its position, name or address.', hint: 'Tell the developer: a breadcrumb item is incomplete.', severity: 'error' },
  faq_empty: { label: 'The FAQ block has no questions.', hint: 'Add questions to the FAQ or remove the empty block.', severity: 'error' },
  faq_question_incomplete: { label: 'An FAQ question has no text or no answer.', hint: 'Complete the question and its answer in the FAQ list.', severity: 'error' },
  article_headline_missing: { label: 'The article has no headline.', hint: 'Give the blog post a title.', severity: 'error' },
  article_image_missing: { label: 'The article has no image.', hint: 'Add a cover picture to the blog post.', severity: 'error' },
  article_date_missing: { label: 'The article has no publish date.', hint: 'Publish the blog post with a date.', severity: 'error' },
  article_author_missing: { label: 'The article has no author.', hint: 'Fill in the author of the blog post.', severity: 'warning' },
  article_modified_missing: { label: 'The article has no modified date.', hint: 'Tell the developer: dateModified is missing.', severity: 'warning' },
  article_publisher_missing: { label: 'The article has no publisher.', hint: 'Tell the developer: publisher is missing.', severity: 'warning' },
  website_search_missing: { label: 'The WebSite block has no site search box (SearchAction).', hint: 'Tell the developer: the sitelinks search box is missing.', severity: 'warning' },
  itemlist_empty: { label: 'A list of items (ItemList) is empty.', hint: 'Tell the developer: the list has no items, or remove it.', severity: 'error' }
};
export const CODE_LIST = Object.keys(CODES);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = v => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const filled = v => {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.some(filled);
  if (isObj(v)) return Object.entries(v).some(([k, x]) => k !== '@type' && k !== '@context' && filled(x));
  return true;
};
const typesOf = o => arr(o?.['@type']).map(String);
const hasType = (o, ...names) => typesOf(o).some(t => names.includes(t));
export const numberLike = v => (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(v));
const CURRENCY = /^[A-Za-z]{3}$/;
const AVAIL = /^https?:\/\/schema\.org\/[A-Za-z]+$/;
const ORG_TYPES = ['Organization', 'LocalBusiness', 'Corporation', 'OnlineStore', 'OnlineBusiness'];
const isOrg = o => hasType(o, ...ORG_TYPES) || typesOf(o).some(t => /(Store|Business)$/.test(t));
const ARTICLE = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle'];
const nameOf = v => (typeof v === 'string' ? v : isObj(v) ? v.name : '');
const label = o => String(o?.name || o?.headline || '').slice(0, 60);

/** Turns whatever previewMeta gave (objects, raw strings, an object with @graph) into { objects, invalid:[detail] }. */
export function normalizeLd(ld) {
  const objects = [], invalid = [];
  const take = (v, depth = 0) => {
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) { invalid.push('An empty structured data block'); return; }
      try { take(JSON.parse(s), depth); } catch { invalid.push('Not valid JSON: ' + s.slice(0, 80)); }
    } else if (Array.isArray(v)) { v.forEach(x => take(x, depth)); }
    else if (isObj(v)) {
      if (Array.isArray(v['@graph']) && depth < 3) v['@graph'].forEach(x => take(x, depth + 1));
      else objects.push(v);
    } else if (v !== undefined && v !== null) invalid.push('A structured data block is not an object');
  };
  take(ld);
  return { objects, invalid };
}

function offerRules(offer, out, ctx) {
  const t = hasType(offer, 'AggregateOffer') ? 'AggregateOffer' : 'Offer', agg = t === 'AggregateOffer', pre = ctx ? ctx + ': ' : '';
  const price = agg ? (offer.price ?? offer.lowPrice) : offer.price;
  if (!numberLike(price)) out.push({ type: t, severity: 'error', code: 'offer_price_invalid', detail: `${pre}price is ${filled(price) ? JSON.stringify(price) : 'missing'}` });
  if (!CURRENCY.test(String(offer.priceCurrency ?? ''))) out.push({ type: t, severity: 'error', code: 'offer_currency_invalid', detail: `${pre}priceCurrency is ${filled(offer.priceCurrency) ? JSON.stringify(offer.priceCurrency) : 'missing'}` });
  if (!agg && !AVAIL.test(String(offer.availability ?? ''))) out.push({ type: t, severity: 'error', code: 'offer_availability_invalid', detail: `${pre}availability is ${filled(offer.availability) ? JSON.stringify(offer.availability) : 'missing'}` });
  const sale = arr(offer.priceSpecification).some(s => isObj(s) && /(Strikethrough|ListPrice|SRP)/i.test(String(s.priceType || '')));
  if (sale && !filled(offer.priceValidUntil)) out.push({ type: t, severity: 'warning', code: 'offer_valid_until_missing', detail: pre + 'sale price without priceValidUntil' });
}

function productRules(p, out) {
  const n = label(p);
  if (!filled(p.name)) out.push({ type: 'Product', severity: 'error', code: 'product_name_missing', detail: 'Product has no name' });
  if (!filled(p.image)) out.push({ type: 'Product', severity: 'error', code: 'product_image_missing', detail: `Product ${n} has no image` });
  const offers = arr(p.offers).filter(isObj);
  if (!offers.length) out.push({ type: 'Product', severity: 'error', code: 'product_offers_missing', detail: `Product ${n} has no offers` });
  offers.forEach((o, i) => offerRules(o, out, offers.length > 1 ? `offer ${i + 1}` : ''));
  if (!filled(p.brand)) out.push({ type: 'Product', severity: 'warning', code: 'product_brand_missing', detail: `Product ${n} has no brand` });
  if (!['sku', 'gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14', 'mpn'].some(k => filled(p[k]))) out.push({ type: 'Product', severity: 'warning', code: 'product_identifier_missing', detail: `Product ${n} has no sku, gtin or mpn` });
  if (p.aggregateRating !== undefined) {
    const a = p.aggregateRating;
    if (!isObj(a) || !filled(a.ratingValue) || !(filled(a.reviewCount) || filled(a.ratingCount))) out.push({ type: 'AggregateRating', severity: 'warning', code: 'rating_incomplete', detail: 'aggregateRating needs ratingValue and reviewCount' });
  }
  arr(p.review).forEach((r, i) => {
    const miss = [];
    if (!isObj(r)) miss.push('everything');
    else { if (!filled(nameOf(r.author))) miss.push('author'); if (!isObj(r.reviewRating) || !filled(r.reviewRating.ratingValue)) miss.push('reviewRating'); }
    if (miss.length) out.push({ type: 'Review', severity: 'warning', code: 'review_incomplete', detail: `Review ${i + 1} lacks ${miss.join(' and ')}` });
  });
}

function orgRules(o, out) {
  const t = typesOf(o).find(x => ORG_TYPES.includes(x) || /(Store|Business)$/.test(x)) || 'Organization';
  if (!filled(o.name)) out.push({ type: t, severity: 'error', code: 'org_name_missing', detail: 'Organization has no name' });
  if (!filled(o.url) && !filled(o['@id'])) out.push({ type: t, severity: 'error', code: 'org_url_missing', detail: 'Organization has no url or @id' });
  if (!filled(o.logo)) out.push({ type: t, severity: 'warning', code: 'org_logo_missing', detail: 'No logo' });
  if (!filled(o.sameAs)) out.push({ type: t, severity: 'warning', code: 'org_sameas_missing', detail: 'No sameAs links' });
  if (!filled(o.contactPoint) && !filled(o.address) && !filled(o.telephone)) out.push({ type: t, severity: 'warning', code: 'org_contact_missing', detail: 'No contactPoint, address or telephone' });
}

function breadcrumbRules(b, out) {
  const items = arr(b.itemListElement).filter(x => x !== null && x !== undefined);
  if (!items.length) { out.push({ type: 'BreadcrumbList', severity: 'error', code: 'breadcrumb_empty', detail: 'itemListElement is empty' }); return; }
  items.forEach((it, i) => {
    const last = i === items.length - 1, miss = [];
    if (!isObj(it)) miss.push('everything');
    else {
      if (!numberLike(it.position)) miss.push('position');
      if (!filled(it.name) && !(isObj(it.item) && filled(it.item.name))) miss.push('name');
      if (!last && !filled(typeof it.item === 'string' ? it.item : it.item?.['@id'] ?? it.item?.url)) miss.push('item (address)');
    }
    if (miss.length) out.push({ type: 'BreadcrumbList', severity: 'error', code: 'breadcrumb_item_incomplete', detail: `Item ${i + 1} lacks ${miss.join(', ')}` });
  });
}

function faqRules(f, out) {
  const qs = arr(f.mainEntity).filter(x => x !== null && x !== undefined);
  if (!qs.length) { out.push({ type: 'FAQPage', severity: 'error', code: 'faq_empty', detail: 'mainEntity is empty' }); return; }
  qs.forEach((q, i) => {
    const miss = [];
    if (!isObj(q) || !filled(q.name)) miss.push('question text');
    if (!isObj(q) || !isObj(q.acceptedAnswer) || !filled(q.acceptedAnswer.text)) miss.push('answer text');
    if (miss.length) out.push({ type: 'FAQPage', severity: 'error', code: 'faq_question_incomplete', detail: `Question ${i + 1} lacks ${miss.join(' and ')}` });
  });
}

function articleRules(a, out) {
  const t = typesOf(a).find(x => ARTICLE.includes(x)) || 'Article';
  if (!filled(a.headline)) out.push({ type: t, severity: 'error', code: 'article_headline_missing', detail: 'No headline' });
  if (!filled(a.image)) out.push({ type: t, severity: 'error', code: 'article_image_missing', detail: 'No image' });
  if (!filled(a.datePublished)) out.push({ type: t, severity: 'error', code: 'article_date_missing', detail: 'No datePublished' });
  if (!filled(nameOf(a.author))) out.push({ type: t, severity: 'warning', code: 'article_author_missing', detail: 'No author' });
  if (!filled(a.dateModified)) out.push({ type: t, severity: 'warning', code: 'article_modified_missing', detail: 'No dateModified' });
  if (!filled(a.publisher)) out.push({ type: t, severity: 'warning', code: 'article_publisher_missing', detail: 'No publisher' });
}

/** Checks the JSON-LD of one page. ld = the ld array of previewMeta (objects, or raw strings); kind = 'product' | 'home' | 'blog' | ... */
export function validateLd(ld, kind = 'page') {
  const { objects, invalid } = normalizeLd(ld), out = [];
  for (const d of invalid) out.push({ type: 'JSON-LD', severity: 'error', code: 'ld_invalid', detail: d.slice(0, 300) });
  if (kind === 'product') {
    if (!objects.length && !invalid.length) out.push({ type: 'Product', severity: 'warning', code: 'no_ld', detail: 'The page has no JSON-LD' });
    const n = objects.filter(o => hasType(o, 'Product')).length;
    if (n > 1) out.push({ type: 'Product', severity: 'warning', code: 'duplicate_type', detail: `Product appears ${n} times on the page` });
  }
  for (const o of objects) {
    if (hasType(o, 'Product')) productRules(o, out);
    if (isOrg(o)) orgRules(o, out);
    if (hasType(o, 'BreadcrumbList')) breadcrumbRules(o, out);
    if (hasType(o, 'FAQPage')) faqRules(o, out);
    if (typesOf(o).some(t => ARTICLE.includes(t))) articleRules(o, out);
    if (hasType(o, 'WebSite') && o.potentialAction === undefined) out.push({ type: 'WebSite', severity: 'warning', code: 'website_search_missing', detail: 'No potentialAction (SearchAction)' });
    if (hasType(o, 'ItemList') && !arr(o.itemListElement).length) out.push({ type: 'ItemList', severity: 'error', code: 'itemlist_empty', detail: 'itemListElement is empty' });
  }
  // CollectionPage and others carry an ItemList in mainEntity: same rule
  for (const o of objects) if (!hasType(o, 'ItemList') && isObj(o.mainEntity) && hasType(o.mainEntity, 'ItemList') && !arr(o.mainEntity.itemListElement).length) out.push({ type: 'ItemList', severity: 'error', code: 'itemlist_empty', detail: 'mainEntity ItemList is empty' });
  const seen = new Set();
  return out.filter(x => { const k = x.code + '|' + x.type + '|' + x.detail; if (seen.has(k)) return false; seen.add(k); return true; });
}
