import { Link } from 'react-router-dom';
import { fmt, fmtDate } from '../../api.js';
import { useStore } from '../../store.jsx';
import { supportStatus } from '../../supportHours.js';
import { Badge, CardHead, STEPS, Thumb, Loading, summary, isOpen } from './shared.jsx';

export default function Overview({ orders, profile, reminders }) {
  const { wish, find, site } = useStore();
  const sup = supportStatus();
  const active = (orders || []).find(isOpen);
  const recent = (orders || []).slice(0, 4);
  const idx = active ? STEPS.indexOf(active.status) : -1;
  const code = site.coupon, pct = profile?.since ? 10 : 5;
  return (
    <>
      {active && (
        <div className="ac-card ac-live-card">
          <div className="ac-live-head">
            <div className="ac-live-who">
              <Thumb src={active.items[0]?.img} size={56} />
              <div className="ac-live-text">
                <span className="ac-live"><i />LIVE · {active.id}</span>
                <b className="ac-live-title">{active.status === 'Shipped' ? 'On its way to you' : active.status === 'Packed' ? 'Packed and ready' : active.status === 'Confirmed' ? 'Order confirmed' : 'Order received'}</b>
                <span className="ac-muted">{summary(active)}</span>
              </div>
            </div>
            <Link to={'/account/orders/' + active.id} className="ac-btn ghost">Track order</Link>
          </div>
          <div className="ac-live-steps">
            {STEPS.map((s, i) => <div key={s} className="ac-col-gap8"><span className={i <= idx ? 'ac-bar on' : 'ac-bar'} /><span className={i <= idx ? 'ac-live-step-label on' : 'ac-live-step-label'}>{s}</span></div>)}
          </div>
        </div>
      )}
      <div className="ac-grid2">
        <div className="ac-card ac-card-flush">
          <CardHead title="Recent orders" right={<Link to="/account/orders" className="ac-link">View all →</Link>} />
          {orders === null && <Loading />}
          {orders && !recent.length && <div className="ac-empty-note">No orders yet. <Link to="/shop/all" className="ac-link-strong">Start shopping</Link></div>}
          {recent.map(o => (
            <Link key={o.id} to={'/account/orders/' + o.id} className="ac-row">
              <Thumb src={o.items[0]?.img} size={44} />
              <div className="ac-info-col"><b className="ac-row-id">{o.id} <span className="ac-dim">· {fmtDate(o.date)}</span></b><span className="ac-row-sum">{summary(o)}</span></div>
              <div className="ac-row-end"><b>{fmt(o.total)}</b><Badge s={o.status} /></div>
            </Link>
          ))}
        </div>
        <div className="ac-s18">
          <div className="ac-member">
            <span className="sheen" />
            <div className="ac-member-top"><span className="ac-member-tag">AR TRADE MEMBER</span><img src="/ar-icon-round.png" alt="" className="ac-member-logo" /></div>
            <div className="ac-member-body">
              <span className="ac-member-offer">{pct}% off your next order</span>
              <div className="ac-member-foot"><span className="mono ac-member-code">{code}</span><span className="ac-member-hint">Apply at checkout</span></div>
            </div>
          </div>
          <Link to="/account/wishlist" className="ac-card ac-card-row">
            <div className="ac-s28"><b className="ac-wish-title">Wishlist →</b><span className="ac-muted">{wish.length} saved items</span></div>
            <div className="ac-wish-stack">{wish.slice(0, 3).map(find).filter(Boolean).map(p => <div key={p.id} className="ac-stack"><div style={{ backgroundImage: `url('${p.img}')` }} /></div>)}</div>
          </Link>
          {reminders?.some(r => r.active && new Date(r.next) <= new Date(Date.now() + 7 * 864e5)) && (
            <Link to="/account/refill" className="ac-card ac-card-alert"><b>⏰ A refill is due soon</b><span className="ac-muted">Open Refill reminders to reorder in one tap.</span></Link>
          )}
          <div className="ac-card ac-card-row">
            <div className="ac-row-12"><span className="ac-support-icon"><span className="ac-support-dot" /></span><div className="ac-col-2"><b>{sup.online ? 'Support is online' : 'Support is offline'}</b><span className="ac-muted">{sup.online ? 'Sat–Thu, 10:00–20:00 · ' + sup.label.split(' · ')[1] : sup.label.replace('Offline · ', '')}</span></div></div>
            <a href={'https://wa.me/' + site.whatsapp} target="_blank" rel="noreferrer" className="ac-btn ac-btn-wa">WhatsApp</a>
          </div>
        </div>
      </div>
    </>
  );
}
