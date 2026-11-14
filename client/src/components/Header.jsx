import LiveSearch from './LiveSearch.jsx';
import { useEffect, useRef, useState } from 'react';
import { productPath } from '../slug.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fmt } from '../api.js';
import { MEGA, MENUS } from '../data.js';
import Brand from './Brand.jsx';
import { useStore } from '../store.jsx';

const WORDS_HOLD = 'Type a model or part no.…';

function useTypewriter(words, ref) {
  useEffect(() => {
    const list = words.filter(Boolean);
    if (!list.length) return undefined;
    let w = 0, i = 0, del = false, hold = 0;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      if (el.value || document.activeElement === el) { if (el.placeholder !== WORDS_HOLD) el.placeholder = WORDS_HOLD; return; }
      if (hold > 0) { hold--; return; }
      const s = list[w];
      if (!del) { i++; if (i >= s.length) { del = true; hold = 22; } }
      else { i -= 2; if (i <= 0) { i = 0; del = false; w = (w + 1) % list.length; hold = 4; } }
      el.placeholder = s.slice(0, Math.max(0, i)) + (del && hold ? '' : '|');
    }, 70);
    return () => clearInterval(t);
  }, [words, ref]);
}

export default function Header() {
  const { site, cats, products, content, user, setLoginOpen, setCartOpen, cartCount, cartSubtotal } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(null);
  const [megaG, setMegaG] = useState(0);
  const [mob, setMob] = useState(false);
  const searchRef = useRef(null);
  useTypewriter(content.words, searchRef);
  useEffect(() => { setMenu(null); setMob(false); }, [loc.pathname]);
  useEffect(() => {
    if (!mob) return undefined;
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const k = e => { if (e.key === 'Escape') setMob(false); };
    window.addEventListener('keydown', k);
    return () => { document.body.style.overflow = o; window.removeEventListener('keydown', k); };
  }, [mob]);
  useEffect(() => { if (loc.pathname === '/shop/all' || loc.pathname.startsWith('/shop')) setQ(new URLSearchParams(loc.search).get('q') || ''); }, [loc.pathname, loc.search]);

  const submit = e => { e.preventDefault(); nav('/shop/all?q=' + encodeURIComponent(q.trim())); };
  const sh = (c, qq) => `/shop/${c}${qq ? '?q=' + encodeURIComponent(qq) : ''}`;

  const groups = MEGA.map(g => {
    const pr = products.filter(p => p.cat === g.c);
    return { ...g, n: pr.length, img: pr.find(p => p.img)?.img || '', picks: pr.filter(p => p.img).slice(0, 3) };
  });
  const cur = groups[megaG] || groups[0];
  // dropdowns for the main categories: everything, then the five biggest brands with product counts
  const menus = MENUS.map(m => {
    if (m.k && content.menus && Array.isArray(content.menus[m.k]) && content.menus[m.k].length) return { ...m, items: content.menus[m.k] };
    if (!m.cat) return m;
    const pr = products.filter(p => p.cat === m.cat);
    const brands = {};
    pr.forEach(p => { brands[p.brand] = (brands[p.brand] || 0) + 1; });
    const top = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const title = (cats.find(c => c.id === m.cat) || {}).t || m.t;
    return { ...m, title, items: [{ t: `All ${title} (${pr.length})`, to: '/shop/' + m.cat }, ...top.map(([b, n]) => ({ t: `${b} (${n})`, to: sh(m.cat, b) }))] };
  });
  const first = user ? String(user.name || '').split(' ')[0] : null;

  return (
    <>
      {site.showPromo && <div className="promo"><div><span>{site.promo}</span><i>◆</i><span>{site.promo}</span><i>◆</i></div></div>}
      <header className="hdr">
        <div className="hdr-top">
          <Brand size={68} className="logo" />
          <LiveSearch q={q} setQ={setQ} onSubmit={submit} inputRef={searchRef} placeholder={content.words[0]} />
          <div className="hd-right">
            <a href="tel:+8801977554401" className="chip hide-md">
              <span className="ic">☏</span>
              <span className="tx"><small>Hotline · WhatsApp</small><b>{site.phone}</b></span>
            </a>
            {user ? (
              <Link to="/account" className="chip">
                <span className="ic fill">{String(user.name || '?')[0].toUpperCase()}</span>
                <span className="tx"><small>Hello,</small><b>{first}</b></span>
              </Link>
            ) : (
              <button className="chip" onClick={() => setLoginOpen(true)}>
                <span className="ic">◯</span>
                <span className="tx"><small>Sign in</small><b>My account</b></span>
              </button>
            )}
          </div>
        </div>
        <div className="nav" onMouseLeave={() => setMenu(null)}>
          <nav className="nav-in">
            <button type="button" className="nav-burger" onClick={() => setMob(true)} aria-label="Open menu" aria-expanded={mob}><span className="burger"><span /><span /><span /></span>Menu</button>
            <div className="nav-l">
              <button className="nav-all hide-md" onClick={() => setMenu(m => (m === 'all' ? null : 'all'))} onMouseEnter={() => setMenu('all')}>
                <span className="burger"><span /><span /><span /></span>All categories
              </button>
              {menus.map((m, i) => {
                const open = menu === i;
                const active = m.path && loc.pathname.startsWith(m.path);
                return (
                  <div key={m.t} style={{ position: 'relative' }} onMouseEnter={() => setMenu(m.mega || m.items ? i : null)}>
                    <button className={'nav-a' + (open ? ' open' : '') + (active ? ' on' : '')} onClick={() => setMenu(open ? null : i)}>
                      {m.t}<span className="chev">▼</span>
                    </button>
                    {open && m.items && (
                      <div className="drop">
                        <span className="arrow" />
                        <div className="drop-box">
                          <div className="drop-hd"><b>{m.title || m.t}</b><span>{m.items.length} links</span></div>
                          <div className="drop-list">
                            {m.items.map(it => it.href
                              ? <a key={it.t} href={it.href} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}><span className="gl">›</span><span>{it.t}</span><em>{it.mark}</em></a>
                              : <Link key={it.t} to={it.to} onClick={() => setMenu(null)}><span className="gl">›</span><span>{it.t}</span></Link>)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Link to="/offers" className="buy-pill hide-md">Buy Product!<b>OFFER</b></Link>
            <Link to="/contact" className="contact-pill"><span>☏</span>Contact Us</Link>
          </nav>
          {menu === 'all' && (
            <div className="mega" style={{ left: 28, right: 28 }}>
              <div className="mega-box">
                <div className="mega-l">
                  {groups.map((g, gi) => (
                    <Link key={g.t} to={sh(g.c)} className={gi === megaG ? 'on' : ''} onMouseEnter={() => setMegaG(gi)} onClick={() => setMenu(null)}>
                      <span className="th">{g.img ? <img src={g.img} alt="" /> : g.t.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <span className="nm">{g.t}</span><span style={{ opacity: gi === megaG ? 1 : 0 }}>›</span>
                    </Link>
                  ))}
                </div>
                <div className="mega-m">
                  <div className="top">
                    <div><b>{cur.t}</b><small>{cur.n} products in store</small></div>
                    <Link to={sh(cur.c)} onClick={() => setMenu(null)}>View all →</Link>
                  </div>
                  <div className="mega-links">
                    {cur.items.map(([t, qq]) => <Link key={t} to={sh(cur.c, qq)} onClick={() => setMenu(null)}>{t}<span>→</span></Link>)}
                  </div>
                  <div className="mega-picks">
                    {cur.picks.map(p => (
                      <Link key={p.id} to={productPath(p)} onClick={() => setMenu(null)}>
                        <span className="im"><img src={p.img} alt="" /></span>
                        <span className="n clamp2">{p.name}</span><b>{p.price ? fmt(p.price) : 'Ask price'}</b>
                      </Link>
                    ))}
                  </div>
                </div>
                <Link to="/offers" className="mega-hot" onClick={() => setMenu(null)}>
                  <span className="glow" />
                  <span className="k">Hot sale</span>
                  <span className="t">Original laser toner at reduced prices</span>
                  <span className="d">Cash on delivery in Dhaka. Courier delivery nationwide.</span>
                  <span className="im"><img src="/api/uploads/site/hp-79a-black-toner.jpg" alt="" /></span>
                  <span className="go">See offers →</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>
      {mob && (
        <div className="m-scrim" onClick={() => setMob(false)}>
          <aside className="m-drawer" role="dialog" aria-label="Menu" onClick={e => e.stopPropagation()}>
            <div className="m-hd"><b>Menu</b><button type="button" onClick={() => setMob(false)} aria-label="Close menu">✕</button></div>
            <nav className="m-list">
              <Link to="/" onClick={() => setMob(false)}>Home</Link>
              {menus.map(m => (
                <details key={m.t}>
                  <summary>{m.t}<span>▼</span></summary>
                  <div>
                    {(m.items || []).map(it => it.href
                      ? <a key={it.t} href={it.href} target="_blank" rel="noreferrer" onClick={() => setMob(false)}>{it.t}</a>
                      : <Link key={it.t} to={it.to} onClick={() => setMob(false)}>{it.t}</Link>)}
                  </div>
                </details>
              ))}
              <details>
                <summary>All categories<span>▼</span></summary>
                <div>{groups.map(g => <Link key={g.t} to={sh(g.c)} onClick={() => setMob(false)}>{g.t} ({g.n})</Link>)}</div>
              </details>
              <Link to="/offers" className="m-hot" onClick={() => setMob(false)}>Buy Product! <b>OFFER</b></Link>
              <Link to="/contact" onClick={() => setMob(false)}>Contact Us</Link>
              <a href="tel:+8801977554401" className="m-call">☏ {site.phone}</a>
            </nav>
          </aside>
        </div>
      )}
      <button className="fab-cart" onClick={() => setCartOpen(o => !o)} title="Cart" aria-label="Cart">
        <span className="ic">⌂<b>{cartCount}</b></span><small>Cart</small><span>{fmt(cartSubtotal)}</span>
      </button>
    </>
  );
}
