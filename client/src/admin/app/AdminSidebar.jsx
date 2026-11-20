import { Link } from 'react-router-dom';
import { NavIcon } from '../navIcons.jsx';
import { useT } from '../i18n/lang.jsx';

/** Arrow keys walk the menu, Left / Right fold / unfold a group, Home / End jump to the ends. */
function navKeys(e) {
  const items = [...e.currentTarget.querySelectorAll('.nav-g, .nav-grp:not(.shut) .nav-items a')];
  const i = items.indexOf(document.activeElement);
  if (i < 0) return;
  const move = n => { e.preventDefault(); items[(n + items.length) % items.length]?.focus(); };
  if (e.key === 'ArrowDown') move(i + 1);
  else if (e.key === 'ArrowUp') move(i - 1);
  else if (e.key === 'Home') move(0);
  else if (e.key === 'End') move(items.length - 1);
  else if (e.key === 'ArrowRight' && items[i].classList.contains('nav-g') && items[i].getAttribute('aria-expanded') === 'false') { e.preventDefault(); items[i].click(); }
  else if (e.key === 'ArrowLeft') {
    const head = items[i].classList.contains('nav-g') ? items[i] : items[i].closest('.nav-grp')?.querySelector('.nav-g');
    if (head && items[i].classList.contains('nav-g') && head.getAttribute('aria-expanded') === 'true') { e.preventDefault(); head.click(); } else if (head) { e.preventDefault(); head.focus(); }
  }
}

/** Left side: brand, hamburger, and the drawer holding the search box and the accordion menu. `shown` is the permitted, search-filtered [group, items] list. */
export function AdminSidebar({ shown, menu, page, go }) {
  const tr = useT();
  const { menuQ, setMenuQ, openG, setOpenG, menuOpen, setMenuOpen } = menu;
  const mq = menuQ.trim().toLowerCase();
  return (
    <aside className={'adm-side' + (menuOpen ? ' open' : '')}>
      <div className="adm-brand logo"><img src="/admin-logo-light.png" alt="AR Trade International" /><small>{tr('Admin console')}</small></div>
      <button type="button" className="adm-burger" aria-label={menuOpen ? tr('Close the menu') : tr('Open the menu')} aria-expanded={menuOpen} aria-controls="adm-drawer" onClick={() => setMenuOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {menuOpen && <div className="adm-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="adm-drawer" id="adm-drawer" {...(menuOpen ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': tr('Menu') } : {})}>
        <div className="adm-drawer-hd"><b>{tr('Menu')}</b><button type="button" onClick={() => setMenuOpen(false)} aria-label={tr('Close the menu')}>✕</button></div>
        <div className="nav-search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={menuQ} placeholder={tr('Search menu…')} aria-label={tr('Search the menu')} onChange={e => setMenuQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setMenuQ(''); if (e.key === 'Enter' && shown[0]) { go(shown[0][1][0][0]); setMenuQ(''); } }} />
          {menuQ && <button type="button" onClick={() => setMenuQ('')} aria-label={tr('Clear the search')}>✕</button>}
        </div>
        <nav className="adm-nav" aria-label={tr('Admin menu')} onKeyDown={navKeys}>
          {!shown.length && <span className="nav-none">{tr('No menu item matches “{q}”.', { q: menuQ })}</span>}
          {shown.map(([g, items], gi) => {
            const here = items.some(i => i[0] === page);
            const open = mq ? true : openG === g;
            const id = 'nav-g-' + gi;
            return (
              <div key={g} className={'nav-grp' + (open ? '' : ' shut')}>
                <button type="button" className="nav-g" id={id + '-h'} aria-expanded={open} aria-controls={id} onClick={() => !mq && setOpenG(open ? '' : g)} title={open ? tr('Fold this group') : tr('Open this group')}>
                  <span>{tr(g)}</span>{!open && here && <i className="dot" />}<em>{items.length}</em>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <div className="nav-items-wrap">
                  <div className="nav-items" id={id} role="group" aria-labelledby={id + '-h'}>
                    {items.map(([k, label, ic]) => <Link key={k} to={'/admin/' + k} onClick={() => setMenuOpen(false)} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}><span className="ic"><NavIcon k={k} fallback={ic} /></span><span className="tx">{tr(label)}</span></Link>)}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
