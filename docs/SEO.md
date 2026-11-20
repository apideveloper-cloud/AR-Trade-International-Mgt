# Search-engine optimisation

How the storefront is made readable for Google and other crawlers, and how to test it.

## How it works
The client is a single-page React app, so the HTML file alone is nearly empty. `server/src/seo.js` answers every page request
(except `/api`) with the HTML shell **plus** the page's own data, built from the database:

| Part | Where | What it adds |
|---|---|---|
| Head tags | `inject()` in `seo.js` | one `<title>`, one meta description, canonical, `robots`, Open Graph and Twitter tags, `rel=prev/next`, a `preload` for the product picture |
| Structured data | `seo.js`, helpers in `seoHelpers.js` | `Product` + `BreadcrumbList` (products), `CollectionPage` + `ItemList` + `BreadcrumbList` (category pages), `Store` + `WebSite` (home), `BlogPosting` + `BreadcrumbList` (articles) |
| Plain-HTML copy | `seoFallback.js` | heading, text, price, specs and **real links** inside `<div id="root">`; hidden from people, replaced by React at start-up, readable by crawlers that do not run JavaScript |
| Sitemap / robots | `seo.js`, builders in `seoSchema.js` | `/sitemap.xml` is an **index** of `/sitemap-products.xml` (images, `lastmod` from `products.updated_at`), `/sitemap-categories.xml`, `/sitemap-blog.xml`, `/sitemap-pages.xml` (static pages, services, policies); `lastmod` only where a real date exists. `/robots.txt` also blocks `/wishlist`, `/compare`, `/login`, `/*?sort=`, `/*?q=`, `/*?new=` |

## Structured data now emitted (builders in `server/src/seoSchema.js`, wiring in `seo.js`)
- **Store** (`['Store','ElectronicsStore']`, `@id` `/#store`) on home **and** `/contact`: telephone and WhatsApp `contactPoint` (en, bn), `geo` from the delivery office coordinates, `sameAs` from the admin social links, `legalName` (`site.legalName`) and `openingHoursSpecification` (`site.hours` = `[{days:['Saturday'], opens:'09:00', closes:'18:00'}]`) only when those settings exist. City / postal code are parsed from `site.address` (e.g. "Dhaka-1217"), else the old constants.
- **FAQPage** on `/faq` from `content.faqs`, with the same text in the plain-HTML copy. Not emitted when there are no FAQs.
- **Service** + `BreadcrumbList` on `/services/<slug>` (provider = the Store `@id`); `BreadcrumbList` on `/services`, `/contact`, `/faq`, `/policy/<key>`.
- **Product**: up to 10 approved `review`s next to `aggregateRating` (now with best/worst), `gtin8/12/13/14` from `products.gtin` (digits only, 8/12/13/14 long), `color` (only a real colour word), `model` from `part`, `priceSpecification` with `valueAddedTaxIncluded` (the product page says "Prices include VAT"), `PreOrder` availability only if a truthy `products.preorder` exists (no such column yet).
- **Policies** `/policy/<key>`: indexable, title `<Policy> | AR Trade International`, description from the first paragraph, plain-HTML headings/paragraphs, in the pages sitemap. Unknown keys stay 404 + noindex.
- `?sort=`, `?view=`, `?order=` (like `?q=`, `?new=`) on category pages: 200, `noindex, follow`, canonical to the clean category URL. `?page=` is unchanged.
- LCP: `preload` of the first listing image on category pages and of the first enabled image slide on the home page.
- 404 pages carry a small plain-HTML block (Home, Shop all, main categories); status 404, `noindex, nofollow`.

## Rules built in
- Product title: `{Name} – Price in BD | AR Trade` within 60 characters; a product with no price (price 0) never claims one and has no `Offer` in the structured data.
- Description: at most 155 characters, price and real benefits only. A title or description written by hand in the admin is kept; the import's generated ones are replaced (`isAutoTitle` / `isAutoDesc`).
- Category pages: `/shop/<category>?page=N`, 24 per page (`PER_PAGE`, equal to `PG` in `client/src/pages/Shop.jsx`). Page 1 has no `?page=`; `?page=1`, `?page=0` or `?page=abc` redirect (301) to it; a page past the end is a real 404 (noindex). Each page has its own canonical and `rel=prev/next`. The shop page shows one page of 24 products at a time (no infinite scroll), with the same page links above and below the list; changing page scrolls to the top and Back returns to the previous page.
- Search and filter results (`?q=`, `?new=1`) are `noindex, follow`. Cart, checkout, account, login, track and other private pages are `noindex`.
- One `<h1>` per page (the home page has a hidden one; the hero slides use `<h2>`).
- No invented ratings: `aggregateRating` appears only when approved reviews exist.
- `products.updated_at` is NULL until a product is changed after it was added; the sitemap leaves `lastmod` out for NULL.

