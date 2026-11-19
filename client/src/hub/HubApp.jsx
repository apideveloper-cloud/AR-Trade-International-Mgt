import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import './hub.css';
import './hubInline.css';
import { Login } from '../admin/AdminApp.jsx';
import { adm, can, getAdminToken, setAdminToken, setUnauthorizedHandler } from '../admin/adminApi.js';
import { fmt } from '../api.js';
import Branches from './Branches.jsx';
import Dispatch from './Dispatch.jsx';
import Returns from './Returns.jsx';
import RiderApp from './RiderApp.jsx';
import TrackPage from './TrackPage.jsx';
import { DONE, isRiderOnly } from './hubUtils.js';
import { useBoard } from './useBoard.js';

export default function HubApp() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
  const { board, err, load } = useBoard(staff);
  const loc = useLocation();

  const logout = useCallback(() => { setAdminToken(null); setStaff(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!getAdminToken()) { setReady(true); return; }
    adm.get('/me').then(r => setStaff(r.staff)).catch(() => setAdminToken(null)).finally(() => setReady(true));
  }, []);

  if (!ready) return <div className="hxi-boot"><span className="spin" /></div>;
  if (!staff) return <Login onDone={setStaff} />;
  const rider = isRiderOnly(staff);
  if (!rider && !can(staff, 'hub.view')) return <div className="hxi-denied"><div className="a-msg err">Your role cannot open the Delivery Hub.</div></div>;

  const active = board?.orders.filter(o => !DONE.includes(o.flow)) || [];
  const nav = rider ? [['rider', 'Rider app', 0]] : [['dispatch', 'Dispatch board', active.length], ['rider', 'Rider app', board?.orders.filter(o => o.rider && o.flow === 'Out for delivery').length || 0], ['track', 'Live tracking', 0], ['returns', 'Returns & refunds', board?.returnsPending || 0], ['branches', 'Branches & couriers', 0]];
  const cur = loc.pathname.split('/')[2] || nav[0][0];
  const title = (nav.find(n => n[0] === cur) || nav[0])[1];
  const stats = board ? [['Active', active.length], ['Out for delivery', board.orders.filter(o => o.flow === 'Out for delivery').length], ['COD with riders', fmt(board.codWithRiders)], ['Returns pending', board.returnsPending]] : [];

  return (
    <div className="hub">
      <aside className="hub-side">
        <div className="brand"><img src="/ar-icon-round.png" alt="AR Trade" /><div><b>Delivery Hub</b><small>AR TRADE · OPS</small></div></div>
        <nav>{nav.map(([k, t, n]) => <NavLink key={k} to={'/hub/' + k} className={({ isActive }) => (isActive ? 'on' : '')}><span>{t}</span>{n > 0 && <em>{n}</em>}</NavLink>)}</nav>
        <div className="foot">{!rider && <Link to="/admin">← Admin console</Link>}<Link to="/">Storefront ↗</Link><button onClick={logout}>Sign out ({staff.name.split(' ')[0]})</button></div>
      </aside>
      <main className="hub-main">
        <div className="hub-head">
          <div><small>Order &amp; delivery</small><h1>{title}</h1></div>
          {!rider && <div className="hub-stats">{stats.map(([t, v]) => <div key={t}><b>{v}</b><span>{t}</span></div>)}</div>}
        </div>
        {err && !board && <div className="a-msg err">{err}</div>}
        {(rider || board) && (
          <Routes>
            <Route path="dispatch" element={rider ? <Navigate to="/hub/rider" replace /> : <Dispatch board={board} reload={load} />} />
            <Route path="rider" element={<RiderApp staff={staff} reload={load} />} />
            <Route path="track" element={rider ? <Navigate to="/hub/rider" replace /> : <TrackPage board={board} />} />
            <Route path="track/:id" element={rider ? <Navigate to="/hub/rider" replace /> : <TrackPage board={board} />} />
            <Route path="returns" element={rider ? <Navigate to="/hub/rider" replace /> : <Returns />} />
            <Route path="branches" element={rider ? <Navigate to="/hub/rider" replace /> : <Branches />} />
            <Route path="*" element={<Navigate to={'/hub/' + nav[0][0]} replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
