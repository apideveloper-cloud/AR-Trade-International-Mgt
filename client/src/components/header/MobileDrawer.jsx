import { Link } from 'react-router-dom';
import { shopLink } from './useMenus.js';

/** Slide-in mobile menu. `menus` and `groups` come from useMenus, `close` hides the drawer. */
export default function MobileDrawer({ menus, groups, phone, close }) {
  return (
    <div className="m-scrim" onClick={close}>
      <aside className="m-drawer" role="dialog" aria-label="Menu" onClick={e => e.stopPropagation()}>
        <div className="m-hd"><b>Menu</b><button type="button" onClick={close} aria-label="Close menu">✕</button></div>
        <nav className="m-list">
          <Link to="/" onClick={close}>Home</Link>
          {menus.map(m => (
            <details key={m.t}>
              <summary>{m.t}<span>▼</span></summary>
              <div>
                {(m.items || []).map(it => it.href
                  ? <a key={it.t} href={it.href} target="_blank" rel="noreferrer" onClick={close}>{it.t}</a>
                  : <Link key={it.t} to={it.to} onClick={close}>{it.t}</Link>)}
              </div>
            </details>
          ))}
          <details>
            <summary>All categories<span>▼</span></summary>
            <div>{groups.map(g => <Link key={g.t} to={shopLink(g.c)} onClick={close}>{g.t} ({g.n})</Link>)}</div>
          </details>
          <Link to="/offers" className="m-hot" onClick={close}>Buy Product! <b>OFFER</b></Link>
          <Link to="/contact" onClick={close}>Contact Us</Link>
          <a href="tel:+8801977554401" className="m-call">☏ {phone}</a>
        </nav>
      </aside>
    </div>
  );
}
