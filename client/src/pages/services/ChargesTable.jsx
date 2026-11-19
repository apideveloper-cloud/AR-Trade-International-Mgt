import { fmt } from '../../api.js';

/** "Service charges" card: regular vs offer price per service. */
export default function ChargesTable({ prices }) {
  return (
    <div className="white-card">
      <h2 className="t">Service charges</h2>
      <div className="svc-row hd"><span>Service</span><span className="sv-r">Regular</span><span className="sv-r">Offer</span></div>
      {prices.map(s => (
        <div className="svc-row" key={s.t}>
          <div className="sv-row-t"><span className="sv-row-name">{s.t}</span><span className="bn sv-row-bn">{s.bn}</span></div>
          <span className="sv-reg">{fmt(s.reg)}</span>
          <span className="sv-offer">{fmt(s.offer)}</span>
        </div>
      ))}
      <span className="sv-note">Charges may vary by location.</span>
    </div>
  );
}
