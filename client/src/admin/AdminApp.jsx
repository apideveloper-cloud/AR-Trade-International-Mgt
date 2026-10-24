import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './admin.css';
import { adm, can, fld, getAdminToken, setAdminToken, setUnauthorizedHandler } from './adminApi.js';
import { Categories, Products } from './pages/Catalog.jsx';
import { Careers, Inbox, Marketing, Reviews, Services } from './pages/Engage.jsx';
import { BlogAdmin } from './pages/BlogAdmin.jsx';
import { PagesAdmin } from './pages/PagesAdmin.jsx';
import { ContentAdmin } from './pages/ContentAdmin.jsx';
import { Customers, Deliveries, Orders } from './pages/Sales.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { FieldApprovals, FieldAttendance, FieldModules, FieldTeamMap } from './pages/Field.jsx';
import { FieldContacts, FieldCustomers, FieldDeliveries, FieldOrders, FieldVisits } from './pages/FieldSales.jsx';
import { AccCollections, AccExpenses, AccOverview, AccPurchase, AccReceivables, AccReports } from './pages/Accounts.jsx';
import { Settings, Team } from './pages/System.jsx';
import { Roles } from './pages/Roles.jsx';
import { AdminFooter, TopBar } from './AdminChrome.jsx';
import { DialogHost } from './ui.jsx';

// [page, label, icon, permission(s) from the role matrix: any one opens the page]
const NAV = [
  ['Overview', [['dashboard', 'Dashboard', '▦', 'dashboard.view']]],
  ['Sales', [['orders', 'Orders', '▤', 'orders.view'], ['deliveries', 'Deliveries', '⚑', ['hub.view', 'hub.deliver']], ['customers', 'Customers', '☺', 'customers.view']]],
  ['Catalog', [['products', 'Products', '▣', 'products.view'], ['categories', 'Categories', '☰', 'products.view']]],
  ['Engage', [['services', 'Servicing', '✦', 'services.manage'], ['blog', 'Blog', '✎', 'blog.manage'], ['pages', 'Site pages', '❏', 'pages.manage'], ['content', 'Site content', '▧', 'pages.manage'], ['reviews', 'Reviews', '★', 'reviews.moderate'], ['inbox', 'Inbox', '✉', 'messages.manage'], ['marketing', 'Marketing', '✺', 'marketing.manage'], ['careers', 'Careers', '☷', 'careers.manage']]],
  ['Field team', [['field-map', 'Team map', '◎', 'field.approve'], ['field-attendance', 'Attendance', '◷', 'field.approve'], ['field-approvals', 'Approvals', '✔', 'field.approve'], ['field-modules', 'Field modules', '⚙', 'settings.manage']]],
  ['Field sales', [['field-customers', 'Field customers', '☺', 'field.approve'], ['field-visits', 'Visits & follow-ups', '⚑', 'field.approve'], ['field-orders', 'Field orders', '▤', 'field.approve'], ['field-deliveries', 'Field deliveries', '⛟', 'field.approve'], ['field-contacts', 'Contacts', '☎', 'field.approve']]],
  ['Accounts', [['acc-overview', 'Accounts overview', '◈', ['field.approve', 'hub.cash']], ['acc-receivables', 'Receivables', '⇣', ['field.approve', 'hub.cash']], ['acc-collections', 'Collections', '⇡', ['field.approve', 'hub.cash']], ['acc-expenses', 'Expenses', '₿', ['field.approve', 'hub.cash']], ['acc-purchase', 'Purchase orders', '▥', ['field.approve', 'hub.cash']], ['acc-reports', 'Reports', '▦', ['field.approve', 'hub.cash']]]],
  ['System', [['team', 'Team', '☻', 'team.manage'], ['roles', 'Roles', '⚿', 'roles.manage'], ['settings', 'Settings', '⚙', 'settings.manage']]]
];
// the field-app module behind a menu page (a page is hidden when the module is off for the signed-in role)
const MODULE_OF = { 'field-map': 'team', 'field-attendance': 'attendance', 'field-approvals': 'approvals', 'field-customers': 'customers', 'field-visits': 'visits', 'field-orders': 'sales', 'field-deliveries': 'delivery', 'field-contacts': 'contacts', 'acc-collections': 'collection', 'acc-purchase': 'purchase', 'acc-reports': 'reports', 'acc-expenses': 'expenses' };
const TITLES = { 'field-customers': 'Field customers', 'field-visits': 'Visits & follow-ups', 'field-orders': 'Field sales orders', 'field-deliveries': 'Field deliveries', 'field-contacts': 'Contacts', 'acc-overview': 'Accounts overview', 'acc-receivables': 'Receivables', 'acc-collections': 'Collections', 'acc-expenses': 'Expense ledger', 'acc-purchase': 'Purchase orders', 'acc-reports': 'Accounts reports', 'field-map': 'Team live map', 'field-attendance': 'Attendance', 'field-approvals': 'Field approvals', 'field-modules': 'Field app modules', dashboard: 'Dashboard', orders: 'Orders', deliveries: 'Deliveries', customers: 'Customers', products: 'Products', categories: 'Categories', services: 'Service requests', blog: 'Blog articles', pages: 'Servicing, clients & company pages', content: 'Storefront content (slider, logos, FAQs, policies)', reviews: 'Product reviews', inbox: 'Inbox', marketing: 'Marketing', careers: 'Careers', team: 'Team & accounts', roles: 'Roles & permissions', settings: 'Settings' };

