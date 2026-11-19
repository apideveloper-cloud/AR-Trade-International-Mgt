import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Login } from '../admin/AdminApp.jsx';
import { AdminFooter, TopBar } from '../admin/AdminChrome.jsx';
import { adm, can, getAdminToken, mktApi as api, setAdminToken, setUnauthorizedHandler } from '../admin/adminApi.js';
import Audience from './Audience.jsx';
import Automations from './Automations.jsx';
import Campaigns from './Campaigns.jsx';
import Reports from './Reports.jsx';
import Setup from './Setup.jsx';
import Templates from './Templates.jsx';
import { TABS } from './emailShared.js';
import './emailInline.css';

export default function EmailApp() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState(null);
  const loc = useLocation();
  const nav = useNavigate();
  const logout = useCallback(() => { setAdminToken(null); setStaff(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!getAdminToken()) { setReady(true); return; }
    adm.get('/me').then(r => setStaff(r.staff)).catch(() => setAdminToken(null)).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (staff) api.get('/setup').then(setSetup).catch(() => {}); }, [staff, loc.pathname]);

  if (!ready) return <div className="em-loading"><span className="spin" /></div>;
  if (!staff) return <Login onDone={setStaff} />;
  if (!can(staff, 'marketing.manage')) return <div className="em-denied"><div className="a-msg err">Your role cannot open the Email Center.</div></div>;
  const cur = loc.pathname.split('/')[2] || 'reports';
  const title = (TABS.find(t => t[0] === cur) || TABS[0])[1];
  const dnsOk = setup?.dns.every(r => r.ok);
  const ICON = { reports: '▦', automations: '⚙', campaigns: '✉', templates: '❏', audience: '☺', setup: '✦' };
  const groups = [['Email Center', TABS.map(([k, l]) => [k, l, ICON[k] || '•', 'marketing.manage'])]];
  const status = setup ? `${setup.provider}${setup.hasKey ? ' · connected' : ' · not connected'}${dnsOk ? ' · domain verified' : ''}` : '…';
  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand logo"><img src="/admin-logo-light.png" alt="AR Trade International" /><small>Email Center</small></div>
        <nav className="adm-nav">
          <div className="em-col-2">
            <h6>Email</h6>
            {TABS.map(([k, l]) => <NavLink key={k} to={'/email/' + k} className={({ isActive }) => (isActive ? 'on' : '')}><span className="ic">{ICON[k]}</span><span className="tx">{l}</span></NavLink>)}
          </div>
          <div className="em-col-2">
            <h6>Go to</h6>
            <Link to="/admin/marketing"><span className="ic">←</span><span className="tx">Admin console</span></Link>
          </div>
        </nav>
        <div className="em-status"><i className={setup?.hasKey && dnsOk ? 'ok' : 'warn'} />{status}</div>
        <div className="adm-user"><span className="av">{staff.name[0]}</span><div className="em-user-meta"><b>{staff.name}</b><small>{staff.role}</small></div><button onClick={logout} title="Sign out">⏻</button></div>
      </aside>
      <main className="adm-main">
        <TopBar staff={staff} groups={groups} page={cur} title={title} go={k => nav('/email/' + k)} logout={logout} />
        <div className="adm-body" key={cur}>
          <Routes>
            <Route path="reports" element={<Reports />} />
            <Route path="automations" element={<Automations />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="templates" element={<Templates />} />
            <Route path="audience" element={<Audience />} />
            <Route path="setup" element={<Setup />} />
            <Route path="*" element={<Navigate to="/email/reports" replace />} />
          </Routes>
        </div>
        <AdminFooter staff={staff} />
      </main>
    </div>
  );
}
