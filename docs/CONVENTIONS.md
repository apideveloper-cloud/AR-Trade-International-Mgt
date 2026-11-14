# Conventions

## Naming and placement

- Server files: camelCase `.js`, ES modules, one topic per file, a one-line header comment saying what the file is for.
- Client: components and pages `PascalCase.jsx`; helpers `camelCase.js`; CSS next to its area.
- Database: snake_case columns; JSON fields use camelCase.

| New code | Goes in |
|---|---|
| Storefront API route | `server/src/routes/<topic>.js`, exported as `mount...Routes(app)` and mounted in `app.js` |
| Staff API | `server/src/admin/` or an `admin*.js` group; check permissions with the guard |
| Field app API | `server/src/field/modules/<feature>.js` (only add optional params; never change existing replies) |
| Pure business logic | its own file (like `delivery.js`) so it can be unit tested |
| Storefront page | `client/src/pages/` |
| Admin page | `client/src/admin/pages/<area>/`, registered in `admin/nav.js` |
| Shared admin UI | `client/src/admin/ui.jsx` or `components/` (reuse before building) |

## Add an API route

1. Pick the router file (see above). Wrap handlers with `wrap` from `util.js` and signal errors with `fail(status, message)`.
2. Admin list endpoints: use `listing.js` (`pageOf`, `addSearch`, `addRange`, `whereOf`); never filter whole tables in the browser.
3. Gate staff routes with a permission key; add new keys to `permissions.js`, then run `npm run docs:roles` in `server/`.
4. A route that writes data is audited automatically under `/api/admin`.
5. Add a test (below).

## Add a migration

Schema changes must be idempotent and safe on every start. In `server/src/migrate.js` (or an `ensure...` function it calls):

1. Read existing columns from `information_schema.COLUMNS`.
2. Run `ALTER TABLE ... ADD COLUMN` only if the column is missing, with a default so old rows stay valid.
3. Also add the column to `schema.sql` for fresh installs.
4. Never drop or rename in a migration. Deploy needs a service restart to apply it.

## Add a page

1. Create the component in `pages/` (or `admin/pages/`).
2. Storefront: add a `lazyPage(() => import(...))` entry and a `<Route>` in `App.jsx`. Admin: add it to `admin/nav.js` and the page switch in `AdminApp.jsx` (unverified detail; follow an existing page).
3. Fetch with `api.js` / `adminApi.js`; admin lists use `useTable`.
4. Put CSS in the matching file, with the prefix for that area.

## Add a test

- Files go in `server/test/<topic>.test.js`, using `node:test` and `node:assert/strict`.
- Test pure logic directly (see `delivery.test.js`). Avoid needing a live database.
- Run with `npm test` in `server/`. There are no client tests.

## CSS

- Prefixes in use (by area): `ac-` account, `a-` / `adm-` admin, `fd-` field/admin grids, `em-` email, `iv-` invoices, `od-` order detail, `ok-` order success, `cks-` checkout steps, `rvw2-` reviews, `dm-` district/map pieces, `dcb-` delivery combo, `pd-` product page, `ct-` cart, `hub`-area classes in `hub.css`. Take a new prefix only for a new area and check it is unused (`grep`).
- Do not add `!important`. Fix specificity or order instead (a later file, or a more specific selector).
- Use the existing colour and spacing tokens (`styles/tokens-base.css`) and shared components.
- Keep one look per thing: change shared tables, buttons and cards in the shared file, not per page.

## Accessibility and motion

- Use real `button` and `a` elements, labels on inputs, alt text on images, visible focus.
- Every animation must be disabled under `@media (prefers-reduced-motion: reduce)`.
- Check contrast and touch targets at phone width; no horizontal page scroll.

## Commit and deploy rules (general)

- Do not commit secrets, `.env`, database exports or customer data; describe settings by name only.
- Keep changes small and focused; run `npm test` and `npm run build` before shipping.
- Deploy with the code-only package, restart the service, then open the key pages in a browser to confirm they render. Database writes on the live system need explicit approval.
- Do not delete or restart other people's running servers.
