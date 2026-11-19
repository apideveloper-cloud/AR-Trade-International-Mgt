import { useRef, useState } from 'react';
import { useDebounced } from '../../../fieldKit.jsx';
import { Editor } from '../../Catalog.jsx';
import { useInv } from './useInv.js';

/** A product that is bought for the first time is created with the same product form as the Products page; price and stock are set by the purchase. */
function NewProduct({ name, onClose, onCreated }) {
  const cats = useInv('/categories');
  if (!cats.data) return null;
  return <Editor purchase product={null} cats={cats.data.items} onClose={onClose} onSaved={onCreated} initial={{ name }} />;
}

/** Search box that lists products; picking one calls onPick(product). With `selected` it shows that product (and a clear button) instead.
 *  allowNew: when nothing matches, offer to create the product (used on purchases only). */
export function ProductPick({ onPick, selected, onClear, placeholder = 'Search product to add…', allowNew = false }) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const dq = useDebounced(q, 250); const box = useRef(null);
  const r = useInv(!selected && dq.trim().length >= 2 ? '/products?q=' + encodeURIComponent(dq.trim()) : null);
  if (selected) return <div className="iv-sel" title={selected.name}><b>{selected.name}</b><small>in stock {selected.stock}</small><button type="button" onClick={() => { onClear?.(); setTimeout(() => box.current?.focus(), 0); }} aria-label="Choose another product">✕</button></div>;
  const none = !r.loading && !(r.data?.items || []).length;
  return (
    <div className="iv-pick">
      <div className="iv-pickrow">
        <input ref={box} className="a-input" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} aria-label="Search products" />
        {allowNew && <button type="button" className="a-btn iv-newbtn" onClick={() => setCreating(true)}>+ New product</button>}
      </div>
      {q.trim().length >= 2 && (
        <div className="iv-res">
          {r.loading && !r.data ? <small>Searching…</small> : none ? <small>No product found.</small> : r.data.items.map(p => (
            <button key={p.id} type="button" onClick={() => { onPick(p); setQ(''); }}><span>{p.name}</span><em>stock {p.stock}</em></button>
          ))}
          {allowNew && !r.loading && <button type="button" className="iv-new" onClick={() => setCreating(true)}>+ New product “{q.trim()}”</button>}
        </div>
      )}
      {creating && <NewProduct name={q.trim()} onClose={() => setCreating(false)} onCreated={p => { setCreating(false); onPick(p); setQ(''); }} />}
    </div>
  );
}
