import { Link, NavLink } from 'react-router-dom';
import { fmt } from '../../api.js';
import { useStore } from '../../store.jsx';

// The account page frame: the greeting banner with KPI tiles, and the side menu.

export function AccountHero({ user, profile, orders }) {
  const { cartCount, wish } = useStore();
  const live = (orders || []).filter(o => o.status !== 'Cancelled');
  const spent = live.reduce((a, o) => a + o.total, 0);
  const hour = new Date().getHours();
  const greet = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${String(user.name || '').split(' ')[0]}`;
  const kpis = [['▤', 'Orders', live.length], ['৳', 'Total spent', fmt(spent)], ['♡', 'Wishlist', wish.length], ['⌂', 'In cart', cartCount]];
  return (
  <section className="ac-hero">
    <div className="in">
      <div className="ac-s139">
        <div className="ac-s140">
          <div className="ac-av"><div>{String(user.name || '?')[0].toUpperCase()}</div></div>
          <div className="ac-s141">
            <span className="ac-eyebrow"><i />Member since {new Date(profile.since).getFullYear()}</span>
            <h1>{greet}</h1>
          </div>
        </div>
        <div className="ac-s142">
          <Link to="/services" className="ac-hbtn">Book servicing</Link>
          <Link to="/shop/toner" className="ac-hbtn solid">Re-order toner →</Link>
        </div>
      </div>
      <div className="ac-kpis">{kpis.map(([ic, t, v]) => <div key={t}><span>{ic}</span><div><small>{t}</small><b>{v}</b></div></div>)}</div>
    </div>
  </section>
  );
}

export function AccountSidebar({ orders, rems }) {
  const { logout, wish } = useStore();
  const nav = [['', 'Overview'], ['orders', 'Orders', orders?.length], ['wishlist', 'Wishlist', wish.length], ['services', 'Servicing'], ['compare', 'Compare'], ['profile', 'Profile'], ['addresses', 'Addresses'], ['family', 'Family & team'], ['refill', 'Refill reminders', rems?.length], ['settings', 'Notifications & privacy']];
  return (
    <aside className="ac-side">
      <span className="ac-menu">MENU</span>
      {nav.map(([to, t, c]) => (
        <NavLink key={to} to={'/account' + (to ? '/' + to : '')} end={!to} className={({ isActive }) => 'ac-nav' + (isActive ? ' on' : '')}>
          <i /><span>{t}</span>{c > 0 && <em>{c}</em>}
        </NavLink>
      ))}
      <div className="ac-s143" />
      <button className="ac-nav out" onClick={logout}><i />Sign out</button>
    </aside>
  );
}
