import { Suspense } from 'react';
import { PageLoader } from '../components/PageLoader.jsx';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import './admin.css';
import { can } from './adminApi.js';
import { AdminFooter, TopBar } from './AdminChrome.jsx';
import { DialogHost } from './ui.jsx';
import { MODULE_OF, NAV, TITLES } from './nav.js';
import { Login } from './login/Login.jsx';
import { StaffCtx } from './pages/sales/staffContext.js';
import { AdminRoutes } from './app/AdminRoutes.jsx';
import { AdminSidebar } from './app/AdminSidebar.jsx';
import { NoAccess } from './app/NoAccess.jsx';
import { useAdminMenu } from './app/useAdminMenu.js';
import { useAdminSession } from './app/useAdminSession.js';

// the sign-in screen is shared with the Email Center and the Delivery Hub, which import it from here
export { Login };

/** The admin console shell: sign-in gate, permitted menu, top bar, page area (lazy routes) and footer. */
export default function AdminApp() {
  const { staff, setStaff, ready, cats, loadCats, mods, logout } = useAdminSession();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const pageKey = pathname.split('/')[2] || '';
  const menu = useAdminMenu(pageKey);

  if (!ready) return <PageLoader label="Checking your sign-in…" />;
  if (!staff) return <Login onDone={s => { setStaff(s); }} />;

  const groups = NAV.map(([g, items]) => [g, items.filter(i => can(staff, i[3]) && (!MODULE_OF[i[0]] || !mods || mods.includes(MODULE_OF[i[0]])))]).filter(([, i]) => i.length);
  if (!groups.length) return <NoAccess role={staff.role} onSignOut={logout} />;
  const home = groups[0][1][0][0];
  const mq = menu.menuQ.trim().toLowerCase();
  const shown = mq ? groups.map(([g, items]) => [g, items.filter(i => (i[1] + ' ' + g).toLowerCase().includes(mq))]).filter(([, i]) => i.length) : groups;
  const page = pageKey || home;
  const go = k => nav('/admin/' + k);
  const allowed = groups.flatMap(([, i]) => i.map(x => x[0]));
  if (pathname === '/admin' || pathname === '/admin/') return <Navigate to={'/admin/' + home} replace />;

  return (
    <StaffCtx.Provider value={staff}>
      <div className="adm">
        <AdminSidebar shown={shown} menu={menu} page={page} go={go} />
        <DialogHost />
        <main className="adm-main">
          <TopBar staff={staff} groups={groups} page={page} title={allowed.includes(page) ? TITLES[page] || 'Admin' : 'No access'} go={go} logout={logout} />
          <div className="adm-body" key={page}>
            {!allowed.includes(page) ? <div className="a-msg err">Your role cannot open this page.</div> : (
              <Suspense fallback={<PageLoader inline label="Loading the page…" />}>
                <AdminRoutes staff={staff} cats={cats} loadCats={loadCats} go={go} home={home} />
              </Suspense>
            )}
          </div>
          <AdminFooter staff={staff} />
        </main>
      </div>
    </StaffCtx.Provider>
  );
}
