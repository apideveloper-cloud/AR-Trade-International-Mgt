import { useEffect, useRef } from 'react';
import { fmt } from '../../api.js';
import { showMobile } from '../../phone.js';
import { bgImage } from './constants.js';
import { fullAddress } from './helpers.js';

/**
 * Last look before the order is placed. `review` is the checked form, `info` holds { t, area, dest, exOn, partnerName, payName, online, busy }.
 * The heading takes focus when the page opens.
 */
export default function ReviewPage({ review, info, onEdit, onConfirm }) {
  const { t, area, dest, exOn, partnerName, payName, online, busy } = info;
  const head = useRef(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, []);
  const edit = <button type="button" className="rvw2-ed" onClick={onEdit}>Edit</button>;
  return (
    <div className="rvw2-page">
      <div className="rvw2-top"><span className="rvw2-step">Step 2 of 3 · Review</span><h2 id="rvw2-t" ref={head} tabIndex={-1}>Review your order</h2><span>Check everything once, then confirm. You can still edit.</span></div>
      <div className="rvw2-grid">
        <div className="rvw2-main">
          <div className="rvw2-det rvw2-two">
            <div className="rvw2-r"><i className="rvw2-ic" aria-hidden="true">👤</i><div className="rvw2-c"><h4>Contact</h4><p><b>{review.name}</b></p><p>{showMobile(review.phone)}{review.email ? ' · ' + review.email : ''}</p></div>{edit}</div>
            <div className="rvw2-r"><i className="rvw2-ic" aria-hidden="true">📍</i><div className="rvw2-c"><h4>Delivery address</h4><p>{fullAddress(review)}</p><p className="rvw2-m">{area === 'inside' ? (dest ? `${Number(dest.km).toFixed(1)} km from our office` : 'Inside Dhaka') : `Courier: ${partnerName || '—'}`}{exOn ? ' · Express (within 3 hours)' : ' · Standard delivery'}</p>{review.note ? <p className="rvw2-note">Note: {review.note}</p> : null}</div>{edit}</div>
          </div>
          <div className="rvw2-det rvw2-itm">
            <div className="rvw2-ih"><h4>Items · {t.count}</h4></div>
            <ul className="rvw2-items">{t.lines.map(l => <li key={l.id}><i className="rvw2-th" style={bgImage(l.img)} /><span>{l.name}<small>Qty {l.chargeQty}</small></span><b>{fmt(l.price * l.chargeQty)}</b></li>)}</ul>
          </div>
        </div>
        <div className="rvw2-side">
          <div className="rvw2-det rvw2-pay">
            <div className="rvw2-r"><i className="rvw2-ic" aria-hidden="true">💳</i><div className="rvw2-c"><h4>Payment</h4><p>{payName}</p></div>{edit}</div>
          </div>
          <aside className="rvw2-sum">
            <h4>Order summary</h4>
            <div className="rvw2-row"><span>Subtotal</span><span>{fmt(t.subtotal)}</span></div>
            {t.discount > 0 && <div className="rvw2-row g"><span>Coupon</span><span>− {fmt(t.discount)}</span></div>}
            {t.member > 0 && <div className="rvw2-row g"><span>Member price</span><span>− {fmt(t.member)}</span></div>}
            <div className="rvw2-row"><span>Delivery{exOn ? ' (express)' : ''}</span><span>{t.delivery ? fmt(t.delivery) : 'Free'}</span></div>
            <div className="rvw2-tot"><span>Total</span><b>{fmt(t.total)}</b></div>
            <small className="rvw2-m">Excluding all Govt VAT &amp; taxes</small>
            <div className="rvw2-btns">
              <button type="button" className="btn btn-blue ct-place rvw2-ok" onClick={onConfirm} disabled={busy}>{online ? 'Confirm & pay' : 'Confirm order'}</button>
              <button type="button" className="rvw2-edit" onClick={onEdit}>✎ Edit</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
