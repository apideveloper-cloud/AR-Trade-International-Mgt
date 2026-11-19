import { useState } from 'react';
import ProductCard from '../../components/ProductCard.jsx';
import { offPct } from '../../api.js';
import { useStore } from '../../store.jsx';
import './info.css';

/** Offers page: hot-sale banner and discounted products, biggest discount first, loaded 24 at a time. */
export function Offers() {
  const { products, site } = useStore();
  const items = products.filter(p => p.old && p.price && p.price < p.old).sort((a, b) => offPct(b) - offPct(a));
  const [shown, setShown] = useState(24);
  return (
    <section className="inf-wrap">
      <div className="inf-offer-hero">
        <span className="mono inf-offer-kick">Hot sale · limited time</span>
        <h1 className="inf-h1-offer">{site.offerTitle}</h1>
        <p className="inf-offer-sub">{site.offerSub}</p>
      </div>
      <div className="inf-offer-grid">{items.slice(0, shown).map(p => <ProductCard key={p.id} p={p} />)}</div>
      {items.length > shown && <button className="btn btn-dark btn-pill inf-more" onClick={() => setShown(n => n + 24)}>Load more offers ({items.length - shown} more)</button>}
    </section>
  );
}
