import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import './admin.css';
import { adm, getAdminToken, setAdminToken, setUnauthorizedHandler } from './adminApi.js';
import { Categories, Products } from './pages/Catalog.jsx';
import { Careers, Inbox, Marketing, Reviews, Services } from './pages/Engage.jsx';
import { BlogAdmin } from './pages/BlogAdmin.jsx';
import { PagesAdmin } from './pages/PagesAdmin.jsx';
import { Customers, Dashboard, Deliveries, Orders } from './pages/Sales.jsx';
import { Settings, Team } from './pages/System.jsx';

const ADMINS = ['Super admin', 'Admin'];
const NAV = [
  ['Overview', [['dashboard', 'Dashboard', '▦', ADMINS]]],
  ['Sales', [['orders', 'Orders', '▤', [...ADMINS, 'Delivery rider']], ['deliveries', 'Deliveries', '⚑', [...ADMINS, 'Delivery rider']], ['customers', 'Customers', '☺', ADMINS]]],
  ['Catalog', [['products', 'Products', '▣', ADMINS], ['categories', 'Categories', '☰', ADMINS]]],
  ['Engage', [['services', 'Servicing', '✦', ADMINS], ['blog', 'Blog', '✎', [...ADMINS, 'Content writer']], ['pages', 'Site pages', '❏', [...ADMINS, 'Content writer']], ['reviews', 'Reviews', '★', [...ADMINS, 'Marketing manager']], ['inbox', 'Inbox', '✉', [...ADMINS, 'Marketing manager']], ['marketing', 'Marketing', '✺', [...ADMINS, 'Marketing manager']], ['careers', 'Careers', '☷', ADMINS]]],
  ['System', [['team', 'Team', '☻', ADMINS], ['settings', 'Settings', '⚙', ADMINS]]]
];
const TITLES = { dashboard: 'Dashboard', orders: 'Orders', deliveries: 'Deliveries', customers: 'Customers', products: 'Products', categories: 'Categories', services: 'Service requests', blog: 'Blog articles', pages: 'Servicing, clients & company pages', reviews: 'Product reviews', inbox: 'Inbox', marketing: 'Marketing', careers: 'Careers', team: 'Team & roles', settings: 'Settings' };

