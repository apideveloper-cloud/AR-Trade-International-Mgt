import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { productPath } from '../../slug.js';
import { fmt } from '../../api.js';
import './product-extra.css';

/** Endless offer rail (items are listed twice): drifts left and wraps with no jump, paused while hovered/touched or when the tab is hidden. */
function useRailDrift(railRef, pausedRef, resetKey) {
  useEffect(() => {
    const el = railRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf, last = performance.now(), pos = el.scrollLeft;
    const tick = now => {
      const dt = Math.min(64, now - last); last = now;
      const half = el.scrollWidth / 2;
      if (Math.abs(el.scrollLeft - pos) > 3) pos = el.scrollLeft; // user dragged or pressed a button
      if (pausedRef.current || document.hidden || half <= el.clientWidth) pos = el.scrollLeft;
      else { pos += dt * 0.035; if (pos >= half) pos -= half; el.scrollLeft = pos; }
      if (el.scrollLeft >= half) { el.scrollLeft -= half; pos = el.scrollLeft; }
      else if (el.scrollLeft <= 0 && pausedRef.current) { el.scrollLeft += half; pos = el.scrollLeft; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [railRef, pausedRef, resetKey]);
}

/** "Offer products" heading with scroll arrows and the looping rail. `resetKey` restarts the drift when the product changes. */
export default function OfferRail({ offers, resetKey }) {
  const railRef = useRef(null);
  const pausedRef = useRef(false);
  useRailDrift(railRef, pausedRef, resetKey);
  const scroll = left => () => railRef.current?.scrollBy({ left, behavior: 'smooth' });
  return (
    <div className="pd-offers">
      <div className="sec-hd pfx-offers-hd"><h2>Offer products</h2><div className="rail-nav"><button type="button" aria-label="Scroll left" onClick={scroll(-360)}>‹</button><button type="button" aria-label="Scroll right" onClick={scroll(360)}>›</button><Link to="/offers" className="ac-link">All offers →</Link></div></div>
      <div className="offer-rail" ref={railRef} onMouseEnter={() => { pausedRef.current = true; }} onMouseLeave={() => { pausedRef.current = false; }} onTouchStart={() => { pausedRef.current = true; }} onTouchEnd={() => setTimeout(() => { pausedRef.current = false; }, 4000)}>
        {[...offers, ...offers].map((x, n) => (
          <Link key={x.id + '-' + n} aria-hidden={n >= offers.length || undefined} tabIndex={n >= offers.length ? -1 : undefined} to={productPath(x)}>
            <span className="th" style={{ backgroundImage: x.img ? `url('${x.img}')` : 'none' }} />
            <span className="nm clamp2">{x.name}</span>
            <span><b>{fmt(x.price)}</b><s>{fmt(x.old)}</s></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
