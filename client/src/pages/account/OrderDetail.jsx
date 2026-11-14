import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LiveTrack from '../../components/LiveTrack.jsx';
import { api, fmt, fmtDate, fmtTime } from '../../api.js';
import { printInvoice } from '../../invoice.js';
import { useStore } from '../../store.jsx';
import { Badge, STEPS, Thumb, acc, useBuyAgain } from './shared.jsx';

export default function OrderDetail({ orders, reload }) {
  const { id } = useParams();
  const { site, say } = useStore();
  const buyAgain = useBuyAgain();
  const o = (orders || []).find(x => x.id === id);
  const phone = o?.customer?.phone;
  // the live tracking view (courier, ETA, returns) for this order; it belongs to one order+phone, so it vanishes when either changes
  const key = phone ? id + '|' + phone : '';
  const keyRef = useRef(key);
  keyRef.current = key;
  const [liveState, setLiveState] = useState({ key: '', d: null });
  const live = liveState.key === key ? liveState.d : null;
  const loadLive = useCallback(() => {
    if (!phone) return Promise.resolve();
    const k = id + '|' + phone;
    return api.get(`/live/live?id=${encodeURIComponent(id)}&phone=${encodeURIComponent(phone)}`)
      .then(d => { if (keyRef.current === k) setLiveState({ key: k, d }); }) // a late answer for another order is dropped
      .catch(() => {}); // a failed poll keeps what is shown, so the 5-second refresh carries on
  }, [id, phone]);
  useEffect(() => { loadLive(); }, [loadLive]);
  useEffect(() => { // refresh while the parcel is on the road
    if (live?.flow !== 'Out for delivery') return undefined;
    const t = setInterval(() => { if (!document.hidden) loadLive(); }, 5000);
    return () => clearInterval(t);
  }, [live?.flow, loadLive]);
  if (orders === null) return <span className="spin" />;
  if (!o) return <div className="ac-card">Order not found. <Link to="/account/orders" className="ac-s41">Back to orders</Link></div>;
  const cancel = async () => {
    if (!window.confirm('Cancel order ' + o.id + '?')) return;
    try { await acc.post(`/orders/${o.id}/cancel`); say('Order cancelled'); reload(); loadLive(); } catch (e) { say(e.message); }
  };
  const idx = STEPS.indexOf(o.status);
  const steps = o.status === 'Cancelled' ? o.history.map(h => h.s) : STEPS;
  return (
    <>
      <div className="crumbs ac-s47"><Link to="/account/orders">Orders</Link><span>/</span><span className="ac-s48">{o.id}</span></div>
      <div className="ac-s49">
        <div className="ac-s28"><h2 className="ac-title">Order {o.id}</h2><span className="ac-s50">Placed {fmtDate(o.date)} · {o.payment}</span></div>
        <div className="ac-s51">
          <Badge s={o.status} />
          {o.status === 'Delivered' && <button className="ac-btn grad" onClick={() => { if (!printInvoice(o, site)) say('Please allow pop-ups to print the invoice'); }}>⤓ Invoice (PDF)</button>}
          <button className="ac-btn ghost" onClick={() => buyAgain(o.items)}>Buy again</button>
          {['Pending', 'Confirmed'].includes(o.status) && <button className="ac-btn ghost ac-s52" onClick={cancel}>Cancel order</button>}
        </div>
      </div>
      {live ? <LiveTrack d={live} phone={phone} onChanged={() => { loadLive(); reload(); }} /> : (
      <div className="ac-grid2">
        <div className="ac-card ac-s53">
          <b className="ac-s54">Tracking</b>
          {steps.map((s, i) => {
            const h = o.history.find(x => x.s === s);
            const done = o.status === 'Cancelled' ? true : i <= idx;
            return (
              <div key={s} className="ac-s55">
                <div className="ac-s56">
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: done ? 'oklch(0.55 0.17 258)' : '#fff', border: '2px solid ' + (done ? 'oklch(0.55 0.17 258)' : '#cfd5e1'), marginTop: 3 }} />
                  {i < steps.length - 1 && <span style={{ flex: 1, width: 2, minHeight: 26, background: done && (o.status === 'Cancelled' || i < idx) ? 'oklch(0.55 0.17 258)' : '#e6e9f0' }} />}
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, color: done ? '#16181d' : '#9aa1b2', paddingBottom: 20 }}>{s}</span>
                <span className="ac-s57">{h ? fmtTime(h.at) : ''}</span>
              </div>
            );
          })}
        </div>
        <div className="ac-s18">
          <div className="ac-card ac-s58">
            <b className="ac-s59">Items</b>
            {o.items.map(i => <div key={i.id} className="ac-s60"><Thumb src={i.img} size={48} /><span>{i.name} <span className="ac-s61">× {i.qty}</span>{i.backorder > 0 && <b className="ac-s62"> (+{i.backorder} to follow)</b>}</span><b>{fmt(i.price * i.qty)}</b></div>)}
            <div className="ac-s63">
              <div className="ac-sum"><span>Subtotal</span><span>{fmt(o.subtotal)}</span></div>
              <div className="ac-sum"><span>Discount</span><span>− {fmt(o.discount)}</span></div>
              <div className="ac-sum"><span>Delivery</span><span>{o.delivery ? fmt(o.delivery) : 'Free'}</span></div>
              <div className="ac-sum ac-s64"><span className="ac-s65">Total</span><span>{fmt(o.total)}</span></div>
            </div>
          </div>
          <div className="ac-card ac-s66">
            <b className="ac-s67">Delivery address</b>
            <span><b>{o.customer.name}</b> · {o.customer.phone}</span><span>{o.address}</span>
            <span className="ac-s50">{o.area === 'outside' ? 'Outside Dhaka' : o.area === 'suburb' ? 'Dhaka suburbs' : 'Inside Dhaka'}{o.slot ? ' · ' + o.slot : ''}</span>
            {o.note && <span className="ac-s50">Note: {o.note}</span>}
          </div>
        </div>
      </div>
      )}
    </>
  );
}