/** Password box with a show / hide eye, so a mistyped password can be checked before signing in. */
function PasswordInput({ name, autoComplete, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-in">
      <input type={show ? 'text' : 'password'} name={name} required minLength={minLength} autoComplete={autoComplete} />
      <button type="button" className="pw-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} title={show ? 'Hide password' : 'Show password'}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {show
            ? <><path d="M3 3l18 18" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a12 12 0 0 1-2.6 3.3M6.6 7.6A12.4 12.4 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.6 0 3-.4 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
            : <><path d="M2.5 12c1-2 4.5-6 9.5-6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </span>
  );
}

// [role, icon, what the role does, accent hue]
const LOGIN_ROLES = [
  ['Master Admin', '★', 'Everything, and the role matrix', 85], ['Admin', '◆', 'Access set by the Master Admin', 250], ['Manager', '☰', 'Orders, deliveries, approvals', 160],
  ['Accountant', '৳', 'Money, payments, expenses', 300], ['Purchase Officer', '▣', 'Buying, products and stock', 45], ['RM', '☺', 'Customers, enquiries, campaigns', 15],
  ['Field Officer', '⚑', 'Mobile app: attendance, tracking', 200], ['Delivery rider', '🚚', 'Pick-ups and deliveries', 230], ['Marketing manager', '✉', 'Campaigns and subscribers', 330], ['Content writer', '✎', 'Blog and site pages', 120]
];

