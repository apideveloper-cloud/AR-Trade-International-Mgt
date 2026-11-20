import { useEffect, useMemo, useRef, useState } from 'react';
import { matchProducts } from '../search.js';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard.jsx';
import { useStore } from '../store.jsx';
import { PG, SORTS, SORT_FN, FILTERS0 } from './shop/constants.js';
import ListRow from './shop/ListRow.jsx';
import Pager from './shop/Pager.jsx';
import FilterSidebar from './shop/FilterSidebar.jsx';
import { SkeletonCard, SkeletonRow } from './shop/Skeletons.jsx';
import './shop/shop.css';

const VIEWS = [['grid', '▦', 'Grid'], ['list', '☰', 'List']];
const isOnSale = p => p.old && p.price && p.old > p.price;

/** Shop listing: category/search/filters, grid or list view, numbered pagination (24 per page, ?page=N). */
export default function Shop() {
  const { cat = 'all' } = useParams();
  const { search, pathname } = useLocation();
  const [sp] = useSearchParams();
  const { products, cats } = useStore();
  const q = (sp.get('q') || '').trim();
  const onlyNew = sp.get('new') === '1';
  const page = Math.max(1, parseInt(sp.get('page'), 10) || 1);
  const offset = (page - 1) * PG;

  const [f, setF] = useState(FILTERS0);
  const [sort, setSort] = useState('pop');
  const [view, setView] = useState(() => { try { return localStorage.getItem('arShopView') || 'grid'; } catch { return 'grid'; } });
  const [boot, setBoot] = useState(true);
  const set = patch => setF(s => ({ ...s, ...patch }));

  // the design resets filters and shows a short skeleton whenever the category or search changes
  // (the page number is not part of this: moving to page 2 of a filtered list must keep the filters)
  const searchNoPage = (() => { const u = new URLSearchParams(search); u.delete('page'); return u.toString(); })();
  useEffect(() => {
    setF(FILTERS0); setBoot(true);
    const t = setTimeout(() => setBoot(false), 200);
    return () => clearTimeout(t);
  }, [cat, searchNoPage]);

  // real page links: scroll to the top when only the page number changed
  const prevPg = useRef({ page, cat, q });
  useEffect(() => {
    const p = prevPg.current;
    if (p.page !== page && p.cat === cat && p.q === q) window.scrollTo(0, 0);
    prevPg.current = { page, cat, q };
  }, [page, cat, q]);

  const base = useMemo(() => {
    const hit = q.trim() ? new Set(matchProducts(products, q).map(p => p.id)) : null; // the same matching as the header live search
    return products.filter(p => (cat === 'all' || p.cat === cat) && (!onlyNew || p.isNew) && (!hit || hit.has(p.id)));
  }, [products, cat, q, onlyNew]);
  const brandsHere = useMemo(() => [...new Set(base.map(p => p.brand))], [base]);
  const afterBrand = useMemo(() => base.filter(p => (f.brand === 'all' || p.brand === f.brand) && (!f.inStock || p.stock > 0)), [base, f.brand, f.inStock]);
  const priced = afterBrand.filter(p => p.price > 0);
  const pLo = priced.length ? Math.min(...priced.map(p => p.price)) : 0;
  const pHi = priced.length ? Math.max(...priced.map(p => p.price)) : 0;
  const nSale = afterBrand.filter(isOnSale).length;
  const nNew = afterBrand.filter(p => p.isNew).length;
  const nStock = base.filter(p => (f.brand === 'all' || p.brand === f.brand) && p.stock > 0).length;

  const items = useMemo(() => {
    let r = afterBrand;
    if (f.fSale) r = r.filter(isOnSale);
    if (f.fNew) r = r.filter(p => p.isNew);
    if (f.pmin != null) r = r.filter(p => p.price >= f.pmin);
    if (f.pmax != null) r = r.filter(p => p.price && p.price <= f.pmax);
    return [...r].sort(SORT_FN[sort]);
  }, [afterBrand, f, sort]);

  const shown = boot ? [] : items.slice(offset, offset + PG); // one page of 24; the page links below and above move between pages
  const pageCount = Math.ceil(items.length / PG);
  const pageHref = n => {
    const u = new URLSearchParams(sp);
    if (n > 1) u.set('page', String(n)); else u.delete('page');
    const qs = u.toString();
    return pathname + (qs ? '?' + qs : '');
  };
  const pagerProps = { page, pageCount, pageHref };

  const current = cats.find(c => c.id === cat);
  const title = q ? `Results for “${q}”` : onlyNew ? 'New arrivals' : current ? current.t : 'All products';
  const nAct = (f.brand !== 'all') + f.inStock + f.fSale + f.fNew + (f.pmin != null || f.pmax != null);
  const bands = [[0, 5000], [5000, 15000], [15000, 50000], [50000, null]].filter(([a]) => a < pHi || a === 0);
  const setV = v => { setView(v); try { localStorage.setItem('arShopView', v); } catch { /* storage unavailable */ } };
  const skels = boot ? Array.from({ length: Math.min(PG, items.length || 8) }, (_, i) => i) : [];

  if (!boot && page > 1 && items.length > 0 && offset >= items.length) {
    const u = new URLSearchParams(sp); u.delete('page');
    const qs = u.toString();
    return <Navigate replace to={pathname + (qs ? '?' + qs : '')} />;
  }

  return (
    <section className="page shpx-page">
      <div className="crumbs"><Link to="/">Home</Link><span>/</span><span>{title}</span></div>
      <div className="shop-top">
        <div className="shpx-head"><h1 className="h1">{title}</h1><span className="shpx-count">{items.length} products</span></div>
        <div className="shop-tools">
          <button className="toggle" onClick={() => set({ inStock: !f.inStock })}><span className={'sw' + (f.inStock ? ' on' : '')} />In stock only</button>
          <div className="seg">{VIEWS.map(([k, i, t]) => <button key={k} className={'dark' + (view === k ? ' on' : '')} title={t} onClick={() => setV(k)}><span className="shpx-vi">{i}</span>{t}</button>)}</div>
          <div className="seg"><span className="lab">Sort</span>{SORTS.map(([k, i, t]) => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}><span className="shpx-si">{i}</span>{t}</button>)}</div>
        </div>
      </div>
      <div className="shop-body">
        <FilterSidebar {...{ cats, cat, products, f, set, setF, nAct, pLo, pHi, bands, nStock, nSale, nNew, brandsHere }} />
        <div className="shop-main">
          {!items.length && !boot && (
            <div className="empty shpx-empty">
              <span className="shpx-empty-t">Nothing listed here yet</span>
              <span className="shpx-empty-s">We stock more than we list online. Call or WhatsApp for current availability and prices.</span>
              <a href="tel:+8801977554401" className="btn btn-dark btn-pill shpx-empty-btn">Call +880 1977-554401</a>
            </div>
          )}
          <Pager where="top" {...pagerProps} />
          {view === 'grid' ? (
            <div className="p-grid">
              {shown.map((p, n) => <div key={p.id}><ProductCard p={p} priority={n < 4} /></div>)}
              {skels.map(i => <SkeletonCard key={'s' + i} />)}
            </div>
          ) : (
            <div className="p-list">{shown.map(p => <ListRow key={p.id} p={p} />)}{skels.map(i => <SkeletonRow key={'s' + i} />)}</div>
          )}
          {!boot && items.length > 0 && (
            <div className="loadmore">
              <span className="shpx-showing">Showing {offset + 1}–{offset + shown.length} of {items.length}</span>
            </div>
          )}
          <Pager where="bottom" {...pagerProps} />
        </div>
      </div>
    </section>
  );
}
