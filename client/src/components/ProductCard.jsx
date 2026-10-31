import { useEffect, useRef, useState } from 'react';
import { productPath } from '../slug.js';
import { Link } from 'react-router-dom';
import { fmt, offPct, waLink } from '../api.js';
import { useStore } from '../store.jsx';

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
        {p.img ? (
          <>
            {!loaded && <div className="shimmer" style={{ position: 'absolute', inset: 0 }} />}
            {near && <img src={p.img} alt={p.name} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} style={{ opacity: loaded ? 1 : 0 }} />}
          </>
        ) : <div className="ph">product photo</div>}
        <div className="pc-badges">{off > 0 && <span className="b-off">−{off}%</span>}{p.isNew && <span className="b-new">New</span>}</div>
        <button className={'round cmp' + (c ? ' on' : '')} title="Compare" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleCompare(p.id); }}>⇄</button>
        <button className={'round wish' + (w ? ' on' : '')} title="Wishlist" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWish(p.id); }}>{w ? '♥' : '♡'}</button>
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><BuyAction p={p} cls="add" label="+ Add" /></div>
      </div>
    </article>
  );
}
