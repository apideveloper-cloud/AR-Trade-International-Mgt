import { Link } from 'react-router-dom';
import { fmtK, FILTERS0 } from './constants.js';
import './shop.css';

/** Left column: categories, price range and bands, availability, brand and the WhatsApp help box. */
export default function FilterSidebar({ cats, cat, products, f, set, setF, nAct, pLo, pHi, bands, nStock, nSale, nNew, brandsHere }) {
  const sideCats = [{ id: 'all', t: 'All products' }, ...cats];
  return (
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
        <div className="shpx-pricehd"><span className="ttl shpx-pttl">Price</span><span className="shpx-prange">৳ {pLo.toLocaleString('en-IN')} – ৳ {pHi.toLocaleString('en-IN')}</span></div>
        <input className="range" type="range" min={pLo} max={pHi} step={Math.max(100, Math.round((pHi - pLo) / 100 / 100) * 100)} value={f.pmax ?? pHi} onChange={e => set({ pmax: +e.target.value })} />
        <div className="minmax">
          <label>৳<input type="number" placeholder="Min" value={f.pmin ?? ''} onChange={e => set({ pmin: e.target.value === '' ? null : +e.target.value })} /></label><span className="shpx-dash">–</span>
          <label>৳<input type="number" placeholder="Max" value={f.pmax ?? ''} onChange={e => set({ pmax: e.target.value === '' ? null : +e.target.value })} /></label>
        </div>
        <div className="chips">
          {bands.map(([a, b]) => {
            const on = f.pmin === (a || null) && f.pmax === b;
            return <button key={a} className={'fchip' + (on ? ' on' : '')} onClick={() => set(on ? { pmin: null, pmax: null } : { pmin: a || null, pmax: b })}>{b == null ? fmtK(a) + '+' : a ? fmtK(a) + '–' + fmtK(b) : 'Under ' + fmtK(b)}</button>;
          })}
        </div>
      </div>
      <div className="sbox shpx-avail">
        <span className="ttl shpx-avail-ttl">Availability</span>
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
  );
}
