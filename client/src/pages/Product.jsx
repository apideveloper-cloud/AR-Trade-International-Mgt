import { useEffect, useRef, useState } from 'react';
import { productIdOf, productPath } from '../slug.js';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard.jsx';
import { api, fmt, offPct, waLink } from '../api.js';
import Reviews, { Stars } from '../components/Reviews.jsx';
import BestSellers from '../components/BestSellers.jsx';
import { useStore } from '../store.jsx';
import { NotFound } from './Info.jsx';
import Lightbox from '../components/Lightbox.jsx';
import { cleanHtml } from '../sanitize.js';

const HOW = [
  'উপরের মেনু বার থেকে আপনার কাংখিত প্রোডাক্টটির ক্যাটাগরি সিলেক্ট করুন।',
  'অথবা সার্চ অপশনে গিয়ে আপনার প্রোডাক্টটির নাম লিখে সার্চ করুন।',
  'আপনার কাংখিত প্রোডাক্টটি নির্বাচিত হলে “Add To Cart” বাটনে ক্লিক করুন।',
  'পেইজের উপরের ডানদিকে কোণায় আইকন ক্লিক করে আপনার নির্বাচিত পণ্যগুলি “Checkout” বাটনে ক্লিক করুন।',
  'আপনার সম্পর্কিত তথ্য পূরণ করুন কিংবা পূর্ববর্তী একাউন্টে লগইন করুন এবং “Place Order” বাটনে ক্লিক করুন।'
];

const NAMES = { f: 'Facebook', X: 'X', in: 'LinkedIn', W: 'WhatsApp', '@': 'email' };
const SPEC_ICON = { Brand: '★', 'Part no.': '#', Technology: '⚡', 'Printing colour': '◐', 'Page yield / capacity': '≡', 'Compatible printers': '⎙', Warranty: '✓' };

function specs(p) {
  return [['Brand', p.brand], ['Part no.', p.part], ['Technology', p.tech], ['Printing colour', p.color], ['Page yield / capacity', p.yield], ['Compatible printers', p.compat], ...(p.extra || [])]
    .filter(r => r[1] && r[1] !== '—').concat([['Warranty', 'Yes — 100% original product']]);
}

