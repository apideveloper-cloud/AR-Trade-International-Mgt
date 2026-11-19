/** The three trust cards under the gallery. */
export default function TrustCards({ warranty }) {
  return (
    <div className="trust">
      <div><i>✓</i><span><b>100% genuine</b><span>{warranty ? 'Original, warranty backed' : 'Original product'}</span></span></div>
      <div><i>⚡</i><span><b>Fast delivery</b><span>Same-day in Dhaka</span></span></div>
      <div className={'wty ' + (warranty ? 'yes' : 'no')}><i>{warranty ? '🛡' : '✕'}</i><span><b>Warranty available</b><span>{warranty ? 'Yes' : 'No'}</span></span></div>
    </div>
  );
}