/** A graphical combo box: the chosen role is shown as an icon + name + what it does, and the list opens as coloured rows. Arrow keys, Enter, Esc and Home/End work. */
function RoleCombo({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  const cur = LOGIN_ROLES.find(r => r[0] === value);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  useEffect(() => { if (open) box.current?.querySelector('.rc-row.hi')?.scrollIntoView({ block: 'nearest' }); }, [open, hi]);
  const toggle = () => { setHi(Math.max(0, LOGIN_ROLES.findIndex(r => r[0] === value))); setOpen(o => !o); };
  const pick = i => { onChange(LOGIN_ROLES[i][0]); setOpen(false); box.current?.querySelector('.rc-btn')?.focus(); };
  const key = e => {
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); toggle(); } return; }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => (h + 1) % LOGIN_ROLES.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => (h - 1 + LOGIN_ROLES.length) % LOGIN_ROLES.length); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0); }
    else if (e.key === 'End') { e.preventDefault(); setHi(LOGIN_ROLES.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(hi); }
    else if (e.key === 'Tab') setOpen(false);
  };
  return (
    <div className={'rc' + (open ? ' open' : '')} ref={box} onKeyDown={key}>
      <button type="button" className="rc-btn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls="rc-list" aria-label="Your role" onClick={toggle} style={cur ? { '--h': cur[3] } : undefined}>
        {cur
          ? <><i className="rc-ic">{cur[1]}</i><span className="rc-tx"><b>{cur[0]}</b><small>{cur[2]}</small></span></>
          : <><i className="rc-ic none">?</i><span className="rc-tx"><b className="muted">Select your role</b><small>Tap to choose how you sign in</small></span></>}
        <svg className="rc-car" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className="rc-list" id="rc-list" role="listbox" aria-label="Roles">
          {LOGIN_ROLES.map(([r, ic, ds, h], i) => (
            <li key={r} role="option" aria-selected={value === r} className={'rc-row' + (hi === i ? ' hi' : '') + (value === r ? ' on' : '')} style={{ '--h': h }} onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); pick(i); }}>
              <i className="rc-ic">{ic}</i><span className="rc-tx"><b>{r}</b><small>{ds}</small></span>{value === r && <em aria-hidden="true">✓</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Login({ onDone }) {
  const [role, setRole] = useState(() => { try { const r = localStorage.getItem('ar_login_role'); return LOGIN_ROLES.some(x => x[0] === r) ? r : ''; } catch { return ''; } });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!role) { setErr('Pick your role first.'); document.querySelector('.rc-btn')?.focus(); return; }
    // our own validation instead of the browser's grey "Please fill out this field" bubble
    for (const el of e.target.querySelectorAll('input[required]')) {
      const v = el.value.trim();
      const label = (el.closest('label')?.firstChild?.textContent || 'this field').trim().toLowerCase();
      const problem = !v ? `Please enter your ${label}.` : el.minLength > 0 && v.length < el.minLength ? `The ${label} must be at least ${el.minLength} characters.` : '';
      if (problem) { el.setAttribute('aria-invalid', 'true'); el.focus(); setErr(problem); return; }
    }
    const d = Object.fromEntries(new FormData(e.target).entries());
    setBusy(true);
    try {
      const r = await adm.post('/login', { id: d.id, password: d.pass, role });
      try { localStorage.setItem('ar_login_role', role); } catch { /* storage unavailable */ }
      setAdminToken(r.token); onDone(r.staff);
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  return (
    <div className="adm-login">
      <div className="box">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <img src="/admin-logo-light.png" alt="AR Trade International" style={{ display: 'block', width: 'min(340px, 74vw)', height: 'auto' }} />
          <span className="mono" style={{ fontSize: 11, letterSpacing: '.22em', color: 'oklch(0.78 0.1 230)' }}>ADMIN CONSOLE</span>
        </div>
        <div className="card">
          <div><span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', display: 'block' }}>Welcome back</span><span style={{ fontSize: 13, color: '#8f9bb8' }}>Pick your role, then sign in with your mobile number or work email.</span></div>
          <form onSubmit={submit} noValidate onInput={ev => { ev.target.removeAttribute?.('aria-invalid'); setErr(''); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="rc-field"><span className="rl-l">Your role</span><RoleCombo value={role} onChange={r => { setRole(r); setErr(''); }} /></div>
            <label>Mobile or email<input type="text" name="id" required placeholder="01XXXXXXXXX or email" autoComplete="username" /></label>
            <label>Password<PasswordInput name="pass" minLength={8} autoComplete="current-password" /></label>
            {err && <span className="lerr" role="alert">⚠ {err}</span>}
            <button className="go" disabled={busy}>{busy ? 'Checking…' : role ? 'Sign in as ' + role + ' →' : 'Sign in →'}</button>
          </form>
          <small className="lg-note">The role must match your account. A wrong role is refused even with the right password.</small>
        </div>
        <Link to="/" style={{ textAlign: 'center', color: '#8f9bb8', fontSize: 13 }}>← Back to storefront</Link>
        <span style={{ textAlign: 'center', color: '#6f7b98', fontSize: 12 }}>Dev By: <b style={{ color: '#c9d4ea', fontWeight: 700 }}>Eng. A T M Faruque</b></span>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
  const [site, setSite] = useState(null);
  const [cats, setCats] = useState([]);
  const [menuQ, setMenuQ] = useState(''); // left-menu search
  // left menu behaves as an accordion: one group open at a time, and the group of the page you are on opens by itself
  const [openG, setOpenG] = useState('');
  const [mods, setMods] = useState(null); // field-app modules this role may use: the menu hides pages whose module is off for them
  const nav = useNavigate();
  const { pathname } = useLocation();

  const pageKey = pathname.split('/')[2] || '';
  useEffect(() => { const g = NAV.find(([, items]) => items.some(i => i[0] === pageKey)); if (g) setOpenG(g[0]); }, [pageKey]);
  useEffect(() => { // keep the current page's link in view in a long menu (after the group has finished opening)
    const t = setTimeout(() => document.querySelector('.adm-nav a.on')?.scrollIntoView({ block: 'nearest' }), 260);
    return () => clearTimeout(t);
  }, [pageKey]);
  const navKeys = e => { // arrow keys walk the menu, Left / Right fold / unfold a group, Home / End jump to the ends
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
  };
  const logout = useCallback(() => { setAdminToken(null); setStaff(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!getAdminToken()) { setReady(true); return; }
    adm.get('/me').then(r => setStaff(r.staff)).catch(() => setAdminToken(null)).finally(() => setReady(true));
  }, []);
  const loadMeta = useCallback(() => fetch('/api/bootstrap').then(r => r.json()).then(d => { setSite(d.site); }).catch(() => {}), []);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  const loadCats = useCallback(() => adm.get('/categories').then(r => setCats(r.map(c => ({ id: c.id, title: c.title })))).catch(() => {}), []);
  useEffect(() => { if (staff && can(staff, 'products.view')) loadCats(); }, [staff, loadCats]);
  useEffect(() => { if (staff) fld.get('/modules/me').then(r => setMods(r.modules)).catch(() => setMods(null)); else setMods(null); }, [staff]);

  if (!ready) return <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;
  if (!staff) return <Login onDone={s => { setStaff(s); }} />;

  const groups = NAV.map(([g, items]) => [g, items.filter(i => can(staff, i[3]) && (!MODULE_OF[i[0]] || !mods || mods.includes(MODULE_OF[i[0]])))]).filter(([, i]) => i.length);
  if (!groups.length) {
    return (
      <div style={{ padding: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <div className="a-msg err">Your role ({staff.role}) has no admin console pages. Use the mobile app, or ask the Master Admin to grant access.</div>
        <button className="a-btn" onClick={logout}>Sign out</button>
      </div>
    );
  }
  const home = groups[0][1][0][0];
  const mq = menuQ.trim().toLowerCase();
  const shown = mq ? groups.map(([g, items]) => [g, items.filter(i => (i[1] + ' ' + g).toLowerCase().includes(mq))]).filter(([, i]) => i.length) : groups;
  const page = pathname.split('/')[2] || home;
  const go = k => nav('/admin/' + k);
  const allowed = groups.flatMap(([, i]) => i.map(x => x[0]));
  if (pathname === '/admin' || pathname === '/admin/') return <Navigate to={'/admin/' + home} replace />;

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand logo"><img src="/admin-logo-light.png" alt="AR Trade International" /><small>Admin console</small></div>
        <div className="nav-search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={menuQ} placeholder="Search menu…" aria-label="Search the menu" onChange={e => setMenuQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setMenuQ(''); if (e.key === 'Enter' && shown[0]) { go(shown[0][1][0][0]); setMenuQ(''); } }} />
          {menuQ && <button type="button" onClick={() => setMenuQ('')} aria-label="Clear the search">✕</button>}
        </div>
        <nav className="adm-nav" aria-label="Admin menu" onKeyDown={navKeys}>
          {!shown.length && <span className="nav-none">No menu item matches “{menuQ}”.</span>}
          {shown.map(([g, items], gi) => {
            const here = items.some(i => i[0] === page);
            const open = mq ? true : openG === g;
            const id = 'nav-g-' + gi;
            return (
              <div key={g} className={'nav-grp' + (open ? '' : ' shut')}>
                <button type="button" className="nav-g" id={id + '-h'} aria-expanded={open} aria-controls={id} onClick={() => !mq && setOpenG(open ? '' : g)} title={open ? 'Fold this group' : 'Open this group'}>
                  <span>{g}</span>{!open && here && <i className="dot" />}<em>{items.length}</em>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <div className="nav-items-wrap">
                  <div className="nav-items" id={id} role="group" aria-labelledby={id + '-h'}>
                    {items.map(([k, t, ic]) => <Link key={k} to={'/admin/' + k} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}><span className="ic">{ic}</span><span className="tx">{t}</span></Link>)}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="adm-user"><span className="av">{staff.name[0]}</span><div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}><b>{staff.name}</b><small>{staff.role}</small></div><button onClick={logout} title="Sign out">⏻</button></div>
        </div>
      </aside>
      <DialogHost />
      <main className="adm-main">
        <TopBar staff={staff} groups={groups} page={page} title={TITLES[page] || 'Admin'} go={go} logout={logout} />
        <div className="adm-body" key={page}>
        {!allowed.includes(page) ? <div className="a-msg err">Your role cannot open this page.</div> : (
          <Routes>
            <Route path="dashboard" element={<Dashboard go={go} staff={staff} />} />
            <Route path="orders" element={<Orders site={site} staff={staff} />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products cats={cats} />} />
            <Route path="categories" element={<Categories onChanged={loadCats} />} />
            <Route path="services" element={<Services />} />
            <Route path="blog" element={<BlogAdmin staff={staff} />} />
            <Route path="pages" element={<PagesAdmin staff={staff} />} />
            <Route path="content" element={<ContentAdmin />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="careers" element={<Careers />} />
            <Route path="field-customers" element={<FieldCustomers />} />
            <Route path="field-visits" element={<FieldVisits />} />
            <Route path="field-orders" element={<FieldOrders />} />
            <Route path="field-deliveries" element={<FieldDeliveries />} />
            <Route path="field-contacts" element={<FieldContacts />} />
            <Route path="acc-overview" element={<AccOverview go={go} />} />
            <Route path="acc-receivables" element={<AccReceivables />} />
            <Route path="acc-collections" element={<AccCollections />} />
            <Route path="acc-expenses" element={<AccExpenses />} />
            <Route path="acc-purchase" element={<AccPurchase />} />
            <Route path="acc-reports" element={<AccReports />} />
            <Route path="field-map" element={<FieldTeamMap />} />
            <Route path="field-attendance" element={<FieldAttendance />} />
            <Route path="field-approvals" element={<FieldApprovals staff={staff} />} />
            <Route path="field-modules" element={<FieldModules />} />
            <Route path="team" element={<Team me={staff} />} />
            <Route path="roles" element={<Roles />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to={'/admin/' + home} replace />} />
          </Routes>
        )}
        </div>
        <AdminFooter staff={staff} />
      </main>
    </div>
  );
}
