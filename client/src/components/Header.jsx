import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fmt } from '../api.js';
import { useStore } from '../store.jsx';
import LiveSearch from './LiveSearch.jsx';
import Brand from './Brand.jsx';
import MegaMenu from './header/MegaMenu.jsx';
import MobileDrawer from './header/MobileDrawer.jsx';
import NavDropdown from './header/NavDropdown.jsx';
import useTypewriter from './header/useTypewriter.js';
import { buildGroups, buildMenus } from './header/useMenus.js';

/** Site header: promo strip, search, account chip, category nav, mega menu, mobile drawer and floating cart. */
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
  useEffect(() => { if (loc.pathname.startsWith('/shop')) setQ(new URLSearchParams(loc.search).get('q') || ''); }, [loc.pathname, loc.search]);

  const submit = e => { e.preventDefault(); nav('/shop/all?q=' + encodeURIComponent(q.trim())); };
  const closeMenu = () => setMenu(null);
  const closeMobile = () => setMob(false);

  const groups = buildGroups(products);
  const menus = buildMenus(products, cats, content);
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
        <div className="nav" onMouseLeave={closeMenu}>
          <nav className="nav-in">
            <button type="button" className="nav-burger" onClick={() => setMob(true)} aria-label="Open menu" aria-expanded={mob}><span className="burger"><span /><span /><span /></span>Menu</button>
            <div className="nav-l">
              <button className="nav-all hide-md" onClick={() => setMenu(m => (m === 'all' ? null : 'all'))} onMouseEnter={() => setMenu('all')}>
                <span className="burger"><span /><span /><span /></span>All categories
              </button>
              {menus.map((m, i) => (
                <NavDropdown
                  key={m.t}
                  m={m}
                  open={menu === i}
                  active={m.path && loc.pathname.startsWith(m.path)}
                  onEnter={() => setMenu(m.mega || m.items ? i : null)}
                  onToggle={() => setMenu(menu === i ? null : i)}
                  close={closeMenu}
                />
              ))}
            </div>
            <Link to="/offers" className="buy-pill hide-md">Buy Product!<b>OFFER</b></Link>
            <Link to="/contact" className="contact-pill"><span>☏</span>Contact Us</Link>
          </nav>
          {menu === 'all' && <MegaMenu groups={groups} active={megaG} setActive={setMegaG} close={closeMenu} />}
        </div>
      </header>
      {mob && <MobileDrawer menus={menus} groups={groups} phone={site.phone} close={closeMobile} />}
      <button className="fab-cart" onClick={() => setCartOpen(o => !o)} title="Cart" aria-label="Cart">
        <span className="ic">⌂<b>{cartCount}</b></span><small>Cart</small><span>{fmt(cartSubtotal)}</span>
      </button>
    </>
  );
}
