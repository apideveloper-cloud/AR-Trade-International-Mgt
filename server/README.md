# Server (Express + MySQL)

ES modules, Express 4, `mysql2`. `src/index.js` starts it; `src/app.js` assembles middleware and routers.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | `node --watch src/index.js` (port 4000) |
| `npm start` | Production start |
| `npm test` | `node --test test/*.test.js` |
| `npm run db:setup` | Create missing tables, upsert catalogue/content |
| `npm run db:reset` | Drop all tables, then set up (destroys data) |
| `npm run docs:roles` | Regenerate `../ROLE_MATRIX.md` |
| `npm run db:export`, `db:patch` | Export full SQL or a patch |
| `npm run db:optimize` | Add indexes |
| `import:site`, `migrate:wp`, `scrape:products`, `seo:products` | Data import and SEO scripts (see `scripts/`) |
| `images:*`, `assets:*` | Image and asset localising/optimising scripts |
| `db:lockdown` | Lock the demo accounts |

## Startup sequence (`index.js`)

1. In production, check `JWT_SECRET`.
2. `ensureSchema()` (`migrate.js`): idempotent table and column upgrades.
3. `initPermissions()`: role matrix tables and default grants.
4. Listen, then start the mail worker, audit prune, six-hourly backup schedule and the field-track purge (rows older than 90 days).

## setup.js vs schema.sql vs migrate.js

- `schema.sql`: base table definitions (`CREATE TABLE IF NOT EXISTS`).
- `setup.js`: manual command; creates tables and seeds from `ar-data.source.js`.
- `migrate.js`: runs on every start; adds missing columns and tables, never drops. This is what makes a code-only deploy safe.
- `field/migrate.js` and `field/sql/*.sql`: the same idea for the field app tables.

## Layout

See `../docs/ARCHITECTURE.md` for the file-by-file map. In short: `routes/` storefront API, `admin/` and `admin*.js` staff API, `field/` mobile API, `middleware/`, and helper modules at the top of `src/`. Tests are in `test/`; uploaded images in `uploads/`.
