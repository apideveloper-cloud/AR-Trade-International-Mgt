# Client (React + Vite)

React 18, `react-router-dom` 7, Leaflet (admin and delivery maps). Plain CSS, no CSS framework.

## Commands

```
npm run dev       # Vite on port 5173, proxies /api to localhost:4000
npm run build     # output in client/dist
npm run preview
```

`vite.config.js` splits `react-vendor` and `leaflet-vendor` chunks so they stay cached across deploys.

## Structure (`src/`)

| Path | Role |
|---|---|
| `main.jsx`, `App.jsx` | Entry and router. `/admin`, `/hub`, `/email`, `/prefs/:token` and error screens are matched by path prefix; everything else is the storefront |
| `lazyPage.js` | Wrapper for on-demand page loading (every page except Home is lazy) |
| `store.jsx` | Storefront state (catalogue bootstrap, cart, user) |
| `api.js`, `admin/adminApi.js` | Fetch helpers for the storefront and admin APIs |
| `pages/` | Storefront pages (Home, Shop, Product, Cart/Checkout/Success, Account, Blog, Track, Info, ...); `pages/account/` holds the Account tabs |
| `components/` | Shared storefront parts (Header, Footer, Chat, DeliveryMap, ProductCard, overlays) |
| `admin/` | Admin console: `AdminApp`, `nav.js`, `ui.jsx` kit, `pages/` per area, `hooks/`, `styles/` |
| `hub/` | Delivery hub: dispatch, branches, returns, rider app, tracking page |
| `email/` | Email marketing app |
| `styles/`, `*.css` | Storefront CSS (see below) |
| `invoice.js`, `slug.js`, `phone.js`, `search.js`, `sanitize.js` | Small shared helpers |

## CSS

Global CSS is imported in `main.jsx`. Storefront CSS is split by area in `src/styles/` (`pd-*` product page, `header`, `footer`, `cart-checkout`, ...). Admin CSS lives in `admin/admin.css`, `admin/styles/` and per-page CSS files. Component-owned CSS sits next to the component. Admin UI rules are in `src/admin/STYLE_GUIDE.md`. Class prefixes are listed in `docs/CONVENTIONS.md`.
