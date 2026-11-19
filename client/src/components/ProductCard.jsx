import { useEffect, useRef, useState } from 'react';
import { productPath } from '../slug.js';
import { Link } from 'react-router-dom';
import { fmt, offPct, waLink } from '../api.js';
import { useStore } from '../store.jsx';
import './product-card-extra.css';

/** The add / in-cart / ask-price / out-of-stock action used on cards, lists and spotlight blocks. */
export function BuyAction({ p, cls = 'add', label = '+ Add' }) {
  const { cart, addToCart, site } = useStore();
  const q = cart[p.id] || 0;
  if (!p.price) return <a className="ask" href={waLink(site, 'Hi, I want to order: ' + p.name)} target="_blank" rel="noreferrer">Ask price</a>;
  if (q > 0) return <button className="incart" onClick={() => addToCart(p)}>In cart · {q}</button>;
  if (p.stock <= 0) return <span className="oos">Out of stock</span>;
  return <button className={cls} onClick={() => addToCart(p)}>{label}</button>;
}

export default function ProductCard({ p }) {
  const { wish, toggleWish, compare, toggleCompare } = useStore();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false); // the picture file is missing: show the placeholder, never the browser's broken-image alt text
  const [near, setNear] = useState(false); // lazy loader: the image is requested only when its card is close to the viewport
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '300px 400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const off = offPct(p);
  const w = wish.includes(p.id), c = compare.includes(p.id);
  return (
    <article className="pcard">
      <Link to={productPath(p)} className="pc-img" ref={box}>
        {p.img && !failed ? (
          <>
            {!loaded && <div className="shimmer cmpx-fill" />}
            {near && <img src={p.img} alt={p.name} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ opacity: loaded ? 1 : 0 }} />}
          </>
        ) : <div className="ph">No photo yet</div>}
        <div className="pc-badges">{off > 0 && <span className="b-off">−{off}%</span>}{p.isNew && <span className="b-new">New</span>}</div>
        <button className={'round cmp' + (c ? ' on' : '')} title="Compare" aria-label="Compare" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleCompare(p.id); }}>⇄</button>
        <button className={'round wish' + (w ? ' on' : '')} title="Wishlist" aria-label="Wishlist" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWish(p.id); }}>{w ? '♥' : '♡'}</button>
      </Link>
      <div className="pc-body">
        <div className="pc-meta"><span className="brand-k">{p.brand}</span><span className="dot3" /><span className="sp">{p.spec}</span></div>
        <Link to={productPath(p)} className="clamp2 pc-name">{p.name}</Link>
      </div>
      <div className="pc-foot">
        <div className="pc-price">
          <b style={p.price ? undefined : { fontSize: 15 }}>{p.price ? fmt(p.price) : 'On request'}</b>
          {off > 0 && <s>{fmt(p.old)}</s>}
        </div>
        <div className="cmpx-actions"><BuyAction p={p} cls="add" label="+ Add" /></div>
      </div>
    </article>
  );
}
