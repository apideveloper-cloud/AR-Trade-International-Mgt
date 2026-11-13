import { Suspense, useCallback, useEffect, useState } from 'react';
import { lazyPage } from '../lazyPage.js';
import { PageLoader } from '../components/PageLoader.jsx';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './admin.css';
import { adm, can, fld, getAdminToken, setAdminToken, setUnauthorizedHandler } from './adminApi.js';
import { Dashboard } from './pages/Dashboard.jsx';
import { NavIcon } from './navIcons.jsx';
import { AdminFooter, TopBar } from './AdminChrome.jsx';
import { DialogHost } from './ui.jsx';
import { MODULE_OF, NAV, TITLES } from './nav.js';
import { Login } from './login/Login.jsx';

// the sign-in screen is shared with the Email Center and the Delivery Hub, which import it from here
export { Login };

// Pages load on demand (one chunk per area), so the first screen of the console stays small; the map library only loads with the Field pages.
const pick = (load, ...names) => Object.fromEntries(names.map(n => [n, lazyPage(load, n)]));
const { Categories, Products } = pick(() => import('./pages/Catalog.jsx'), 'Categories', 'Products');
const { Careers, Inbox, Marketing, Reviews, Services } = pick(() => import('./pages/Engage.jsx'), 'Careers', 'Inbox', 'Marketing', 'Reviews', 'Services');
const { BlogAdmin } = pick(() => import('./pages/BlogAdmin.jsx'), 'BlogAdmin');
const { PagesAdmin } = pick(() => import('./pages/PagesAdmin.jsx'), 'PagesAdmin');
const { ContentAdmin } = pick(() => import('./pages/ContentAdmin.jsx'), 'ContentAdmin');
const { Customers, Deliveries, Orders } = pick(() => import('./pages/Sales.jsx'), 'Customers', 'Deliveries', 'Orders');
const { Backups } = pick(() => import('./pages/Backups.jsx'), 'Backups');
const { FieldApprovals, FieldAttendance, FieldModules, FieldTeamMap } = pick(() => import('./pages/Field.jsx'), 'FieldApprovals', 'FieldAttendance', 'FieldModules', 'FieldTeamMap');
const { FieldContacts, FieldCustomers, FieldDeliveries, FieldOrders, FieldVisits } = pick(() => import('./pages/FieldSales.jsx'), 'FieldContacts', 'FieldCustomers', 'FieldDeliveries', 'FieldOrders', 'FieldVisits');
const { AccCollections, AccExpenses, AccOverview, AccPurchase, AccReceivables, AccReports } = pick(() => import('./pages/Accounts.jsx'), 'AccCollections', 'AccExpenses', 'AccOverview', 'AccPurchase', 'AccReceivables', 'AccReports');
const { InvDamage, InvPayments, InvPurchases, InvStock, InvVendors } = pick(() => import('./pages/Inventory.jsx'), 'InvDamage', 'InvPayments', 'InvPurchases', 'InvStock', 'InvVendors');
const { Quotations } = pick(() => import('./pages/Quotations.jsx'), 'Quotations');
const { Settings, Team } = pick(() => import('./pages/System.jsx'), 'Settings', 'Team');
const { Roles } = pick(() => import('./pages/Roles.jsx'), 'Roles');
const { Audit } = pick(() => import('./pages/Audit.jsx'), 'Audit');

export default function AdminApp() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
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
  const loadCats = useCallback(() => adm.get('/categories').then(r => setCats(r.map(c => ({ id: c.id, title: c.title })))).catch(() => {}), []);
  useEffect(() => { if (staff && can(staff, 'products.view')) loadCats(); }, [staff, loadCats]);
  useEffect(() => {
    if (!staff) { setMods(null); return undefined; }
    let stale = false; // an answer for a previous sign-in must not set the menu of the next one
    fld.get('/modules/me').then(r => { if (!stale) setMods(r.modules); }).catch(() => { if (!stale) setMods(null); });
    return () => { stale = true; };
  }, [staff]);

  if (!ready) return <PageLoader label="Checking your sign-in…" />;
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
                    {items.map(([k, t, ic]) => <Link key={k} to={'/admin/' + k} className={page === k ? 'on' : ''} aria-current={page === k ? 'page' : undefined}><span className="ic"><NavIcon k={k} fallback={ic} /></span><span className="tx">{t}</span></Link>)}
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
        <TopBar staff={staff} groups={groups} page={page} title={allowed.includes(page) ? TITLES[page] || 'Admin' : 'No access'} go={go} logout={logout} />
        <div className="adm-body" key={page}>
        {!allowed.includes(page) ? <div className="a-msg err">Your role cannot open this page.</div> : (
          <Suspense fallback={<PageLoader inline label="Loading the page…" />}>
          <Routes>
            <Route path="dashboard" element={<Dashboard go={go} staff={staff} />} />
            <Route path="orders" element={<Orders staff={staff} />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products cats={cats} staff={staff} />} />
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
            <Route path="backups" element={<Backups />} />
            <Route path="audit" element={<Audit />} />
            <Route path="inv-vendors" element={<InvVendors staff={staff} />} />
            <Route path="quotes" element={<Quotations staff={staff} />} />
            <Route path="inv-purchases" element={<InvPurchases staff={staff} />} />
            <Route path="inv-stock" element={<InvStock staff={staff} />} />
            <Route path="inv-damage" element={<InvDamage staff={staff} />} />
            <Route path="inv-payments" element={<InvPayments staff={staff} />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to={'/admin/' + home} replace />} />
          </Routes>
          </Suspense>
        )}
        </div>
        <AdminFooter staff={staff} />
      </main>
    </div>
  );
}