export function Login({ onDone }) {
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr(''); setOk('');
    const d = Object.fromEntries(new FormData(e.target).entries());
    setBusy(true);
    try {
      if (mode === 'register') {
        if (d.pass !== d.pass2) throw new Error('Passwords do not match.');
        await adm.post('/register', { name: d.name, email: d.email, phone: d.phone, password: d.pass, role: d.role });
        setOk('Request sent. An admin must approve your account before you can sign in.'); setMode('login');
      } else {
        const r = await adm.post('/login', { id: d.id, password: d.pass });
        setAdminToken(r.token); onDone(r.staff);
      }
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  const reg = mode === 'register';
  return (
    <div className="adm-login">
      <div className="box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <img src="/ar-icon-round.png" alt="" style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff', padding: 2, boxShadow: '0 0 0 6px rgba(255,255,255,.06)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}><b style={{ fontSize: 17 }}>AR Trade</b><span className="mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'oklch(0.78 0.1 230)' }}>ADMIN CONSOLE</span></div>
        </div>
        <div className="card">
          <div><span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', display: 'block' }}>{reg ? 'Request access' : 'Welcome back'}</span><span style={{ fontSize: 13, color: '#8f9bb8' }}>{reg ? 'Riders, marketing staff and content writers can register; an admin approves you.' : 'Sign in with your mobile number or work email.'}</span></div>
          <div className="tabs">{[['login', 'Sign in'], ['register', 'Register']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reg && <label>Full name<input type="text" name="name" required /></label>}
            {!reg && <label>Mobile or email<input type="text" name="id" required placeholder="01XXXXXXXXX or email" autoComplete="username" /></label>}
            {reg && <label>Mobile number<input type="tel" name="phone" required pattern="0?1[3-9][0-9]{8}" maxLength={11} placeholder="01XXXXXXXXX" /></label>}
            {reg && <label>Work email<input type="email" name="email" required /></label>}
            {reg && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{['Delivery rider', 'Marketing manager', 'Content writer'].map((r, i) => <label key={r} className="role"><input type="radio" name="role" value={r} defaultChecked={!i} />{r}</label>)}</div>}
            <label>Password<input type="password" name="pass" required minLength={8} autoComplete="current-password" /></label>
            {reg && <label>Confirm password<input type="password" name="pass2" required minLength={8} /></label>}
            {err && <span style={{ background: 'oklch(0.35 0.1 25 / .5)', border: '1px solid oklch(0.55 0.15 25 / .6)', color: '#ffd9d2', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{err}</span>}
            {ok && <span style={{ background: 'oklch(0.35 0.08 150 / .5)', border: '1px solid oklch(0.6 0.12 150 / .6)', color: '#d5f5e0', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{ok}</span>}
            <button className="go" disabled={busy}>{reg ? 'Request access' : 'Sign in'} →</button>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: '#6f7b98', borderTop: '1px dashed #223050', paddingTop: 14 }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'oklch(0.78 0.1 230)', background: 'oklch(0.5 0.12 240 / .15)', borderRadius: 6, padding: '3px 7px' }}>DEMO</span><span>01700000000 · admin@artradeinternational.com</span><span style={{ color: '#aeb8d0', fontWeight: 700 }}>admin123</span>
          </div>
        </div>
        <Link to="/" style={{ textAlign: 'center', color: '#8f9bb8', fontSize: 13 }}>← Back to storefront</Link>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
  const [site, setSite] = useState(null);
  const [cats, setCats] = useState([]);
  const nav = useNavigate();
  const { pathname } = useLocation();

  const logout = useCallback(() => { setAdminToken(null); setStaff(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!getAdminToken()) { setReady(true); return; }
    adm.get('/me').then(r => setStaff(r.staff)).catch(() => setAdminToken(null)).finally(() => setReady(true));
  }, []);
  const loadMeta = useCallback(() => fetch('/api/bootstrap').then(r => r.json()).then(d => { setSite(d.site); }).catch(() => {}), []);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  const loadCats = useCallback(() => adm.get('/categories').then(r => setCats(r.map(c => ({ id: c.id, title: c.title })))).catch(() => {}), []);
  useEffect(() => { if (staff && ADMINS.includes(staff.role)) loadCats(); }, [staff, loadCats]);

  if (!ready) return <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;
  if (!staff) return <Login onDone={s => { setStaff(s); }} />;

  const groups = NAV.map(([g, items]) => [g, items.filter(i => i[3].includes(staff.role))]).filter(([, i]) => i.length);
  const home = groups[0][1][0][0];
  const page = pathname.split('/')[2] || home;
  const go = k => nav('/admin/' + k);
  const allowed = groups.flatMap(([, i]) => i.map(x => x[0]));
  if (pathname === '/admin' || pathname === '/admin/') return <Navigate to={'/admin/' + home} replace />;

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand"><img src="/ar-icon-round.png" alt="" /><div><b>AR Trade</b><small>Admin console</small></div></div>
        <nav className="adm-nav">
          {groups.map(([g, items]) => (
            <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <h6>{g}</h6>
              {items.map(([k, t, ic]) => <Link key={k} to={'/admin/' + k} className={page === k ? 'on' : ''}><span className="ic">{ic}</span><span className="tx">{t}</span></Link>)}
            </div>
          ))}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="adm-links"><Link to="/">↗ Storefront</Link>{staff.role !== 'Content writer' && <><Link to="/hub">↗ Delivery Hub</Link><Link to="/email">↗ Email Center</Link></>}</div>
          <div className="adm-user"><span className="av">{staff.name[0]}</span><div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}><b>{staff.name}</b><small>{staff.role}</small></div><button onClick={logout} title="Sign out">⏻</button></div>
        </div>
      </aside>
      <main className="adm-main">
        <div><span className="today">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><h1>{TITLES[page] || 'Admin'}</h1></div>
        {!allowed.includes(page) ? <div className="a-msg err">Your role cannot open this page.</div> : (
          <Routes>
            <Route path="dashboard" element={<Dashboard go={go} />} />
            <Route path="orders" element={<Orders site={site} staff={staff} />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products cats={cats} />} />
            <Route path="categories" element={<Categories onChanged={loadCats} />} />
            <Route path="services" element={<Services />} />
            <Route path="blog" element={<BlogAdmin staff={staff} />} />
            <Route path="pages" element={<PagesAdmin staff={staff} />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="careers" element={<Careers />} />
            <Route path="team" element={<Team me={staff} />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to={'/admin/' + home} replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