export default function Product() {
  const { id: segment } = useParams();
  const here = useLocation().pathname;
  const { find, products, cats, site, addToCart, wish, toggleWish, compare, toggleCompare, user, setLoginOpen } = useStore();
  const nav = useNavigate();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('spec');
  const [zoom, setZoom] = useState(null); // { x, y } while hovering the image
  const [barOn, setBarOn] = useState(false);
  const [view, setView] = useState(0);
  const [rv, setRv] = useState(null);
  const [full, setFull] = useState(null); // full record with the image gallery and description
  const [box, setBox] = useState(false);
  const buyRef = useRef(null);
  const railRef = useRef(null);
  const howRef = useRef(null);
  const [howIn, setHowIn] = useState(false);
  const p = products.find(x => x.slug === segment) || find(productIdOf(segment) || segment); // /product/hp-230a-toner, and the old /product/hp-230a-toner-21554 or /product/21554
  const id = p ? p.id : productIdOf(segment) || segment;

  useEffect(() => { setQty(1); setTab('spec'); setZoom(null); setView(0); setBox(false); }, [id]);
  // an old or mistyped address (/product/21554) is replaced by the real one, so the address bar and shared links always show the keyword address
  useEffect(() => { if (p && here !== productPath(p)) nav(productPath(p), { replace: true }); }, [p, here, nav]);
  // title + description + keywords for SPA navigation (crawlers get the same values server-side)
  useEffect(() => {
    if (!p) return undefined;
    document.title = full?.metaTitle || `${p.name} | AR Trade International`;
    const set = (n, v) => { if (!v) return; let m = document.head.querySelector(`meta[name="${n}"]`); if (!m) { m = document.createElement('meta'); m.name = n; document.head.appendChild(m); } m.content = v; };
    set('description', full?.metaDesc); set('keywords', full?.metaKeywords);
    return () => { document.title = 'AR Trade International'; };
  }, [p, full]);
  // show the sticky buy bar once the main buy box has scrolled out of view
  useEffect(() => {
    const el = buyRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setBarOn(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [id, p]);
  // offer rail loops endlessly (items are listed twice): it drifts left continuously and wraps round with no jump,
  // pausing while hovered/touched or when the tab is hidden
  const pausedRef = useRef(false);
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
  }, [id, p]);
  // start the "How to order" animation only once the block scrolls into view
  useEffect(() => {
    setHowIn(false);
    const el = howRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setHowIn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [id, p]);
  // the address holds words (hp-05a-…); the server's detail and review routes are keyed by the product's number
  const pid = p?.id;
  useEffect(() => {
    setFull(null);
    if (!pid) return undefined;
    let live = true;
    api.get('/products/' + pid).then(d => { if (live) setFull(d); }).catch(() => { if (live) setFull(null); });
    return () => { live = false; };
  }, [pid]);
  const loadRv = () => (pid ? api.get(`/products/${pid}/reviews`).then(setRv).catch(() => setRv(null)) : null);
  useEffect(() => {
    setRv(null);
    if (!pid) return undefined;
    let live = true;
    api.get(`/products/${pid}/reviews`).then(d => { if (live) setRv(d); }).catch(() => { if (live) setRv(null); });
    return () => { live = false; };
  }, [pid, user?.id]);
  if (!p) return <NotFound />;
  const photos = full && full.gallery && full.gallery.length > 1 ? full.gallery : null;
  const views = photos
    ? photos.map((u, i) => ({ k: 'Photo ' + (i + 1), s: 1, o: '50% 50%', img: u }))
    : [{ k: 'Front', s: 1, o: '50% 50%' }, { k: 'Close-up', s: 1.5, o: '50% 50%' }, { k: 'Top detail', s: 1.8, o: '28% 28%' }, { k: 'Base detail', s: 1.8, o: '72% 75%' }];
  const cur = views[Math.min(view, views.length - 1)];
  const curImg = cur.img || p.img;
  const step = d => setView(v => (v + d + views.length) % views.length);

  const cat = cats.find(c => c.id === p.cat);
  const off = offPct(p);
  const buyable = !!p.price && p.stock > 0;
  const rows = specs(p).concat(((full && full.specs) || []).filter(x => !specs(p).some(r => r[0].toLowerCase() === x.name.toLowerCase())).map(x => [x.name, x.value]));
  const sib = products.filter(x => x.cat === p.cat);
  const si = Math.max(0, sib.findIndex(x => x.id === p.id));
  const prev = sib[(si - 1 + sib.length) % sib.length], next = sib[(si + 1) % sib.length];
  const offers = products.filter(x => x.id !== p.id && x.old && x.price && x.old > x.price).slice(0, 6);
  const works = String(p.compat || '').split(/,\s*/).map(s => s.trim()).filter(Boolean);
  const url = encodeURIComponent(window.location.href), tt = encodeURIComponent(p.name);
  const wa = waLink(site, 'Hi, I want to order: ' + p.name);
  const low = p.stock > 0 && p.stock <= 5;
  const stockTone = p.stock <= 0 ? 'oklch(0.55 0.02 260)' : low ? 'oklch(0.55 0.2 350)' : 'oklch(0.5 0.15 150)';
  const stockText = p.stock <= 0 ? 'Out of stock' : low ? `Only ${p.stock} left — order soon` : 'In stock · ready to ship';
  const shares = [['f', '#1877f2', 'https://www.facebook.com/sharer/sharer.php?u=' + url], ['X', '#0f1419', `https://twitter.com/intent/tweet?url=${url}&text=${tt}`], ['in', '#0a66c2', 'https://www.linkedin.com/sharing/share-offsite/?url=' + url], ['W', '#25d366', `https://wa.me/?text=${tt}%20${url}`], ['@', '#5d6270', `mailto:?subject=${tt}&body=${url}`]];

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <section className="pdp2">
      <div className="crumbs" style={{ marginBottom: 18 }}><Link to="/">Home</Link><span>/</span>{cat && <Link to={'/shop/' + cat.id}>{cat.t}</Link>}<span>/</span><span style={{ color: '#16181d' }}>{p.name}</span></div>

      <div className="pdp2-grid">
        <div className="pdp2-gal">
          <div className="gal-row">
          {p.img && (
            <div className="thumbs">
              {views.map((v, i) => (
                <button key={v.k} type="button" className={i === view ? 'on' : ''} onClick={() => setView(i)} title={v.k}>
                  <span style={{ backgroundImage: `url('${v.img || p.img}')`, backgroundSize: v.img ? 'contain' : `${v.s * 100}%`, backgroundPosition: v.img ? 'center' : v.o }} /><em>{v.k}</em>
                </button>
              ))}
            </div>
          )}
          <div className={'stage' + (zoom ? ' zoom' : '')} onMouseMove={onMove} onMouseLeave={() => setZoom(null)} onClick={() => p.img && setBox(true)}>
            <span className="ring" />
            {p.img ? <div className="img" role="img" aria-label={p.name} style={{ backgroundImage: `url('${curImg}')`, transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : cur.o, ...(view || zoom ? { animation: 'none', transform: `scale(${zoom ? cur.s * 1.7 : cur.s})` } : null) }} /> : <div className="ph">{p.brand}</div>}
            <div className="tl">{off > 0 && <span className="off">−{off}%</span>}{p.isNew && <span className="newb">NEW</span>}</div>
            <span className="br">{p.brand}</span>
            <span className="st" style={{ color: stockTone }}><i />{stockText}</span>
            <span className="hint">⌕ Hover to zoom · click to expand</span>
            {p.img && <>
              <button type="button" className="sbtn exp" title="Full-screen view" onClick={e => { e.stopPropagation(); setBox(true); }}>⤢</button>
              <button type="button" className="sbtn pv" title="Previous view" onClick={e => { e.stopPropagation(); step(-1); }}>‹</button>
              <button type="button" className="sbtn nx" title="Next view" onClick={e => { e.stopPropagation(); step(1); }}>›</button>
              <span className="count">{view + 1} / {views.length}</span>
            </>}
          </div>
          </div>
          <div className="trust">
            <div><i>✓</i><span><b>100% genuine</b><span>Original, warranty backed</span></span></div>
            <div><i>⚡</i><span><b>Fast delivery</b><span>Same-day in Dhaka</span></span></div>
            <div><i>↺</i><span><b>7-day returns</b><span>Faulty items replaced</span></span></div>
          </div>
        </div>

        <div className="pdp2-info">
          <div className="pd-top">
            <div className="pd-tags"><span className="pd-tag">{cat ? cat.t : 'Shop'}</span><span className="mono" style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a8f9b' }}>SKU · {p.id}</span></div>
            <div className="pd-nav"><Link to={productPath(prev)} title="Previous product" aria-label="Previous product">‹</Link><Link to={productPath(next)} title="Next product" aria-label="Next product">›</Link></div>
          </div>
          <h1>{p.name}</h1>
          <div className="pd-rate"><a href="#reviews" className="rate-link"><Stars value={rv ? rv.avg : 0} size={15} /><b>{rv && rv.count ? rv.avg.toFixed(1) : ''}</b><span>{rv && rv.count ? `(${rv.count} review${rv.count > 1 ? 's' : ''})` : 'No reviews yet'}</span></a><span>Genuine product · Official warranty</span><span className="chip2">✓ Cash on delivery</span></div>

          <div className="pd-price">
            <div className="row">
              <b>{p.price ? fmt(p.price) : 'On request'}</b>
              {off > 0 && <><s>{fmt(p.old)}</s><span className="save">Save {fmt(p.old - p.price)} · {off}% off</span></>}
            </div>
            <div className="note"><span>Prices include VAT</span><span>•</span><span>{site.insideFee ? fmt(site.insideFee) : 'Free'} delivery inside Dhaka{site.freeOver ? ` (free over ${fmt(site.freeOver)})` : ''}</span></div>
          </div>

          {p.stock > 0 && (
            <div className="meter">
              <div className="bar"><i style={{ width: Math.max(8, Math.min(100, p.stock / 20 * 100)) + '%', background: low ? 'linear-gradient(90deg,oklch(0.7 0.18 40),oklch(0.58 0.22 350))' : 'linear-gradient(90deg,oklch(0.72 0.15 160),oklch(0.55 0.15 150))' }} /></div>
              <span style={{ color: stockTone }}>{stockText}</span>
            </div>
          )}

          <div className="hl">
            <div className="hl-hd"><b>Key specifications</b><span>{rows.length - 1} details</span></div>
            {rows.slice(0, 6).map(([k, v]) => <div className="hl-row" key={k}><small>{k}</small><b>{v}</b></div>)}
          </div>

          {works.length > 1 && (
            <div className="works"><span>Works with</span><div>{works.map(w => <em key={w}>{w}</em>)}</div></div>
          )}

          <div className="buybox" ref={buyRef}>
            {buyable ? (
              <div className="line">
                <div className="qty3"><button type="button" aria-label="Decrease quantity" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button><span>{qty}</span><button type="button" aria-label="Increase quantity" onClick={() => setQty(q => Math.min(q + 1, p.stock))}>+</button></div>
                <button className="cta add" onClick={() => addToCart(p, qty)}><span className="ic"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg></span>Add to cart</button>
                <button className="cta buy" onClick={() => { addToCart(p, qty); nav('/checkout'); }}>Buy now <span className="ar">→</span></button>
                <button className={'sqbtn' + (wish.includes(p.id) ? ' on' : '')} title="Wishlist" aria-label="Wishlist" onClick={() => toggleWish(p.id)}>{wish.includes(p.id) ? '♥' : '♡'}</button>
                <button className={'sqbtn' + (compare.includes(p.id) ? ' on' : '')} style={compare.includes(p.id) ? { color: '#fff', background: 'var(--navy)', borderColor: 'var(--navy)' } : undefined} title="Compare" aria-label="Compare" onClick={() => toggleCompare(p.id)}>⇄</button>
              </div>
            ) : (
              <a href={wa} target="_blank" rel="noreferrer" className="cta buy" style={{ display: 'grid', placeItems: 'center' }}>{p.price ? 'Out of stock — notify me on WhatsApp' : 'Call for price — ask on WhatsApp'}</a>
            )}
            <div className="contacts2">
              <a href="tel:+8801977554401"><i><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 5.3 5.3l1.4-2.2L19 14.5V18a2 2 0 0 1-2 2A14 14 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg></i><span><small>Hotline</small>+8801977554401-02</span></a>
              <div><i><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 7.5h8M8 12h2M12 12h2M8 16h2M12 16h2"/></svg></i><span><small>Landline (TNT)</small>+8802-58317706-07</span></div>
              <a className="wa2" href={wa} target="_blank" rel="noreferrer"><i><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1.2-4.1A8 8 0 1 1 8.2 19z"/><path d="M9.2 8.8c.3 2.4 2.6 4.7 5 5l1.1-1.2-1.9-1-.8.7a3.6 3.6 0 0 1-1.6-1.6l.7-.8-1-1.9z"/></svg></i><span><small>WhatsApp</small>Order now →</span></a>
            </div>
          </div>

          <div className="deliv">
            <div><i>🚚</i><span><b>Inside Dhaka</b><span>Order before 2 PM for same-day delivery · cash on delivery</span></span></div>
            <div><i>📦</i><span><b>Outside Dhaka</b><span>Courier in 1–3 working days · {fmt(site.outsideFee)}</span></span></div>
          </div>

          <div className="perks3">
            {[['৳', 'Free cash on delivery', 'Pay when it arrives in Dhaka', 150], ['✓', 'Satisfaction guarantee', 'Genuine, warranty-backed stock', 250], ['5%', 'Online order discount', '5% off, applied at checkout', 30]].map(([i, t, d, h]) => (
              <div key={t} style={{ '--h': h }}><i>{i}</i><b>{t}</b><span>{d}</span></div>
            ))}
          </div>
          {offers.length > 0 && (
            <div className="pd-offers">
              <div className="sec-hd" style={{ marginBottom: 12 }}><h2 style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>Offer products</h2><div className="rail-nav"><button type="button" aria-label="Scroll left" onClick={() => railRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}>‹</button><button type="button" aria-label="Scroll right" onClick={() => railRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}>›</button><Link to="/offers" className="ac-link">All offers →</Link></div></div>
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
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7a8296' }}>Share</span>
            <div style={{ display: 'flex', gap: 6 }}>{shares.map(([i, bg, href]) => <a key={i} className="share" href={href} target="_blank" rel="noreferrer" aria-label={'Share via ' + NAMES[i]} style={{ background: bg }}>{i}</a>)}</div>
          </div>
        </div>
      </div>


      <div className="pd-lower">
        <div className="pd-left">
        <div className="ptabs2">
          <div className="bar2">{[...(full && (full.description || full.short) ? [['desc', 'Description']] : []), ['spec', 'Specification'], ['ship', 'Delivery & warranty']].map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div className="body" key={tab}>
            {tab === 'desc' && full && <div className="bp-body pd-desc" dangerouslySetInnerHTML={{ __html: cleanHtml((full.short && !(full.description || '').includes(full.short.slice(0, 40)) ? full.short : '') + (full.description || '')) }} />}
            {tab === 'spec' && (
              <>
                <div className="spec2">{rows.map(([k, v]) => <div key={k} className={String(v).length > 34 ? 'wide' : undefined}><i>{SPEC_ICON[k] || '•'}</i><span><small>{k}</small><b>{v}</b></span></div>)}</div>
                <div className="spec-note"><i>i</i>Please confirm your existing toner model matches before ordering.</div>
              </>
            )}
            {tab === 'ship' && (
              <div className="dw">
                <section className="dw-card">
                  <header><h3>Delivery options</h3><span>Cash on delivery available</span></header>
                  <table>
                    <thead><tr><th>Destination</th><th>Delivery time</th><th>Fee</th></tr></thead>
                    <tbody>
                      <tr><td><b>Inside Dhaka</b><small>Order before 2 PM for same-day</small></td><td>Same day</td><td>{site.insideFee ? fmt(site.insideFee) : <em className="free">FREE</em>}{site.freeOver ? <small>Free over {fmt(site.freeOver)}</small> : null}</td></tr>
                      <tr><td><b>Outside Dhaka</b><small>Courier, on condition</small></td><td>1–3 working days</td><td>{fmt(site.outsideFee)}</td></tr>
                    </tbody>
                  </table>
                  <ol className="dw-track">
                    {['Order placed', 'Confirmation call', 'Packed & dispatched', 'Delivered'].map((t, i) => <li key={t}><i>{i + 1}</i><span>{t}</span></li>)}
                  </ol>
                </section>
                <section className="dw-card">
                  <header><h3>Warranty &amp; returns</h3><span>100% original products</span></header>
                  <div className="dw-cols">
                    <div><h4 className="ok">Covered</h4><ul><li>Manufacturer defects</li><li>Warranty per manufacturer &amp; BCS policy</li><li>Genuine, sealed original stock</li></ul></div>
                    <div><h4 className="no">Not covered</h4><ul><li>Physical damage</li><li>Water damage</li><li>Burn damage</li></ul></div>
                  </div>
                  <div className="dw-foot"><i>i</i>Prices of tech products may change without notice due to market volatility.</div>
                </section>
              </div>
            )}
          </div>
        </div>
        <Reviews pid={p.id} data={rv} user={user} onLogin={() => setLoginOpen(true)} onSubmitted={loadRv} />
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-.025em', margin: 0 }}>Related products</h2>
            <div className="rel-grid">{products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4).map(x => <ProductCard key={x.id} p={x} />)}</div>
          </div>
        <BestSellers exclude={p.id} />
        </div>
      <aside className={'howblock' + (howIn ? ' in' : '')} ref={howRef}>
                  <div className="howto">
          <div className="howto-hd">
            <div>
              <h3><span>🛒</span>কিভাবে অর্ডার করবেন</h3>
              <p><b>মাত্র কয়েকটি স্টেপ ফলো করে খুব সহজেই আপনি আমাদের সাইটে অনলাইনে অর্ডার করতে পারেন।</b></p>
            </div>
            <div className="howto-side">
              <span className="hl-off"><b>অনলাইনে অর্ডার করলেই পাচ্ছেন ৫০০ টাকা ছাড় সহ নানা অফার।</b></span>
              <a className="howto-call" href="tel:+8801977554401"><span>☎</span><small>বিস্তারিত জানার জন্য আজই ফোন করুন</small><b>০১৯৭৭৫৫৪৪০১-০৭</b></a>
            </div>
          </div>
          <ol className="howto-steps">
            {HOW.map((t, i) => (
              <li key={i} data-n={i + 1} style={{ '--r': `${i * 2 + 1} / span 4` }}>
                <img src={`/api/uploads/site/how-step-${i + 1}.png`} alt={`Step ${i + 1}: ${t}`} loading="lazy" />
              </li>
            ))}
            <li className="done" style={{ '--r': `${(HOW.length - 1) * 2 + 5}` }}><div className="fin"><i>✓</i><b>অর্ডার সম্পন্ন!</b><span>আমরা ফোন করে কনফার্ম করব এবং দ্রুত ডেলিভারি দেব।</span></div></li>
          </ol>
        </div>
      </aside>
      </div>


      {box && p.img && createPortal(<Lightbox img={curImg} name={p.name} views={views} start={view} onClose={() => setBox(false)} onView={setView} />, document.body)}
      {buyable && createPortal(
        <div className={'sticky-buy' + (barOn ? ' on' : '')} aria-hidden={!barOn}>
          <div className="in">
            <span className="th" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }} />
            <div className="nm"><b>{p.name}</b><span>{stockText}</span></div>
            <span className="pr">{fmt(p.price)}</span>
            <button className="cta add" onClick={() => addToCart(p, qty)}>Add to cart</button>
          </div>
        </div>, document.body
      )}
    </section>
  );
}
