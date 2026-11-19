/** Two-column regular/offer price table for the servicing list. */
export function ServicePrices({ prices, onChange }) {
  return (
    <div className="svc-two">
      <div className="svc-row svc-head"><span>Service</span><span>Regular</span><span>Offer</span></div>
      <div className="svc-row svc-head svc-h2"><span>Service</span><span>Regular</span><span>Offer</span></div>
      {prices.map((p, i) => (
        <div key={p.t} className="svc-row">
          <span className="svc-n"><i>{i + 1}</i>{p.t}</span>
          <span className="adorn"><i>৳</i><input className="a-input" type="number" title="Regular" value={p.reg} onChange={e => onChange(i, 'reg', e.target.value)} /></span>
          <span className="adorn"><i>৳</i><input className="a-input" type="number" title="Offer" value={p.offer} onChange={e => onChange(i, 'offer', e.target.value)} /></span>
        </div>
      ))}
    </div>
  );
}
