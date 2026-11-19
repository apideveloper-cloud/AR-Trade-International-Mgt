import { Link } from 'react-router-dom';
import './header-extra.css';

/** One top-nav entry with its hover/click dropdown of links. */
export default function NavDropdown({ m, open, active, onEnter, onToggle, close }) {
  return (
    <div className="hdx-item" onMouseEnter={onEnter}>
      <button className={'nav-a' + (open ? ' open' : '') + (active ? ' on' : '')} onClick={onToggle}>
        {m.t}<span className="chev">▼</span>
      </button>
      {open && m.items && (
        <div className="drop">
          <span className="arrow" />
          <div className="drop-box">
            <div className="drop-hd"><b>{m.title || m.t}</b><span>{m.items.length} links</span></div>
            <div className="drop-list">
              {m.items.map(it => it.href
                ? <a key={it.t} href={it.href} target="_blank" rel="noreferrer" onClick={close}><span className="gl">›</span><span>{it.t}</span><em>{it.mark}</em></a>
                : <Link key={it.t} to={it.to} onClick={close}><span className="gl">›</span><span>{it.t}</span></Link>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
