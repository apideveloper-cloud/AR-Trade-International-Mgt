import { fmt } from '../../api.js';

const TRACK = ['Order placed', 'Confirmation call', 'Packed & dispatched', 'Delivered'];

/** The "Delivery & warranty" tab: fee table, order tracker and warranty cover. */
export default function DeliveryWarranty({ dlv, site }) {
  return (
    <div className="dw">
      <section className="dw-card">
        <header><h3>Delivery options</h3><span>Cash on delivery available</span></header>
        <table>
          <thead><tr><th>Destination</th><th>Delivery time</th><th>Fee</th></tr></thead>
          <tbody>
            <tr><td><b>Inside Dhaka</b><small>Order before 2 PM for same-day</small></td><td>Same day</td><td><em className="free">FREE</em> within {dlv.freeKm} km<small>then {fmt(dlv.tiers[0].fee)} up to {fmt(dlv.maxFee)} by distance</small></td></tr>
            <tr><td><b>Outside Dhaka</b><small>Courier, on condition</small></td><td>1–3 working days</td><td>{fmt(site.outsideFee)}</td></tr>
          </tbody>
        </table>
        <ol className="dw-track">
          {TRACK.map((t, i) => <li key={t}><i>{i + 1}</i><span>{t}</span></li>)}
        </ol>
      </section>
      <section className="dw-card">
        <header><h3>Warranty &amp; returns</h3><span>100% original products</span></header>
        <div className="dw-cols">
          <div><h4 className="ok">Covered</h4><ul><li>Manufacturer defects</li><li>Warranty per manufacturer &amp; BCS policy</li><li>Genuine, sealed original stock</li></ul></div>
          <div><h4 className="no">Not covered</h4><ul><li>Physical damage</li><li>Water damage</li><li>Burn damage</li></ul></div>
        </div>
        <div className="dw-foot"><i>i</i>Prices of tech products may change without notice due to market volatility.</div>
      </section>
    </div>
  );
}
