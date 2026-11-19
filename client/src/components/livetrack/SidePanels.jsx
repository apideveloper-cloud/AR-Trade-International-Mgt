import { fmt } from '../../api.js';

/** Rider name, vehicle, rating and call button. */
export function RiderCard({ rider }) {
  return (
    <div className="lt-box lt-pad16">
      <span className="lt-eyebrow">YOUR RIDER</span>
      <div className="lt-rider-row">
        <span className="lt-avatar">{rider.name.split(' ').map(x => x[0]).join('')}</span>
        <div className="lt-rider-info"><b>{rider.name}</b><span className="lt-muted12">{rider.vehicle}</span><span className="lt-rating">★ {rider.rating}</span></div>
        <a href={'tel:' + rider.phone} className="lt-call">Call</a>
      </div>
    </div>
  );
}

/** Delivery OTP the customer shares with the rider. */
export function OtpCard({ otp }) {
  return (
    <div className="lt-box lt-otp">
      <span className="lt-eyebrow">DELIVERY OTP</span>
      <span className="mono lt-otp-code">{otp}</span>
      <span className="lt-muted12">Share only after you receive and check the parcel.</span>
    </div>
  );
}

/** Order lines, total and delivery address. */
export function OrderCard({ d }) {
  return (
    <div className="lt-box lt-order">
      <b className="lt-title">Order</b>
      {d.items.map(i => <div key={i.id} className="lt-line"><span className="lt-line-name">{i.qty} × {i.name}</span><b>{fmt(i.price * i.qty)}</b></div>)}
      <div className="lt-total"><span>Total · {d.payment}</span><span>{fmt(d.total)}</span></div>
      <span className="lt-muted12">Deliver to: {d.address}</span>
    </div>
  );
}

/** Return request form with eligibility hint. */
export function ReturnForm({ reasons, reason, setReason, eligible, why, msg, onAsk }) {
  return (
    <div className="lt-box lt-pad16">
      <b className="lt-title">Return or replace</b>
      <select className="lt-select" value={reason} onChange={e => setReason(e.target.value)}>{reasons.map(r => <option key={r}>{r}</option>)}</select>
      <span className={'lt-why' + (eligible ? ' ok' : '')}>{why}</span>
      {msg && <span className="lt-err">{msg}</span>}
      <button className={'btn btn-pill lt-ask' + (eligible ? ' ok' : '')} disabled={!eligible} onClick={onAsk}>Request return</button>
    </div>
  );
}

/** Status of an existing return request. */
export function ReturnStatus({ ret }) {
  return <div className="lt-ret">Return {ret.status.toLowerCase()}{ret.mode ? ' (' + ret.mode.toLowerCase() + ')' : ''} · {ret.reason}</div>;
}
