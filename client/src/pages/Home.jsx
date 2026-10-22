import CategoryRails from '../components/CategoryRails.jsx';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard, { BuyAction } from '../components/ProductCard.jsx';
import { fmt, offPct } from '../api.js';
import { CAT_FALLBACK, CAT_TINT, SVC_IMGS, isPhoto } from '../data.js';
import { useStore } from '../store.jsx';

const to = h => String(h || '/').replace(/^#/, '') || '/';

/** Does this picture load? Local paths are assumed fine; remote ones are probed (5 s), so a dead host never leaves a blank slide. */
function useImgOk(url) {
  const [ok, setOk] = useState(!url || url.startsWith('/') || url.startsWith('./') ? true : null);
  useEffect(() => {
    if (!url || url.startsWith('/') || url.startsWith('./')) { setOk(true); return undefined; }
    let dead = false;
    const im = new Image();
    const t = setTimeout(() => { if (!dead) setOk(false); }, 5000);
    im.onload = () => { if (!dead) { clearTimeout(t); setOk(true); } };
    im.onerror = () => { if (!dead) { clearTimeout(t); setOk(false); } };
    im.src = url;
    return () => { dead = true; clearTimeout(t); };
  }, [url]);
  return ok;
}
/** A good local photo for a slide: the best product of the category the slide links to. */
function useSlidePic(href) {
  const { products } = useStore();
  const cat = (String(href || '').match(/\/shop\/([\w-]+)/) || [])[1];
  const list = products.filter(p => p.img && (!cat || cat === 'all' || p.cat === cat));
  const score = p => (p.price ? 3 : 0) + (p.popular ? 2 : 0) + (p.old > p.price ? 1 : 0);
  return (list.sort((a, b) => score(b) - score(a))[0] || products.find(p => p.img) || {}).img || '';
}

function ImageSlide({ s }) {
  const src = s.img.startsWith('./') ? s.img.slice(1).replace(/^\/assets\//, '/') : s.img;
  const ok = useImgOk(src);
  const pic = useSlidePic(s.href);
  if (ok === false) {
    return (
      <div className="slide-d">
        <span className="orb" />
        <div className="col"><span className="tag">AR Trade</span><h1>{s.alt}</h1><p>Original products, cash on delivery across Bangladesh.</p><div className="ctas"><Link to={to(s.href)}>Shop now →</Link></div></div>
        <div className="pic"><div className="card"><div style={{ backgroundImage: `url('${pic}')` }} /></div></div>
      </div>
    );
  }
  return <Link to={to(s.href)} className="slide-img" aria-label={s.alt}><div style={{ backgroundImage: ok ? `url('${src}')` : 'none' }} /></Link>;
}

function PicCard({ s }) {
  const ok = useImgOk(s.pic);
  const local = useSlidePic(s.h1);
  return <div className="card"><div style={{ backgroundImage: `url('${ok === false ? local : s.pic}')` }} /></div>;
}

function Hero() {
  const { content, tk } = useStore();
  const slides = content.slides.filter(s => s.on !== false);
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(null);
  const [tick, setTick] = useState(0);
  const paused = useRef(false);
  const go = n => {
    const k = ((n % slides.length) + slides.length) % slides.length;
    setI(cur => { if (cur !== k) { setPrev(cur); setTick(t => t + 1); } return k; });
  };
  useEffect(() => {
    const t = setInterval(() => { if (!paused.current && !document.hidden) setI(cur => { setPrev(cur); setTick(x => x + 1); return (cur + 1) % slides.length; }); }, (content.slideSecs || 5.5) * 1000);
    return () => clearInterval(t);
  }, [slides.length, content.slideSecs]);

  return (
    <div className="hero" onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
      <div key={tick} className={'sweep' + (tick ? ' go' : '')} />
      {slides.map((s, k) => (
        <div key={k} className={'slide' + (k === i ? ' on' : k === prev ? ' was' : '')} aria-hidden={k !== i}>
          {s.type === 'image' ? (
            <ImageSlide s={s} />
          ) : (
            <div className="slide-d">
              <span className="orb" /><span className="num">{String(k + 1).padStart(2, '0')}</span>
              <div className="col">
                <span className="tag">{tk(s.tag)}</span>
                <h1>{tk(s.title)}</h1>
                <p>{tk(s.sub)}</p>
                <div className="ctas"><Link to={to(s.h1)}>{s.c1} →</Link><Link to={to(s.h2)}>{s.c2}</Link></div>
              </div>
              <div className="pic">
                <PicCard s={s} />
                <span className="badge"><small>{s.badgeT}</small><b>{s.badgeV}</b></span>
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="dots">{slides.map((_, k) => <button key={k} title="Slide" onClick={() => go(k)} style={{ width: k === i ? 26 : 7, background: k === i ? '#fff' : 'rgba(255,255,255,.5)' }} />)}</div>
      <button className="arr prev" title="Previous" onClick={() => go(i - 1)}>←</button>
      <button className="arr next" title="Next" onClick={() => go(i + 1)}>→</button>
    </div>
  );
}

function SectionHead({ kick, title, children }) {
  return (
    <div className="sec-hd">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span className="kicker">{kick}</span><h2 className="h2" style={{ margin: 0 }}>{title}</h2></div>
      {children}
    </div>
  );
}

function Categories() {
  const { cats, products, content } = useStore();
  const L = content.labels;
  const cards = cats.map((c, i) => {
    const items = products.filter(p => p.cat === c.id);
    const own = items.find(p => p.img);
    const img = own ? own.img : CAT_FALLBACK[c.id] || '';
    const photo = !own && isPhoto(c.id);
    const n = items.length, h = CAT_TINT[c.id] || 258;
    return { ...c, n, img, photo, h, countL: n ? n + (n === 1 ? ' PRODUCT' : ' PRODUCTS') : 'CALL FOR STOCK', i };
  });
  const imgStyle = c => ({ inset: c.photo ? 0 : '-6%', backgroundImage: `url('${c.img}')`, backgroundSize: c.photo ? 'cover' : 'contain', mixBlendMode: c.photo ? 'normal' : 'multiply' });
  const top = cards.slice(0, 3), rest = cards.slice(3);
  return (
    <section className="sec">
      <SectionHead kick={L.catKick} title={L.catTitle}><Link to="/shop/all" className="btn" style={{ background: '#0d1220', fontWeight: 700 }}>Browse all products →</Link></SectionHead>
      <div className="cat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {top.map((c, k) => k === 0 ? (
          <Link key={c.id} to={'/shop/' + c.id} className="cat-feat" style={{ gridColumn: 'span 2' }}>
            <span className="glow" />
            <div className="l"><span className="cat-chip">{c.countL}</span><span className="t">{c.t}</span><span className="d">{c.d}</span><span className="shop">Shop now →</span></div>
            <div className="im">{c.img && <i style={{ ...imgStyle(c), inset: '2%', mixBlendMode: 'multiply' }} />}</div>
          </Link>
        ) : (
          <Link key={c.id} to={'/shop/' + c.id} className="cat-tile" style={{ background: `oklch(0.94 0.035 ${c.h})` }}>
            <div className="im">{c.img && <i style={imgStyle(c)} />}<span className="cat-count">{c.countL}</span></div>
            <div className="cat-foot"><div><span className="t">{c.t}</span><span className="d">{c.d}</span></div><span className="cat-arrow">→</span></div>
          </Link>
        ))}
      </div>
      <div className="cat-row">
        {rest.map(c => (
          <Link key={c.id} to={'/shop/' + c.id} className="cat-card">
            <div className="im" style={{ background: `radial-gradient(120% 100% at 50% 0%, #fff 0%, oklch(0.94 0.035 ${c.h}) 100%)` }}>
              {c.img && <i style={imgStyle(c)} />}
              <span className="cat-count" style={{ background: c.n ? 'rgba(255,255,255,.92)' : 'rgba(255,248,232,.95)', color: c.n ? 'oklch(0.45 0.15 248)' : 'oklch(0.52 0.12 65)' }}>{c.countL}</span>
            </div>
            <div className="cat-foot"><div><span className="t">{c.t}</span><span className="d">{c.d}</span></div><span className="cat-arrow">→</span></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Popular() {
  const { products, content } = useStore();
  const L = content.labels;
  const [tab, setTab] = useState('all');
  const rail = useRef(null);
  const paused = useRef(false);
  const list = products.filter(p => p.popular && (tab === 'all' || p.cat === tab)).slice(0, 10);

  useEffect(() => {
    const t = setInterval(() => {
      const el = rail.current;
      if (!el || paused.current || document.hidden || !el.children.length) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      const w = el.children[0].offsetWidth + 14;
      el.scrollTo({ left: atEnd ? 0 : Math.round(el.scrollLeft / w + 1) * w, behavior: 'smooth' });
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const tabs = [['all', 'All'], ['toner', 'Laser toner'], ['copier-toner', 'Copier toner'], ['ink', 'Ink']];
  return (
    <section className="sec">
      <SectionHead kick={L.popKick} title={L.popTitle}>
        <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); rail.current?.scrollTo({ left: 0 }); }}>{l}</button>)}</div>
      </SectionHead>
      <div onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
        <div className="pop-rail" ref={rail}>{list.map(p => <div key={p.id}><ProductCard p={p} /></div>)}</div>
      </div>
    </section>
  );
}

function Offer() {
  const { site, user, setLoginOpen } = useStore();
  const [copied, setCopied] = useState(false);
  const copy = () => { try { navigator.clipboard.writeText(site.coupon); } catch { /* clipboard unavailable */ } setCopied(true); };
  return (
    <section className="sec">
      <div className="offer">
        <span className="glow" /><span className="ring" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span className="pill-k">Cash-back offer · 2026</span>
          <h2>{site.offerTitle}</h2>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, maxWidth: 460, color: '#c3cbe0' }}>{site.offerSub}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <Link to="/offers" className="btn" style={{ background: '#fff', color: '#0b1631', padding: '14px 22px', borderRadius: 12 }}>See all offers →</Link>
            {!user && <button className="btn" onClick={() => setLoginOpen(true)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.3)', padding: '14px 22px', borderRadius: 12, fontWeight: 700 }}>Create account</button>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="ticket">
            <div><small>FIRST ORDER</small><b style={{ color: 'oklch(0.5 0.15 248)' }}>5%</b><span>off when you order online</span></div>
            <div><small>NEXT ORDER</small><b style={{ color: '#0b1631' }}>10%</b><span>off for registered customers</span></div>
          </div>
          <div className="coupon"><div className="c"><small>Use code</small><b>{site.coupon}</b></div><button onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
          <div className="paywith"><span>Pay with</span><span>bKash</span><span>Nagad</span><span>Upay</span><span>Cash on delivery</span></div>
        </div>
      </div>
    </section>
  );
}

function Fresh() {
  const { products, cats, content } = useStore();
  const L = content.labels;
  const [nk, setNk] = useState('all');
  const pool = products.filter(p => p.isNew);
  const tabs = [{ id: 'all', t: 'All new', items: pool }, ...cats.map(c => ({ id: c.id, t: c.t, items: pool.filter(p => p.cat === c.id) })).filter(c => c.items.length)];
  const list = nk === 'all' ? pool : pool.filter(p => p.cat === nk);
  const spot = list[0];
  const off = spot ? offPct(spot) : 0;
  return (
    <section className="sec">
      <SectionHead kick={L.newKick} title={L.newTitle}>
        <Link to={nk === 'all' ? '/shop/all?new=1' : '/shop/' + nk} style={{ fontWeight: 700, fontSize: 14, color: '#0b1631' }}>{L.viewNew}</Link>
      </SectionHead>
      <div className="fresh-tabs">
        {tabs.map(c => (
          <button key={c.id} className={'fresh-tab' + (c.id === nk ? ' on' : '')} onClick={() => setNk(c.id)}>
            <span className="im">{c.items.find(p => p.img) && <img src={c.items.find(p => p.img).img} alt="" />}</span>{c.t}<span className="n">{c.items.length}</span>
          </button>
        ))}
      </div>
      {!list.length && <div className="empty2">No new arrivals in this category yet.</div>}
      {spot && (
        <div className="fresh-grid">
          <div className="spot">
            <span className="glow" />
            <div className="top"><span className="tag">NEW ARRIVAL · {spot.brand}</span>{off > 0 && <span className="save">Save {off}%</span>}</div>
            <Link to={'/product/' + spot.id} className="pic">{spot.img && <img src={spot.img} alt={spot.name} />}</Link>
            <div className="info">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, maxWidth: 420 }}>
                <Link to={'/product/' + spot.id} className="nm">{spot.name}</Link>
                <span style={{ fontSize: 13, color: '#5d6270' }}>{spot.spec}</span>
                <div className="pr"><b>{spot.price ? fmt(spot.price) : 'On request'}</b>{off > 0 && <s>{fmt(spot.old)}</s>}</div>
              </div>
              <BuyAction p={spot} cls="btn" label="+ Add" />
            </div>
          </div>
          <div className="fresh-list">
            {list.slice(1, 5).map(q => {
              const o = offPct(q);
              return (
                <div className="mini-p" key={q.id}>
                  <div className="row">
                    <Link to={'/product/' + q.id} className="th">{q.img && <img src={q.img} alt="" />}{o > 0 && <em>−{o}%</em>}</Link>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span className="brand-k">{q.brand}</span>
                      <Link to={'/product/' + q.id} className="nm clamp2">{q.name}</Link>
                    </div>
                  </div>
                  <div className="foot">
                    <span className="pr"><b>{q.price ? fmt(q.price) : 'On request'}</b>{o > 0 && <s>{fmt(q.old)}</s>}</span>
                    <BuyAction p={q} cls="btn" label="+ Add" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function Services() {
  const { site } = useStore();
  const cards = [
    ['Printer servicing', 'LASER · INKJET · DOT', 'Cleaning, roller & fuser fixes, part replacement for any brand.', site.svcPrices[0].offer],
    ['Photocopier servicing', 'OFFICE CONTRACTS', 'Indoor and outdoor maintenance plans for offices and institutions.', site.svcPrices[1].offer],
    ['Install & networking', 'SETUP', 'Printer installation, sharing and network setup for your team.', site.svcPrices[3].offer]
  ];
  return (
    <section className="sec">
      <div className="svc">
        <span className="grid-bg" />
        <div className="head">
          <div>
            <span className="k">04 · SERVICING &amp; REPAIR</span>
            <h2>We fix what we sell.</h2>
            <p>Trained engineers for every major brand — HP, Canon, Samsung, Epson, Lexmark and Brother. On-site visits across Dhaka or bring it to our Santinagar house.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <div className="free-badge"><b className="big">FREE</b><span><b>Every Saturday</b><span>Laser printer servicing · parts extra</span></span></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to="/services" className="btn" style={{ background: '#fff', color: '#0d1220', borderRadius: 12, padding: '13px 20px' }}>Book a technician →</Link>
              <Link to="/services" className="btn" style={{ border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '13px 20px', fontWeight: 700 }}>See price list</Link>
            </div>
          </div>
        </div>
        <div className="svc-cards">
          {cards.map(([t, tag, d, from], k) => (
            <Link key={t} to="/services" className="svc-card">
              <div className="bg" style={{ backgroundImage: `url('${SVC_IMGS[k]}')` }} /><div className="shade" />
              <span className="tg">{tag}</span>
              <div className="body"><span className="t">{t}</span><span className="d">{d}</span><div className="ft"><span>From <b>{fmt(from)}</b></span><i>→</i></div></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Brands() {
  const { content } = useStore();
  const list = content.brands.filter(b => b.n);
  const row = list.map(b => <Link key={b.n} to={'/shop/all?q=' + encodeURIComponent(b.n)} title={b.n} className="brand-logo"><img src={b.src} alt={b.n} /></Link>);
  return <section className="sec" style={{ paddingTop: 28 }}><div className="brand-marq"><div>{row}{list.map(b => <Link key={b.n + '2'} to={'/shop/all?q=' + encodeURIComponent(b.n)} title={b.n} className="brand-logo"><img src={b.src} alt={b.n} /></Link>)}</div></div></section>;
}

function PriceAlert() {
  const { optIn, subscribed, say } = useStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const submit = async e => {
    e.preventDefault();
    try { await optIn(email, 'Footer newsletter'); setSent(email); } catch (er) { say(er.message); }
  };
  return (
    <section className="sec" style={{ paddingTop: 20, paddingBottom: 0 }}>
      <div className="alert">
        <span className="ring" />
        <div className="l">
          <span className="mail"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg></span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span className="tg">WEEKLY PRICE ALERTS</span>
            <h3>Get toner price drops <span style={{ color: 'oklch(0.5 0.16 252)' }}>before anyone else.</span></h3>
            <span style={{ color: '#56607a', fontSize: 13.5 }}>One email every Friday. Deals, new arrivals, no spam.</span>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          {!sent && !subscribed ? (
            <>
              <form className="sub-form" onSubmit={submit}>
                <input type="email" required placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
                <button type="submit">Subscribe →</button>
              </form>
              <div className="fine"><span>By subscribing you agree to our <Link to="/policy/privacy">privacy policy</Link> ·</span><span>✓ Friday deals</span><span>✓ New arrivals</span><span>✓ Unsubscribe anytime</span></div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#fff', border: '1.5px solid #cfdcef', borderRadius: 18, padding: '14px 18px' }}>
              <b style={{ fontSize: 15, color: '#0b1631' }}>✉ Almost there — check your inbox</b>
              <span style={{ fontSize: 13, color: '#56607a' }}>We sent a confirmation link{sent && <> to <b>{sent}</b></>}. Click it to start receiving deals.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { products, content, addToCart } = useStore();
  const deal = products.find(p => p.featured) || products[0];
  const off = deal ? offPct(deal) : 0;
  const sec = content.sections;
  return (
    <div>
      <section className="hero-row">
        <Hero />
        <div className="hero-side">
          {deal && (
            <div className="deal">
              <div className="row1"><span className="k">Deal of the week</span>{off > 0 && <span className="off">−{off}%</span>}</div>
              <Link to={'/product/' + deal.id} className="pic"><img src={deal.img} alt={deal.name} /></Link>
              <Link to={'/product/' + deal.id}><span className="nm clamp2">{deal.name}</span></Link>
              <div className="foot">
                <span className="pr"><b>{fmt(deal.price)}</b><s>{fmt(deal.old)}</s></span>
                <button className="btn" onClick={() => addToCart(deal)}>+ Add to cart</button>
              </div>
            </div>
          )}
          <div className="mini2">
            <Link to="/shop/copier-toner" className="mini" style={{ background: 'oklch(0.95 0.03 235)', color: '#0b1631' }}>
              <div className="im"><img src="/api/uploads/site/toshiba-5018p-photocopier-toner.jpg" alt="" /></div>
              <b>Copier toner</b><span style={{ color: '#5d6270' }}>Up to 18% off</span>
            </Link>
            <Link to="/shop/printer" className="mini" style={{ background: '#0b1631', color: '#fff' }}>
              <div className="im"><img src="/api/uploads/site/cp1100-01-500x500-1.png" alt="" style={{ transform: 'scale(1.35)' }} /></div>
              <b>New: Pantum</b><span style={{ color: '#b8c2da' }}>From ৳ 20,000</span>
            </Link>
          </div>
        </div>
      </section>
      {sec.perks && (
        <section className="sec" style={{ paddingTop: 16 }}>
          <div className="perks">
            {content.perks.map(p => <div className="perk" key={p.t}><span className="ic">{p.ic}</span><div><b>{p.t}</b><span>{p.d}</span></div></div>)}
          </div>
        </section>
      )}
      {sec.categories && <Categories />}
      {sec.popular && <Popular />}
      <CategoryRails />
      {sec.offer && <Offer />}
      {sec.fresh && <Fresh />}
      {sec.services && <Services />}
      {sec.brands && <Brands />}
      {sec.alert && <PriceAlert />}
    </div>
  );
}
