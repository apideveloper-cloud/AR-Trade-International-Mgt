import { fmt } from '../../api.js';
import { ZONE, bgImage } from './constants.js';
import { CouponBox, Row } from './parts.jsx';

/** Order summary beside the checkout form. `c` is the checkout context (see CheckoutPage). */
export default function SummaryAside({ c }) {
  const { t, district, user, site, setLoginOpen, coupon, setCoupon, busy, online, pendingQuote, shownTotal } = c;
  const delivery = pendingQuote ? 'By distance' : t.delivery ? fmt(t.delivery) : 'Free';
  return (
    <aside className="summary">
      <span className="sum-t">Order summary <em>{t.lines.length} item{t.lines.length > 1 ? 's' : ''}</em></span>
      {t.lines.map(l => (
        <div key={l.id} className="ct-sum-row">
          <div className="ct-sum-img" style={bgImage(l.img)} />
          <span className="ct-sum-name">{l.name} × {l.qty}</span><b>{fmt(l.price * l.chargeQty)}</b>
        </div>
      ))}
      <CouponBox value={coupon} onChange={setCoupon} ok={t.okCoupon} />
      {!user && <button type="button" onClick={() => setLoginOpen(true)} className="ct-member"><b>Members save {site.memberPct}% extra.</b> Sign in to apply member pricing →</button>}
      <div className="r ct-sub-r"><span>Subtotal</span><span>{fmt(t.subtotal)}</span></div>
      {t.discount > 0 && <Row k="Coupon" v={'− ' + fmt(t.discount)} cls="ct-green" />}
      {t.member > 0 && <Row k={`Member price (${t.memberPct}%)`} v={'− ' + fmt(t.member)} cls="ct-green" />}
      <Row k={'Delivery · ' + (district ? ZONE[t.zone] : 'select district')} v={delivery} />
      <div className="tot"><b className="ct-tot-l">Total</b><b>{fmt(shownTotal)}</b></div>
      <span className="ct-vat-note">Excluding all Govt VAT &amp; taxes</span>
      <button className="btn btn-blue ct-place" disabled={busy}>{busy ? 'Placing order…' : online ? 'Pay & place order' : 'Place order'}</button>
      <div className="trust"><span>🔒 Secure checkout</span><span>🚚 Fast delivery</span><span>✓ Genuine products</span></div>
      <span className="ct-call">We will call you on your mobile number to confirm this order.</span>
    </aside>
  );
}
