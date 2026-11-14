import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmt } from '../../api.js';
import CheckoutSteps from '../../components/CheckoutSteps.jsx';
import Fireworks from '../../components/Fireworks.jsx';
import { deliveryOf } from '../../data.js';
import { printInvoice } from '../../invoice.js';
import { useStore } from '../../store.jsx';
import AccountOffer from './AccountOffer.jsx';
import { LAST_ORDER_KEY, loginKey, readSession } from './constants.js';

/** Name of the courier on a placed order, whichever shape the server stored it in. */
function partnerName(o, site) {
  if (o.shipPartnerName) return o.shipPartnerName;
  if (typeof o.shipPartner === 'object') return o.shipPartner.name;
  return deliveryOf(site).partners.find(p => p.id === o.shipPartner)?.name || o.shipPartner;
}

/** Order number, total, payment and delivery of the placed order. */
function Ticket({ o }) {
  return (
    <div className="ok-ticket">
      <div className="ok-t-top"><span>Order number</span><b>{o.id}</b></div>
      <div className="ok-t-grid">
        <div><span>Total</span><b>{fmt(o.total)}</b></div>
        <div><span>Payment</span><b>{o.payment}</b></div>
        <div><span>Delivery</span><b>{o.delivery ? fmt(o.delivery) : 'Free'}</b></div>
      </div>
    </div>
  );
}

/** Order-placed page. Without the order saved in this browser session it only shows a neutral thank-you. */
export default function SuccessPage() {
  const { id } = useParams();
  const { site, say, user } = useStore();
  const [o] = useState(() => { const s = readSession(LAST_ORDER_KEY); return s?.id === id ? s : null; });
  const [hasLogin, setHasLogin] = useState(() => !!readSession(loginKey(id))); // a generated login is on screen
  // fireworks play once per freshly placed order, not again on every refresh of this page
  const [fx] = useState(() => { try { const k = 'ar_fx_' + id; if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, '1'); return true; } catch { return true; } });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  if (!o) {
    return <div className="success"><h1>Thank you!</h1><p>Thank you. If you have just placed an order, you can follow it in your account.</p><Link className="btn btn-dark btn-pill ct-pad14-24" to="/account/orders">View my orders</Link></div>;
  }
  const back = o.items.filter(i => i.backorder > 0);
  return (
    <section className="success">
      {fx && <Fireworks />}
      <div className="ct-flex"><CheckoutSteps step={3} /></div>
      <div className={'ok-cols' + (!user || hasLogin ? ' two' : '')}>
        <div className="ok-left">
          <h1 className="ok-h1">Order placed!</h1>
          <p className="ct-succ-p">Thank you, <b>{o.customer.name}</b>. We will call <b>{o.customer.phone}</b> shortly to verify your order.</p>
          <Ticket o={o} />
          {o.hold && <div className="ct-succ-note ct-succ-hold">⏸ {o.holdNote}. We'll call you to confirm before dispatch.</div>}
          {back.length > 0 && <div className="ct-succ-note ct-succ-back">{(o.partial === 'together' ? 'We will ship everything together once these are restocked: ' : 'Shipping available items now. To follow: ') + back.map(i => `${i.backorder} × ${i.name.split(' (')[0]}`).join(', ')}</div>}
          <div className="ct-succ-info"><span className="info-pill">🚚 {o.slot || 'Standard delivery'}</span>{o.distanceKm != null && <span className="info-pill">📍 Delivery: {Number(o.distanceKm).toFixed(1)} km · {o.delivery ? fmt(o.delivery) : 'Free'}</span>}{o.shipPartner && <span className="info-pill">📦 Shipping partner: {partnerName(o, site)}</span>}<span className="info-pill">{o.payStatus === 'Paid' ? '✓ Paid · ' + o.payment : 'Payment: ' + o.payment}</span></div>
        </div>
        {(!user || hasLogin) && <div className="ok-right"><AccountOffer order={o} onLoginChange={setHasLogin} /></div>}
      </div>
      <div className="ok-actions">
        <div className="ct-succ-btns">
          <button className="btn btn-pill ct-btn-inv" onClick={() => { if (!printInvoice(o, site)) say('Allow pop-ups to download the invoice'); }}>⤓ Invoice (PDF)</button>
        </div>
        <div className="ct-succ-btns">
          <Link className="btn btn-dark btn-pill ct-pad14-24" to={`/account/orders/${o.id}`}>Track this order</Link>
          <Link className="btn btn-ghost btn-pill ct-btn-cont" to="/shop/all">Continue shopping</Link>
        </div>
      </div>
    </section>
  );
}
