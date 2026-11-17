import { useEffect, useMemo, useRef, useState } from 'react';
import { productPath } from '../slug.js';
import { matchProducts } from '../search.js';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import ProductCard, { BuyAction } from '../components/ProductCard.jsx';
import { fmt, offPct } from '../api.js';
import { useStore } from '../store.jsx';

const PG = 24;
const SORTS = [['pop', '★', 'Popular'], ['low', '↑', 'Price low'], ['high', '↓', 'Price high'], ['off', '%', 'Discount'], ['new', '✦', 'Newest']];
const SORT_FN = {
  pop: (a, b) => b.popular - a.popular, low: (a, b) => (a.price || 1e9) - (b.price || 1e9), high: (a, b) => b.price - a.price,
  off: (a, b) => (b.old && b.price ? 1 - b.price / b.old : 0) - (a.old && a.price ? 1 - a.price / a.old : 0), new: (a, b) => b.isNew - a.isNew
};
const fmtK = n => (n >= 1000 ? '৳ ' + Math.round(n / 100) / 10 + 'k' : '৳ ' + n);
const FILTERS0 = { brand: 'all', inStock: false, fSale: false, fNew: false, pmin: null, pmax: null };

function ListRow({ p }) {
  const { wish, toggleWish } = useStore();
  const off = offPct(p);
  return (
    <article className="lrow">
      <Link to={productPath(p)} className="im">{p.img && <img src={p.img} alt={p.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}{off > 0 && <span className="b-off">−{off}%</span>}</Link>
      <div className="mid">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className="bk">{p.brand}</span>{p.isNew && <span className="b-new">New</span>}</div>
        <Link to={productPath(p)}><h3>{p.name}</h3></Link>
        <span style={{ fontSize: 13, color: '#6b7080' }}>{p.spec}</span>
        <div className="tick"><span>✓ Genuine product</span><span>✓ Cash on delivery</span><span>✓ Dhaka next-day</span></div>
      </div>
      <div className="rt">
        <div className="pr"><b>{p.price ? fmt(p.price) : 'On request'}</b>{off > 0 && <s>{fmt(p.old)}</s>}</div>
        <div className="acts">
          <button className={'sq' + (wish.includes(p.id) ? ' on' : '')} title="Wishlist" onClick={() => toggleWish(p.id)}>{wish.includes(p.id) ? '♥' : '♡'}</button>
          <BuyAction p={p} cls="add" label="+ Add to cart" />
        </div>
      </div>
    </article>
  );
}

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
  useEffect(() => {
    setF(FILTERS0); setBoot(true);
    const t = setTimeout(() => setBoot(false), 200);
    return () => clearTimeout(t);
  }, [cat, search]);

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
  const nSale = afterBrand.filter(p => p.old && p.price && p.old > p.price).length;
  const nNew = afterBrand.filter(p => p.isNew).length;
  const nStock = base.filter(p => (f.brand === 'all' || p.brand === f.brand) && p.stock > 0).length;

  const items = useMemo(() => {
    let r = afterBrand;
    if (f.fSale) r = r.filter(p => p.old && p.price && p.old > p.price);
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
  const pageNums = [];
  for (let n = 1; n <= pageCount; n++) if (n === 1 || n === pageCount || Math.abs(n - page) <= 2) pageNums.push(n);

  const pager = where => pageCount > 1 && (
    <nav className={'shop-pg ' + where} aria-label={where === 'top' ? 'Pagination (top)' : 'Pagination'}>
              {page > 1 && page <= pageCount && <Link className="shop-pg-a shop-pg-nav" rel="prev" to={pageHref(page - 1)}>‹ Previous</Link>}
              {pageNums.map((n, i) => (
                <span key={n} className="shop-pg-item">
                  {i > 0 && n - pageNums[i - 1] > 1 && <span className="shop-pg-gap" aria-hidden="true">…</span>}
                  <Link className={'shop-pg-a' + (n === page ? ' on' : '')} to={pageHref(n)} aria-current={n === page ? 'page' : undefined} aria-label={'Page ' + n}>{n}</Link>
                </span>
              ))}
              {page < pageCount && <Link className="shop-pg-a shop-pg-nav" rel="next" to={pageHref(page + 1)}>Next ›</Link>}
            </nav>
  );

  const current = cats.find(c => c.id === cat);
  const title = q ? `Results for “${q}”` : onlyNew ? 'New arrivals' : current ? current.t : 'All products';
  const nAct = (f.brand !== 'all') + f.inStock + f.fSale + f.fNew + (f.pmin != null || f.pmax != null);
  const bands = [[0, 5000], [5000, 15000], [15000, 50000], [50000, null]].filter(([a]) => a < pHi || a === 0);
  const sideCats = [{ id: 'all', t: 'All products' }, ...cats];
  const setV = v => { setView(v); try { localStorage.setItem('arShopView', v); } catch { /* storage unavailable */ } };
  const skels = boot ? Array.from({ length: Math.min(PG, items.length || 8) }, (_, i) => i) : [];

  if (!boot && page > 1 && items.length > 0 && offset >= items.length && f === FILTERS0) {
    const u = new URLSearchParams(sp); u.delete('page');
    const qs = u.toString();
    return <Navigate replace to={pathname + (qs ? '?' + qs : '')} />;
  }

  return (
    <section className="page" style={{ padding: '24px 28px 40px' }}>
      <div className="crumbs"><Link to="/">Home</Link><span>/</span><span>{title}</span></div>
      <div className="shop-top">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><h1 className="h1">{title}</h1><span style={{ color: '#5d6270', fontSize: 14 }}>{items.length} products</span></div>
        <div className="shop-tools">
          <button className="toggle" onClick={() => set({ inStock: !f.inStock })}><span className={'sw' + (f.inStock ? ' on' : '')} />In stock only</button>
          <div className="seg">{[['grid', '▦', 'Grid'], ['list', '☰', 'List']].map(([k, i, t]) => <button key={k} className={'dark' + (view === k ? ' on' : '')} title={t} onClick={() => setV(k)}><span style={{ fontSize: 14, lineHeight: 1 }}>{i}</span>{t}</button>)}</div>
          <div className="seg"><span className="lab">Sort</span>{SORTS.map(([k, i, t]) => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}><span style={{ fontSize: 12, opacity: .85 }}>{i}</span>{t}</button>)}</div>
        </div>
      </div>
      <div className="shop-body">
        <aside className="side">
          <div className="sbox cat-side">
            <div className="hd"><span><i>☰</i>Categories</span><small>{cats.length} groups</small></div>
            {sideCats.map(c => {
              const ini = c.id === 'all' ? '✦' : c.t.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
              return (
                <Link key={c.id} to={'/shop/' + c.id} className={'cat-link' + (c.id === cat ? ' on' : '')}>
                  <span className="ini">{ini}</span><span className="nm">{c.t}</span><span className="ct">{c.id === 'all' ? products.length : products.filter(p => p.cat === c.id).length}</span>
                </Link>
              );
            })}
          </div>
          {nAct > 0 && <div className="active-f"><span>Filters · {nAct} active</span><button onClick={() => setF(FILTERS0)}>Reset ✕</button></div>}
          <div className="sbox">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="ttl" style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 15, color: 'var(--navy)' }}>Price</span><span style={{ fontSize: 11, color: '#8a93a6' }}>৳ {pLo.toLocaleString('en-IN')} – ৳ {pHi.toLocaleString('en-IN')}</span></div>
            <input className="range" type="range" min={pLo} max={pHi} step={Math.max(100, Math.round((pHi - pLo) / 100 / 100) * 100)} value={f.pmax ?? pHi} onChange={e => set({ pmax: +e.target.value })} />
            <div className="minmax">
              <label>৳<input type="number" placeholder="Min" value={f.pmin ?? ''} onChange={e => set({ pmin: e.target.value === '' ? null : +e.target.value })} /></label><span style={{ color: '#a0a8b8' }}>–</span>
              <label>৳<input type="number" placeholder="Max" value={f.pmax ?? ''} onChange={e => set({ pmax: e.target.value === '' ? null : +e.target.value })} /></label>
            </div>
            <div className="chips">
              {bands.map(([a, b]) => {
                const on = f.pmin === (a || null) && f.pmax === b;
                return <button key={a} className={'fchip' + (on ? ' on' : '')} onClick={() => set(on ? { pmin: null, pmax: null } : { pmin: a || null, pmax: b })}>{b == null ? fmtK(a) + '+' : a ? fmtK(a) + '–' + fmtK(b) : 'Under ' + fmtK(b)}</button>;
              })}
            </div>
          </div>
          <div className="sbox" style={{ gap: 6 }}>
            <span className="ttl" style={{ marginBottom: 4 }}>Availability</span>
            {[['inStock', 'In stock', nStock], ['fSale', 'On sale', nSale], ['fNew', 'New arrivals', nNew]].map(([k, t, n]) => (
              <button key={k} className={'chk' + (f[k] ? ' on' : '')} onClick={() => set({ [k]: !f[k] })}><span className="bx">{f[k] ? '✓' : ''}</span><span className="t">{t}</span><span className="n">{n}</span></button>
            ))}
          </div>
          <div className="sbox">
            <span className="ttl">Brand</span>
            <div className="chips">{['all', ...brandsHere].map(b => <button key={b} className={'fchip lg' + (f.brand === b ? ' on' : '')} onClick={() => set({ brand: b })}>{b === 'all' ? 'All brands' : b}</button>)}</div>
          </div>
          <div className="help"><b>Can't find your model?</b><span>Send us your printer model — we'll confirm the right toner in minutes.</span><a href="https://wa.me/8801977554401" target="_blank" rel="noreferrer">WhatsApp us</a></div>
        </aside>
        <div className="shop-main">
          {!items.length && !boot && (
            <div className="empty" style={{ gap: 12 }}>
              <span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 22 }}>Nothing listed here yet</span>
              <span style={{ color: '#5d6270', fontSize: 14, maxWidth: 420, lineHeight: 1.5 }}>We stock more than we list online. Call or WhatsApp for current availability and prices.</span>
              <a href="tel:+8801977554401" className="btn btn-dark btn-pill" style={{ padding: '12px 20px' }}>Call +880 1977-554401</a>
            </div>
          )}
          {pager('top')}
          {view === 'grid' ? (
            <div className="p-grid">
              {shown.map(p => <div key={p.id}><ProductCard p={p} /></div>)}
              {skels.map(i => (
                <article key={'s' + i} className="pcard" style={{ gap: 14 }}>
                  <div className="shimmer" style={{ aspectRatio: '1/.92', borderRadius: 16 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 6px' }}><div className="shimmer" style={{ height: 10, width: '40%', borderRadius: 6 }} /><div className="shimmer" style={{ height: 14, width: '92%', borderRadius: 6 }} /><div className="shimmer" style={{ height: 14, width: '70%', borderRadius: 6 }} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 6px 4px', borderTop: '1px dashed #eef1f6' }}><div className="shimmer" style={{ height: 22, width: '42%', borderRadius: 8 }} /><div className="shimmer" style={{ height: 38, width: 76, borderRadius: 999 }} /></div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-list">{shown.map(p => <ListRow key={p.id} p={p} />)}{skels.map(i => <div key={'s' + i} className="lrow"><div className="shimmer" style={{ aspectRatio: 1, borderRadius: 14 }} /><div className="shimmer" style={{ height: 60, borderRadius: 8 }} /><div className="shimmer" style={{ height: 40, width: 140, borderRadius: 999 }} /></div>)}</div>
          )}
          {!boot && items.length > 0 && (
            <div className="loadmore">
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#5b6778' }}>Showing {offset + 1}–{offset + shown.length} of {items.length}</span>
            </div>
          )}
          {pager('bottom')}
        </div>
      </div>
    </section>
  );
}