## Test after a deploy
1. View the raw HTML: `curl -s https://artradeinternational.com/product/<slug>` shows the title, one meta description, canonical, JSON-LD and the headings/links without JavaScript.
2. Google **Rich Results Test** (search.google.com/test/rich-results): a product page with a price should show "Product snippets" with no errors; category pages show Breadcrumbs.
3. Google **URL Inspection** in Search Console: "Test live URL", check the rendered HTML and screenshot, then "Request indexing" for the home page, one category and one product.
4. Search Console > Sitemaps: submit `https://artradeinternational.com/sitemap.xml`; watch "Discovered" and "Indexed" counts over the next weeks.
5. **PageSpeed Insights** on the home, a category and a product page (mobile): LCP under 2.5 s, CLS under 0.1, INP under 200 ms.
6. Search Console > Page indexing: no spike in "Soft 404", "Duplicate without user-selected canonical" or "Excluded by noindex" for product and category pages.
7. Search Console > Enhancements > Products / Breadcrumbs: no new errors.

## Known limits
- About 58% of products have price 0 (prices come from purchase entries), so they cannot show a price in Google until a price is set.
- Product pictures are uploaded JPEG/PNG files; converting them to WebP/AVIF is not done.
- Still missing, waiting for settings from the owner: `MerchantReturnPolicy`, `deliveryTime` (handling and transit days) and structured opening hours (`site.hours`; the builder is ready and emits them once set). `legalName` waits for `site.legalName`.
- GTIN is emitted only for products whose `gtin` column is filled; `preorder` has no column yet.

