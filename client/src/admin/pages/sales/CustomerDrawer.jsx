import { useEffect, useState } from 'react';
import { adm, dateF, fmtMoney } from '../../adminApi.js';
import { Drawer, Pill, hueOf } from '../../ui.jsx';
import { Skeleton } from '../../fieldKit.jsx';
import { OrderDrawer } from './OrderDrawer.jsx';

const svg = d => <svg viewBox="0 0 24 24">{d}</svg>;
export const KEY_ICON = svg(<><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2.5 2.5M14 9l2 2" /></>);
export const LOCK_ICON = svg(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);

/** Customer details: summary, contact, the password tools and their latest orders (click one to open it). */
export function CustomerDrawer({ c, onClose, onReset, onSetPassword }) {
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState('');
  const [order, setOrder] = useState(null);
  useEffect(() => {
    setOrders(null);
    adm.get('/orders?size=10&customer=' + encodeURIComponent(String(c.phone || '').replace(/\D/g, '') || c.name)).then(r => setOrders(r.rows)).catch(e => setErr(e.message));
  }, [c.phone, c.name]);
  const avg = c.n ? Math.round(c.ltv / c.n) : 0;
  return (
    <>
    <Drawer title={c.name} sub={c.phone} onClose={onClose}>
      <div className="od-hero">
        <span className="od-av" style={{ '--h': hueOf(c.name) }}>{String(c.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
        <div className="od-who"><b>{c.name}</b><span>{c.phone}</span>
          <div className="od-badges"><i className={'od-pay ' + (c.userId ? 'ok' : '')}>{c.userId ? '✓ Online account' : 'No online account'}</i>{c.n > 1 && <i>Repeat buyer</i>}{!c.n && <i>No orders yet</i>}</div></div>
        <div className="od-amt"><small>Lifetime</small><b>{fmtMoney(c.ltv)}</b><span>{c.n} order{c.n === 1 ? '' : 's'}</span></div>
      </div>
      <section className="od-card">
        <h4>Details</h4>
        <div className="od-rows">
          <div><span className="od-ic"><svg viewBox="0 0 24 24"><path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5 5l1.3-2 4 1.6V17a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg></span><div><small>Phone</small><a href={'tel:' + c.phone}>{c.phone}</a></div></div>
          <div><span className="od-ic"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg></span><div><small>Email</small><span>{c.email || '—'}</span></div></div>
          <div><span className="od-ic"><svg viewBox="0 0 24 24"><path d="M6 3h12l2 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" /><path d="M4 7h16M9 11a3 3 0 0 0 6 0" /></svg></span><div><small>Average order</small><span>{c.n ? fmtMoney(avg) : '—'}</span></div></div>
          <div><span className="od-ic"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg></span><div><small>Last order</small><span>{c.last ? dateF(c.last) : '—'}</span></div></div>
        </div>
        {c.userId ? (
          <div className="cu-tools">
            <button type="button" className="a-btn sm" onClick={() => onReset(c)} title="Create a one-time link the customer can use to choose a new password"><i className="cu-i">{KEY_ICON}</i> Create reset link</button>
            <button type="button" className="a-btn sm" onClick={() => onSetPassword(c)} title="Type a new password for this customer yourself"><i className="cu-i">{LOCK_ICON}</i> Set password</button>
          </div>
        ) : <p className="cu-none">This customer has no online account, so there is no password to reset.</p>}
      </section>
      <section className="od-card">
        <h4>Latest orders <em>{orders ? orders.length : '…'}</em></h4>
        {err && <div className="a-msg err">{err}</div>}
        {!orders && !err ? <Skeleton rows={3} /> : orders && !orders.length ? <p className="cu-none">No orders found for this customer.</p> : (
          <div className="cu-orders">
            {(orders || []).map(o => (
              <button key={o.id} type="button" onClick={() => setOrder(o.id)}>
                <b className="mono">{o.id}</b><span>{dateF(o.date)}</span><Pill s={o.status} /><b>{fmtMoney(o.total)}</b>
              </button>
            ))}
          </div>
        )}
      </section>
    </Drawer>
    {/* beside the customer panel, not inside it: a scrim inside a drawer is raised above the drawer, which would grey out this one */}
    {order && <OrderDrawer id={order} riderOnly={false} canDelete={false} onClose={() => setOrder(null)} onChanged={() => {}} />}
    </>
  );
}
