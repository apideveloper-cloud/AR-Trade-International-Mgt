import { Link } from 'react-router-dom';
import { fmt, fmtDate } from '../../api.js';
import { useStore } from '../../store.jsx';
import { Badge, STEPS, Thumb, Loading, summary, isOpen } from './shared.jsx';

export default function Overview({ orders, profile, reminders }) {
  const { wish, find, site } = useStore();
  const active = (orders || []).find(isOpen);
  const recent = (orders || []).slice(0, 4);
  const idx = active ? STEPS.indexOf(active.status) : -1;
  const code = site.coupon, pct = profile?.since ? 10 : 5;
  return (
    <>
      {active && (
        <div className="ac-card ac-s1">
          <div className="ac-s2">
            <div className="ac-s3">
              <Thumb src={active.items[0]?.img} size={56} />
              <div className="ac-s4">
                <span className="ac-live"><i />LIVE · {active.id}</span>
                <b className="ac-s5">{active.status === 'Shipped' ? 'On its way to you' : active.status === 'Packed' ? 'Packed and ready' : active.status === 'Confirmed' ? 'Order confirmed' : 'Order received'}</b>
                <span className="ac-s6">{summary(active)}</span>
              </div>
            </div>
            <Link to={'/account/orders/' + active.id} className="ac-btn ghost">Track order</Link>
          </div>
          <div className="ac-s7">
            {STEPS.map((s, i) => <div key={s} className="ac-s8"><span className={i <= idx ? 'ac-bar on' : 'ac-bar'} /><span style={{ fontSize: 12, fontWeight: 600, color: i <= idx ? '#0b1631' : '#9aa1b2' }}>{s}</span></div>)}
          </div>
        </div>
      )}
      <div className="ac-grid2">
        <div className="ac-card ac-s9">
          <div className="ac-card-hd"><b>Recent orders</b><Link to="/account/orders" className="ac-link">View all →</Link></div>
          {orders === null && <Loading />}
          {orders && !recent.length && <div className="ac-s11">No orders yet. <Link to="/shop/all" className="ac-s12">Start shopping</Link></div>}
          {recent.map(o => (
            <Link key={o.id} to={'/account/orders/' + o.id} className="ac-row">
              <Thumb src={o.items[0]?.img} size={44} />
              <div className="ac-s13"><b className="ac-s14">{o.id} <span className="ac-s15">· {fmtDate(o.date)}</span></b><span className="ac-s16">{summary(o)}</span></div>
              <div className="ac-s17"><b>{fmt(o.total)}</b><Badge s={o.status} /></div>
            </Link>
          ))}
        </div>
        <div className="ac-s18">
          <div className="ac-member">
            <span className="sheen" />
            <div className="ac-s19"><span className="ac-s20">AR TRADE MEMBER</span><img src="/ar-icon-round.png" alt="" className="ac-s21" /></div>
            <div className="ac-s22">
              <span className="ac-s23">{pct}% off your next order</span>
              <div className="ac-s24"><span className="mono ac-s25">{code}</span><span className="ac-s26">Apply at checkout</span></div>
            </div>
          </div>
          <Link to="/account/wishlist" className="ac-card ac-s27">
            <div className="ac-s28"><b className="ac-s29">Wishlist →</b><span className="ac-s6">{wish.length} saved items</span></div>
            <div className="ac-s30">{wish.slice(0, 3).map(find).filter(Boolean).map(p => <div key={p.id} className="ac-stack"><div style={{ backgroundImage: `url('${p.img}')` }} /></div>)}</div>
          </Link>
          {reminders?.some(r => r.active && new Date(r.next) <= new Date(Date.now() + 7 * 864e5)) && (
            <Link to="/account/refill" className="ac-card ac-s31"><b>⏰ A refill is due soon</b><span className="ac-s6">Open Refill reminders to reorder in one tap.</span></Link>
          )}
          <div className="ac-card ac-s27">
            <div className="ac-s32"><span className="ac-s33"><span className="ac-s34" /></span><div className="ac-s35"><b>Support is online</b><span className="ac-s6">Sat–Thu, 10:00–20:00</span></div></div>
            <a href={'https://wa.me/' + site.whatsapp} target="_blank" rel="noreferrer" className="ac-btn ac-s36">WhatsApp</a>
          </div>
        </div>
      </div>
    </>
  );
}
