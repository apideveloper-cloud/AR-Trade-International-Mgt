import { Link } from 'react-router-dom';
import { productPath } from '../slug.js';
import ProductCard from '../components/ProductCard.jsx';
import { fmt } from '../api.js';
import { useStore } from '../store.jsx';
import ListPage from './lists/ListPage.jsx';

/** Saved-for-later products. */
export function Wishlist() {
  const { wish, find } = useStore();
  const items = wish.map(find).filter(Boolean);
  return (
    <ListPage title="My wishlist" sub="Products you saved for later.">
      {!items.length && <div className="empty2 wsl-empty">Your wishlist is empty. Tap ♡ on a product to save it.</div>}
      <div className="wsl-grid">{items.map(p => <ProductCard key={p.id} p={p} />)}</div>
    </ListPage>
  );
}

/** Side-by-side spec table for up to 3 products. */
export function Compare() {
  const { compare, setCompare, find, toggleCompare, addToCart, cats } = useStore();
  const items = compare.map(find).filter(Boolean);
  const specOf = p => Object.fromEntries([['Brand', p.brand], ['Part no.', p.part], ['Technology', p.tech], ['Printing colour', p.color], ['Page yield / capacity', p.yield], ['Compatible printers', p.compat], ...(p.extra || [])].filter(r => r[1] && r[1] !== '—'));
  const sp = items.map(specOf);
  const keys = ['Price', 'Old price', 'Category', 'Stock', ...new Set(sp.flatMap(o => Object.keys(o)))];
  const val = (k, p, j) => (k === 'Price' ? (p.price ? fmt(p.price) : 'Ask') : k === 'Old price' ? (p.old ? fmt(p.old) : '—') : k === 'Category' ? (cats.find(c => c.id === p.cat)?.t || '—') : k === 'Stock' ? (p.stock > 0 ? `In stock (${p.stock})` : 'Out of stock') : sp[j][k] || '—');
  return (
    <ListPage title="Compare products" sub="Side-by-side specs for up to 3 products.">
      {!items.length ? (
        <div className="empty2">Nothing to compare yet. Tap ⇄ on any product card to add it.<Link to="/shop/all" className="btn">Browse products</Link></div>
      ) : (
        <div className="cmp">
          <div className="cmp-grid" style={{ gridTemplateColumns: `200px repeat(${items.length}, minmax(220px,1fr))` }}>
            <div className="wsl-side">
              <span className="mono wsl-count">{items.length} PRODUCTS</span>
              <button className="btn btn-ghost wsl-clear" onClick={() => setCompare([])}>Clear all</button>
            </div>
            {items.map(p => (
              <div className="col" key={p.id}>
                <button onClick={() => toggleCompare(p.id)} title="Remove" className="wsl-rm">×</button>
                <Link to={productPath(p)} className="wsl-thumb">{p.img && <img src={p.img} alt="" className="wsl-img" />}</Link>
                <Link to={productPath(p)} className="wsl-name">{p.name}</Link>
                <span className="wsl-price">{p.price ? fmt(p.price) : 'Ask price'}</span>
                <button className="btn" onClick={() => addToCart(p)}>+ Add to cart</button>
              </div>
            ))}
            {keys.map((k, i) => (
              <div key={k} className="wsl-row">
                <div className={'k' + (i % 2 ? ' alt' : '')}>{k}</div>
                {items.map((p, j) => <div key={p.id} className={'v' + (i % 2 ? ' alt' : '')}>{val(k, p, j)}</div>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </ListPage>
  );
}
