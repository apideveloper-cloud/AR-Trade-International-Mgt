import { Link } from 'react-router-dom';
import { productPath } from '../slug.js';
import ProductCard from '../components/ProductCard.jsx';
import { fmt } from '../api.js';
import { useStore } from '../store.jsx';

const head = (t, sub) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
    <h1 style={{ fontWeight: 800, fontSize: 'clamp(28px,3.4vw,42px)', letterSpacing: '-.025em', margin: 0, color: '#0b1631' }}>{t}</h1>
    <span style={{ color: '#5d6270', fontSize: 15 }}>{sub}</span>
  </div>
);

export function Wishlist() {
  const { wish, find } = useStore();
  const items = wish.map(find).filter(Boolean);
  return (
    <section style={{ maxWidth: 1600, margin: '0 auto', padding: '32px 28px 60px' }}>
      {head('My wishlist', 'Products you saved for later.')}
      {!items.length && <div className="empty2" style={{ display: 'block' }}>Your wishlist is empty. Tap ♡ on a product to save it.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>{items.map(p => <ProductCard key={p.id} p={p} />)}</div>
    </section>
  );
}

export function Compare() {
  const { compare, setCompare, find, toggleCompare, addToCart, cats } = useStore();
  const items = compare.map(find).filter(Boolean);
  const specOf = p => Object.fromEntries([['Brand', p.brand], ['Part no.', p.part], ['Technology', p.tech], ['Printing colour', p.color], ['Page yield / capacity', p.yield], ['Compatible printers', p.compat], ...(p.extra || [])].filter(r => r[1] && r[1] !== '—'));
  const sp = items.map(specOf);
  const keys = ['Price', 'Old price', 'Category', 'Stock', ...new Set(sp.flatMap(o => Object.keys(o)))];
  const val = (k, p, j) => (k === 'Price' ? (p.price ? fmt(p.price) : 'Ask') : k === 'Old price' ? (p.old ? fmt(p.old) : '—') : k === 'Category' ? (cats.find(c => c.id === p.cat)?.t || '—') : k === 'Stock' ? (p.stock > 0 ? `In stock (${p.stock})` : 'Out of stock') : sp[j][k] || '—');
  return (
    <section style={{ maxWidth: 1600, margin: '0 auto', padding: '32px 28px 60px' }}>
      {head('Compare products', 'Side-by-side specs for up to 3 products.')}
      {!items.length ? (
        <div className="empty2">Nothing to compare yet. Tap ⇄ on any product card to add it.<Link to="/shop/all" className="btn">Browse products</Link></div>
      ) : (
        <div className="cmp">
          <div className="cmp-grid" style={{ gridTemplateColumns: `200px repeat(${items.length}, minmax(220px,1fr))` }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: '.1em', color: '#7a8090' }}>{items.length} PRODUCTS</span>
              <button className="btn btn-ghost" style={{ alignSelf: 'flex-start', padding: '7px 12px', fontSize: 12 }} onClick={() => setCompare([])}>Clear all</button>
            </div>
            {items.map(p => (
              <div className="col" key={p.id}>
                <button onClick={() => toggleCompare(p.id)} title="Remove" style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: '50%', border: '1px solid #e1e5ec', background: '#fff', color: '#5d6270' }}>×</button>
                <Link to={productPath(p)} style={{ position: 'relative', height: 150, borderRadius: 14, background: '#f4f7fc', display: 'grid', placeItems: 'center' }}>{p.img && <img src={p.img} alt="" style={{ maxHeight: '96%', maxWidth: '96%', objectFit: 'contain', mixBlendMode: 'multiply' }} />}</Link>
                <Link to={productPath(p)} style={{ color: '#0b1631', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{p.name}</Link>
                <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 22, color: '#0b1631' }}>{p.price ? fmt(p.price) : 'Ask price'}</span>
                <button className="btn" onClick={() => addToCart(p)}>+ Add to cart</button>
              </div>
            ))}
            {keys.map((k, i) => (
              <div key={k} style={{ display: 'contents' }}>
                <div className={'k' + (i % 2 ? ' alt' : '')}>{k}</div>
                {items.map((p, j) => <div key={p.id} className={'v' + (i % 2 ? ' alt' : '')}>{val(k, p, j)}</div>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