## SEO settings, overrides and brand pages (phase 1)
- **Resolution order** for title, description, OG title/description: hand-written value (`seo_meta.meta_title` / `meta_description` for any page type; `products.meta_title` / `meta_desc` when not the import's generated text; blog / service page meta columns) -> template `settings.seo.templates[type]` rendered with `varsFor` and the limit (60 / 155) -> built-in text. A template that still equals `DEFAULT_TEMPLATES` is skipped (`customText` in `seoHelpers.js`), so with no saved setting and no override every page renders exactly as before. Brand pages use their template whenever one exists. Site name, short name and separator come from `settings.general` (never hard-coded in the template path).
- `seo_meta` (entity_type/entity_id: product id, category id, brand slug, blog slug, service page slug, `home`/`home`, `static`/path without slash such as `shop`): canonical (absolute `https` only), `robots_index` / `robots_follow` (default index, follow; `products.noindex = 1` also gives noindex, follow), OG and Twitter title/description/image (Twitter falls back to OG, then the title), `schema_overrides` (only brand name, mpn, gtin13 (13 digits), color, model), `faq` ([{q,a}] -> FAQPage JSON-LD plus an h2 + dl in the plain-HTML copy). The focus keyword is never printed. A missing `seo_meta` table means "no overrides".
- **Product schema**: `availability` from `stock_status` (auto = stock > 0, in_stock, out_of_stock, preorder -> PreOrder, backorder -> BackOrder; the plain-HTML stock sentence uses the same rule), `itemCondition` from `item_condition`, `priceValidUntil` = `sale_ends` when today or later. `warranty_text` is only in the plain-HTML specification list.
- **Brand pages** `/brand/<slug>`: row in `brands` (hidden or missing = 404); products = published products whose `brandSlug(brand)` equals the slug; 24 per page, `?page=N` like categories (canonical, prev/next, 301 for a bad page, 404 past the end); CollectionPage + ItemList + BreadcrumbList (Home > Brand). A brand with no published product is `noindex`. `/sitemap-brands.xml` lists visible brands that have a published product.
- **robots.txt**: `settings.seo.robots.customTxt` is served when `validateRobotsTxt` accepts it (a `Sitemap:` line is appended when missing), else generated. `noindexSearch` (?q=, ?new=) and `noindexFilters` (?sort=, ?view=, ?order=) default to true; false drops the robots.txt lines and the page-level noindex.
- `settings.seo.verification.google` / `.bing` -> `google-site-verification` / `msvalidate.01` meta tags on every page. GA4/GTM: see Phase 5.
- `bustSeo()` (exported by `seo.js`) clears the 30 s catalog / SEO settings memo; admin routes call it after saves.
- Tests: `server/test/seo_p1_resolution.test.js` (offline).

## Phase 2: redirects, preview, image alt
- **Redirects**: after the lower-case / trailing-slash 301s and before product / blog / shop matching, the request path (decoded, no query) is looked up in `seo_redirects` (`source`, `target`, `code` 301|302|307|308, `hits`, `last_hit`). Lookup = `makeRedirectLookup` in `seoHelpers.js`: 30 s memo (misses too), cleared by `bustSeo()`; a target that is itself a source is followed up to 3 hops; a self-target or loop gives no redirect. A hit answers with the stored code; a relative target is sent as a path (the browser keeps host and protocol), an absolute `https://` target as is. `hits = hits + 1, last_hit = NOW()` is updated fire-and-forget (errors ignored). Missing table (30 s back-off) or any error = behaves as before. Slug history of blog posts and service pages is handled only through these rows.
- **`previewMeta(pathname, query = {})`** (export of `seo.js`): runs the same `resolveMeta()` the request handler uses (manual value -> template -> default) and returns `{ status, title, description, canonical, robots, og: { title, description, image }, twitter: { title, description }, ld }` (`headFields()` is shared with `inject()`). It writes nothing, counts no hit and applies no redirect; a URL the page rules would 301 answers `status: 301` with a `redirect` field. Absolute URLs use `SITE_URL` (empty when unset).
- **Image alt** (`product_images.alt`): Product JSON-LD `image` stays a list of absolute URLs, except images with alt, which become `ImageObject { url, caption }`; `og:image:alt` is added for the product's own first picture (not for a hand-picked share image); `/sitemap-products.xml` adds `<image:caption>` and `<image:title>` from the first gallery picture's alt. The plain-HTML fallback does not list `<img>` (hidden copy would trigger downloads).
- Tests: `server/test/seo_p2_redirects.test.js`, `seo_p2_head.test.js` (offline).

## Phase 5: sitemap cache, Merchant Center feed, IndexNow key, analytics
- **Sitemap cache** (`makeSitemapCache` in `seoHelpers.js`, wired in `seo.js`): the index and each child sitemap XML (plus its url count) are built once and kept until `markSitemapDirty()` (called by `bustSeo()`) or a 10-minute TTL (the mobile app changes the catalogue without `bustSeo`). The rebuild is lazy, on the next request, and concurrent requests share one in-flight rebuild. Responses carry `Last-Modified` (= time of the last rebuild) and `Cache-Control: public, max-age=300`; the XML itself is unchanged. Exports: `markSitemapDirty()`, `rebuildSitemaps()` (forces all), `sitemapStatus()` -> `{ generatedAt, dirty, ttlMs, counts: { products, categories, blog, pages, brands } }`.
- **Merchant feed** `GET /feeds/google-merchant.xml` (`merchantFeed.js`, pure `buildFeed` / `feedItem`): 404 unless `settings.flags.merchantFeed` is true; otherwise RSS 2.0 with `xmlns:g`, cached with the sitemaps. Rules: id = sku else numeric id; title <= 150, description <= 5000 (plain text, generated sentence when empty); price in `16200.00 BDT` (when `old_price > price` the price is `old_price` and `sale_price` is the price; `sale_price_effective_date` only when `sale_ends` is in the future); availability from `stock_status` (auto = stock > 0); gtin only when 8/12/13/14 digits; `identifier_exists=no` without gtin and mpn; `g:shipping` only when `shipping.zones` has a numeric rate for `dhaka` (never invented). Skipped with a reason: no price, no image, not active, noindex, name empty; 5000 items at most. `feedStatus()` and `feedPreview(limit)` use the same builder and cache. `/feeds/` is not blocked in robots.txt.
- **IndexNow key file** `GET /<key>.txt`: answers `text/plain` with exactly the key when it equals `settings.indexNow.key` (32 lower-case hex characters); any other path falls through as before.
- **Analytics**: when `settings.verification.ga4` (`G-XXXX`) and/or `gtm` (`GTM-XXXX`) are valid, one inline `<script>` before `</head>` waits for `load` + 2 s, then loads gtag.js (`anonymize_ip: true`) and/or the GTM container. Not emitted on noindex pages, private paths (admin, hub, email, field, account, cart, checkout, track, success, wishlist, compare, login, reset, prefs), 404 pages or `previewMeta`. Nothing set = output identical to before.
- Tests: `server/test/seo_p5_automation.test.js` (offline).
