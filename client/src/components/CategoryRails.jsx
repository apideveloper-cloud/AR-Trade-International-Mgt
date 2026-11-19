import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard.jsx';
import { useStore } from '../store.jsx';
import './category-rails-head.css';

const MAX = 20;
const SEED = 4; // cards (and their links) rendered up front in a row that is still far below the fold

/** One horizontally scrolling row; drifts back and forth by itself while visible, pauses on hover/touch/drag. */
function Rail({ cat, items, total }) {
  // endless loop: the list is rendered twice and the scroll position wraps from the second copy back to the first
  const loop = items.length >= 5;
  const [near, setNear] = useState(false); // below-the-fold rows render only a first slice until they come near the viewport
  const list = near ? (loop ? [...items, ...items] : items) : items.slice(0, SEED);
  const ref = useRef(null);
  const paused = useRef(false);
  const [vis, setVis] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVis(e.isIntersecting), { rootMargin: '200px' });
    wrap.current && io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '900px 0px' });
    wrap.current && io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!vis || !near || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf, last = performance.now(), pos = el.scrollLeft;
    const tick = now => {
      const dt = Math.min(64, now - last); last = now;
      const half = loop ? el.scrollWidth / 2 : 0;
      const max = el.scrollWidth - el.clientWidth;
      if (paused.current || document.hidden || max <= 4) pos = el.scrollLeft;
      else {
        if (Math.abs(el.scrollLeft - pos) > 3) pos = el.scrollLeft; // user scrolled / pressed an arrow
        pos += dt * 0.035;
        if (loop && pos >= half) pos -= half;
        else if (!loop && pos >= max) pos = 0;
        el.scrollLeft = pos;
      }
      if (loop) { if (el.scrollLeft >= half) { el.scrollLeft -= half; pos = el.scrollLeft; } }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vis, near, loop]);

  const by = d => {
    const el = ref.current;
    if (!el) return;
    if (loop && d < 0 && el.scrollLeft < el.clientWidth) el.scrollLeft += el.scrollWidth / 2; // step back across the seam
    el.scrollBy({ left: d * Math.max(260, el.clientWidth * 0.8), behavior: 'smooth' });
  };
  return (
    <div className="crail" ref={wrap}>
      <div className="crail-hd">
        <div><h3>{cat.t}</h3><span>Showing {items.length} of {total} products</span></div>
        <div className="act">
          <button type="button" aria-label="Scroll left" onClick={() => by(-1)}>‹</button>
          <button type="button" aria-label="Scroll right" onClick={() => by(1)}>›</button>
          <Link to={'/shop/' + cat.id}>View all →</Link>
        </div>
      </div>
      <div className="crail-track" ref={ref}
        onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}
        onTouchStart={() => { paused.current = true; }} onTouchEnd={() => setTimeout(() => { paused.current = false; }, 4000)}
        onFocus={() => { paused.current = true; }} onBlur={() => { paused.current = false; }}>
        {list.map((p, n) => <div className="crail-item" key={p.id + '-' + n} aria-hidden={n >= items.length || undefined}><ProductCard p={p} /></div>)}
        {!loop && <Link to={'/shop/' + cat.id} className="crail-more"><b>See all {total}</b><span>{cat.t} →</span></Link>}
      </div>
    </div>
  );
}

/** Home page: a scrolling product row for every category, so visitors see the catalogue at a glance. */
export default function CategoryRails() {
  const { cats, products, site } = useStore();
  const limit = Math.min(MAX, Math.max(1, parseInt(site.homeRailLimit, 10) || MAX));
  const rows = useMemo(() => cats.map(c => {
    const all = products.filter(p => p.cat === c.id);
    // best-looking first: popular / featured / new, with a photo and a price
    const score = p => (p.img ? 4 : 0) + (p.price ? 3 : 0) + (p.popular ? 2 : 0) + (p.featured ? 2 : 0) + (p.isNew ? 1 : 0) + (p.old > p.price ? 1 : 0);
    const items = [...all].sort((a, b) => score(b) - score(a)).slice(0, limit);
    return { cat: c, items, total: all.length };
  }).filter(r => r.items.length >= 1).sort((a, b) => b.total - a.total), [cats, products, limit]);
  if (site.homeRails === false || !rows.length) return null;
  return (
    <section className="sec crails">
      <div className="sec-hd"><div><span className="mono cmpx-crhd-k">PRODUCTS BY CATEGORY</span><h2 className="cmpx-crhd-h">Browse every category</h2></div></div>
      {rows.map(r => <Rail key={r.cat.id} {...r} />)}
    </section>
  );
}
