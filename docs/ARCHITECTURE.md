# Architecture

## Request flow

1. Browser loads the React app (Vite dev server on 5173, or the built `client/dist` served by Express in production).
2. The client calls `/api/...` (proxied to port 4000 in development).
3. `server/src/app.js` runs, in order: security headers, gzip, CORS (development only), audit middleware, JSON body parsers (larger limits for admin, quote scan and field expenses), boot-cache invalidation on writes, uploads, storefront routers, sign-in rate limits, staff routers, then the client/SEO shell and the JSON error handler.
4. Handlers use the MySQL pool in `db.js`. `/api/bootstrap` (catalogue) is cached and thrown away on any write.

Mounts: `/api/admin`, `/api/admin/audit`, `/api/inv`, `/api/quotes`, `/api/account`, `/api/field`, `/api/hub`, `/api/live`, `/api/mkt`, `/api/prefs`; storefront routers from `routes/` are mounted before them.

## Server module map (`server/src`)

| File | Role |
|---|---|
| `index.js` | Starts the server, runs migrations, schedules jobs |
| `app.js` | Builds the Express app |
| `db.js` | MySQL pool |
| `migrate.js` | Idempotent column/table upgrades on every start |
| `setup.js`, `schema.sql` | Manual DB creation and seeding |
| `indexes.js` | Index creation |
| `permissions.js` | Role matrix (`role_perms`, `role_log`) |
| `audit.js` | Audit log of staff changes and its router/prune |
| `backup.js` | Scheduled database backups |
| `util.js`, `slug.js`, `userAgent.js`, `geoIp.js` | Helpers |
| `listing.js` | Server-side paging, search and date filters for admin lists |
| `delivery.js` | Distance-based delivery rules (pure logic) |
| `flow.js` | Order status transitions |
| `invoice.js`, `salesorder.js`, `quotation.js` | PDF documents and quotation API |
| `inventory.js` | Stock, purchases, vendors (`/api/inv`) |
| `account.js` | Customer account API (`/api/account`) |
| `admin.js`, `adminContent.js`, `adminEngage.js`, `adminHelpers.js`, `adminSystem.js` | Staff API groups |
| `hub.js` | Delivery hub and live tracking |
| `field.js`, `field/` | Mobile field app API (`modules/` one file per feature, `sql/` tables) |
| `mkt.js`, `emailTemplate.js`, `mailer.js` | Email marketing, templates, SMTP sending |
| `chatbot.js`, `chatLeads.js` | Chat assistant and lead capture |
| `seo.js`, `productSlugs.js`, `productImages.js` | SEO shell, slug URLs, image handling |
| `overview.js` | Dashboard figures |
| `routes/catalog.js` | Catalogue, bootstrap, search |
| `routes/content.js` | Blog, pages, content |
| `routes/auth.js` | Sign-in, register, reset, quick account |
| `routes/orders.js` | Pricing, order placement, tracking |
| `routes/forms.js` | Service requests, contact, newsletter opt-in |
| `routes/chat.js`, `routes/careers.js`, `routes/shared.js` | Chat endpoints, jobs, shared settings helpers |
| `admin/` | `auth`, `catalog`, `customers`, `dashboard`, `guard`, `orders`, `team` |
| `middleware/` | `security`, `cache`, `customerAuth`, `static`, `errors` |

## Data model (main tables, `schema.sql`)

| Group | Tables |
|---|---|
| Catalogue | `categories`, `products`, `product_images`, `product_specs`, `reviews`, `blog_posts`, `site_pages` |
| Customers | `users`, `user_addresses`, `user_family`, `user_reminders`, `password_resets` |
| Orders | `orders`, `order_items`, `order_history`, `order_returns`, `branches`, `service_requests` |
| Staff and settings | `staff`, `settings`, `counters`, `rate_hits`, role tables (created by `permissions.js`) |
| Marketing | `campaigns`, `subscribers`, `consents`, `messages`, `mkt_templates`, `mkt_automations`, `mkt_campaigns`, `mkt_prefs`, `mkt_log`, `mkt_outbox` |
| Careers | `jobs`, `applications` |
| Field app | `field_attendance`, `field_track`, `field_expenses` plus `field/sql` tables |

Inventory, quotation, audit, backup and chat-lead tables are created by their `ensure...` functions in `migrate.js`, not by `schema.sql`.

## Pricing and delivery

Defaults live in `delivery.js` and are merged with saved settings at read time.

- **Inside Dhaka, map-priced:** distance = straight line from the office point x road factor (1.25), rounded to 0.1 km. Free up to 2 km.

| Road distance | Fee (BDT) |
|---|---|
| up to 2 km | 0 |
| up to 5 km | 100 |
| up to 8 km | 150 |
| up to 12 km | 200 |
| up to 18 km | 250 |
| beyond | 350 (max fee) |

- A map-priced fee is always charged: the "free over" threshold does not apply to it.
- **Outside Dhaka:** the customer picks a district and a shipping partner (defaults: RedX, SA Paribahan, Steadfast, Sundarban); the flat outside fee applies. A partner is required.
- **Legacy / branch pricing:** with no district (staff-placed orders), the old flat inside / suburb / outside fees from settings are used.
- Totals: subtotal, coupon discount, member discount, then delivery; VAT is computed as an included portion. Fixed numbers are defaults only; the Admin delivery settings override them.

## Order lifecycle

`Pending` -> `Confirmed` -> `Packed` -> `Shipped` -> `Delivered`, or `Cancelled`.

- Pending and Cancelled orders print as **Sales Order `SO-<number>`**; from Confirmed onwards the same order prints as **Sales Invoice `INV-<number>`** (`invoice.js`, `docInfo`).
- Transitions and side effects (stock, history, approvals) go through `flow.js`; every change is written to `order_history`.
- Riders see Packed orders without a rider and their own deliveries.

## Customer accounts

- Normal registration and sign-in in `routes/auth.js`; token auth in `middleware/customerAuth.js`.
- **Quick account:** after a guest order, the customer can create an account from it. The order id plus its mobile number prove ownership; only guest orders under 2 days old, and only when no account exists for that mobile or email. A login is generated and shown once.
- Social sign-in is optional (Google, Facebook, by env).

## Admin roles and permissions

Roles: Master Admin, Admin, Manager, Accountant, Purchase Officer, RM, Field Officer, plus the older rider, marketing and content roles. Permissions are keys such as `orders.view`, checked server-side (`admin/guard.js`, `permissions.js`). The Master Admin edits the live matrix in the console. Defaults are in `../ROLE_MATRIX.md`.

## Client structure

See `client/README.md` for the table. `App.jsx` routes by prefix: `/admin` -> `AdminApp`, `/hub` -> `HubApp`, `/email` -> `EmailApp`, otherwise the storefront with `Header`, `Footer`, `Chat` and overlays. Admin pages live in `admin/pages/<area>/`, using the shared kit in `admin/ui.jsx` and the rules in `admin/STYLE_GUIDE.md`.

## CSS organisation

- Storefront: `styles.css` (base), `src/styles/*.css` split by area, plus `account.css`, `product.css`, `blog.css`, `flat.css`; all imported in `main.jsx`.
- Admin: `admin/admin.css`, `admin/dash.css`, `admin/styles/*.css`, per-page files. The table look is defined once at the end of `admin.css`.
- Hub and email apps have their own stylesheets (`hub/hub.css`, `email/emailInline.css`).
- Components with big styles keep a CSS file beside them (`chat-start.css`, `delivery-map.css`, ...).
