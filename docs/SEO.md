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
| Sitemap / robots | `seo.js` | `/sitemap.xml` (products with `lastmod` from `products.updated_at`, images, blog, services) and `/robots.txt` |

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
- Opening hours, return policy and GTIN/MPN are not in the data, so they are not in the structured data.
