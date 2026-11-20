import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adm, can } from './adminApi.js';
import { LangSwitch, useT } from './i18n/lang.jsx';

const Svg = ({ children, size = 18 }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const SearchIcon = () => <Svg size={16}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
const BellIcon = () => <Svg><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
const StoreIcon = () => <Svg><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" /><path d="M5 12v8h14v-8" /></Svg>;
const TruckIcon = () => <Svg><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></Svg>;
const MailIcon = () => <Svg><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></Svg>;

/** Sticky header: breadcrumb + page title, quick page search, shortcuts, notifications and the account menu. */
export function TopBar({ staff, groups, page, title, go, logout }) {
  const tr = useT();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null); // 'search' | 'bell' | 'me' | null
  const [alerts, setAlerts] = useState({ items: [], total: 0 });
  const box = useRef(null);
  const input = useRef(null);

  const pages = useMemo(() => groups.flatMap(([g, items]) => items.map(i => ({ key: i[0], label: tr(i[1]), icon: i[2], group: tr(g), en: i[1] + ' ' + g }))), [groups, tr]);
  const cur = pages.find(p => p.key === page);
  const hits = q.trim() ? pages.filter(p => (p.label + ' ' + p.group + ' ' + p.en).toLowerCase().includes(q.trim().toLowerCase())) : pages;

  useEffect(() => {
    let live = true;
    const load = () => adm.get('/alerts').then(a => { if (live) setAlerts(a); }).catch(() => {});
    load();
    const t = setInterval(load, 90000);
    return () => { live = false; clearInterval(t); };
  }, [page]);

  useEffect(() => {
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(null); };
    const key = e => {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) { e.preventDefault(); input.current?.focus(); }
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, []);

  const jump = k => { setQ(''); setOpen(null); input.current?.blur(); go(k); };
  return (
    <header className="adm-top">
      <div className="ttl">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link to="/admin">{tr('Admin')}</Link>{cur && <><i>›</i><span>{cur.group}</span><i>›</i><b>{cur.label}</b></>}
        </nav>
        <h1>{title}</h1>
      </div>
      <div className="tools" ref={box}>
        <div className="srch">
          <SearchIcon />
          <input ref={input} value={q} placeholder={tr('Jump to a page…')} aria-label={tr('Jump to a page')}
            onChange={e => { setQ(e.target.value); setOpen('search'); }} onFocus={() => setOpen('search')}
            onKeyDown={e => { if (e.key === 'Enter' && hits[0]) jump(hits[0].key); }} />
          <kbd>/</kbd>
          {open === 'search' && (
            <div className="pop list" role="listbox">
              {!hits.length && <span className="none">{tr('No page matches “{q}”.', { q })}</span>}
              {hits.map(p => <button key={p.key} type="button" onClick={() => jump(p.key)}><span className="ic">{p.icon}</span><span>{p.label}</span><small>{p.group}</small></button>)}
            </div>
          )}
        </div>
        <div className="tbtns">
          <LangSwitch />
          <Link className="tb" to="/" title={tr('Open the storefront')}><StoreIcon /><span>{tr('Store')}</span></Link>
          {can(staff, ['hub.view', 'hub.deliver']) && <Link className="tb hide-sm" to="/hub" title={tr('Delivery Hub')}><TruckIcon /><span>{tr('Hub')}</span></Link>}
          {can(staff, 'marketing.manage') && <Link className="tb hide-sm" to="/email" title={tr('Email Center')}><MailIcon /><span>{tr('Email')}</span></Link>}
          <div className="rel">
            <button type="button" className={'tb icon' + (open === 'bell' ? ' on' : '')} onClick={() => setOpen(open === 'bell' ? null : 'bell')} aria-label={tr('Notifications, {n} waiting', { n: alerts.total })}>
              <BellIcon />{alerts.total > 0 && <em>{alerts.total > 99 ? '99+' : alerts.total}</em>}
            </button>
            {open === 'bell' && (
              <div className="pop alerts">
                <b>{tr('Needs your attention')}</b>
                {!alerts.items.length && <span className="none">{tr('All caught up. Nothing is waiting.')}</span>}
                {alerts.items.map(a => <button key={a.key} type="button" onClick={() => jump(a.page)}><strong>{a.n}</strong><span>{tr(a.label)}</span><i>→</i></button>)}
              </div>
            )}
          </div>
          <div className="rel">
            <button type="button" className={'me' + (open === 'me' ? ' on' : '')} onClick={() => setOpen(open === 'me' ? null : 'me')} aria-label={tr('Account menu')}>
              <span className="av">{staff.name[0]}</span>
              <span className="who"><b>{staff.name}</b><small>{staff.role}</small></span><i>▾</i>
            </button>
            {open === 'me' && (
              <div className="pop menu">
                <div className="head"><span className="av big">{staff.name[0]}</span><div><b>{staff.name}</b><small>{staff.email}</small><em>{staff.role}</em></div></div>
                <Link to="/" onClick={() => setOpen(null)}>↗ {tr('Open storefront')}</Link>
                <button type="button" className="out" onClick={logout}>⏻ {tr('Sign out')}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Footer shown under every admin page. */
export function AdminFooter({ staff }) {
  const tr = useT();
  return (
    <footer className="adm-foot">
      <span className="l"><b>AR Trade International</b> · {tr('Admin Console')} · © {new Date().getFullYear()}</span>
      <span className="m">
        <Link to="/">{tr('Storefront')}</Link>
        {can(staff, ['hub.view', 'hub.deliver']) && <Link to="/hub">{tr('Delivery Hub')}</Link>}
        {can(staff, 'marketing.manage') && <Link to="/email">{tr('Email Center')}</Link>}
        <Link to="/policy/privacy">{tr('Privacy policy')}</Link>
      </span>
      <span className="r">{tr('Dev By:')} <b>Eng. A T M Faruque</b></span>
    </footer>
  );
}
