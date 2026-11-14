import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { acc, useOrders } from './account/shared.jsx';
import { AccountHero, AccountSidebar } from './account/Chrome.jsx';
import Overview from './account/Overview.jsx';
import Orders from './account/Orders.jsx';
import OrderDetail from './account/OrderDetail.jsx';
import Wishlist from './account/Wishlist.jsx';
import Servicing from './account/Servicing.jsx';
import Compare from './account/Compare.jsx';
import Profile from './account/Profile.jsx';
import Addresses from './account/Addresses.jsx';
import Family from './account/Family.jsx';
import Refill from './account/Refill.jsx';
import Settings from './account/Settings.jsx';
import '../account.css';
import './accountInline.css';

export default function Account() {
  const { user, authReady } = useStore();
  const [orders, reloadOrders] = useOrders();
  const [profile, setProfile] = useState(null);
  const [rems, setRems] = useState(null);
  const loadRems = useCallback(() => acc.get('/reminders').then(setRems).catch(() => setRems([])), []);
  useEffect(() => { if (user) { acc.get('/profile').then(setProfile).catch(() => {}); loadRems(); } }, [user, loadRems]);
  if (!user) return authReady ? <Navigate to="/login" replace /> : <div className="ac-s138"><span className="spin" /></div>; // a reload must not bounce a signed-in customer to /login before the session check finishes
  if (!profile) return <div className="ac-s138"><span className="spin" /></div>;

  return (
    <div className="ac-page">
      <AccountHero user={user} profile={profile} orders={orders} />
      <div className="ac-wrap">
        <AccountSidebar orders={orders} rems={rems} />
        <main className="ac-main">
          <Routes>
            <Route index element={<Overview orders={orders} profile={profile} reminders={rems} />} />
            <Route path="orders" element={<Orders orders={orders} />} />
            <Route path="orders/:id" element={<OrderDetail orders={orders} reload={reloadOrders} />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="services" element={<Servicing />} />
            <Route path="compare" element={<Compare />} />
            <Route path="profile" element={<Profile profile={profile} setProfile={setProfile} />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="family" element={<Family />} />
            <Route path="refill" element={<Refill orders={orders} rems={rems} reload={loadRems} />} />
            <Route path="settings" element={<Settings profile={profile} setProfile={setProfile} />} />
            <Route path="*" element={<Navigate to="/account" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
