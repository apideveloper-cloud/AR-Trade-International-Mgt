/** Ticker strip repeated three times, as on the storefront. */
const TickerRun = ({ text }) => <div><span>{text}</span><i>◆</i><span>{text}</span><i>◆</i><span>{text}</span><i>◆</i></div>;

/** Big sample of one piece of storefront text, shown from the Preview button next to a field. */
export function PvSample({ kind, s }) {
  if (kind === 'ticker') {
    return (
      <>
        <p className="pv-note">The ticker runs along the very top of every page{!s.showPromo ? ' (it is switched off at the moment, so visitors do not see it)' : ''}.</p>
        <div className="pv-frame">
          <div className={'pv-ticker big' + (s.showPromo ? '' : ' off')}><TickerRun text={s.promo} /></div>
          <div className="pv-fake"><i style={{ width: 120 }} /><i style={{ width: '38%' }} /><i style={{ width: 70 }} /></div>
        </div>
      </>
    );
  }
  if (kind === 'hero') return <div className="pv-hero big"><b>{s.heroTitle || 'Headline'}</b><span>{s.heroSub}</span><div className="pv-btns"><i>Shop now →</i><i>Our services</i></div></div>;
  return <div className="pv-offer big"><b>{s.offerTitle || 'Headline'}</b><span>{s.offerSub}</span><div className="pv-btns"><i>Create an account →</i></div></div>;
}

/** What the website will show for the top ticker, the home banner and the offer banner; updates as the admin types. */
export function PromoViewer({ s }) {
  return (
    <div className="a-card pv">
      <div className="card-hd"><h3>Promo viewer</h3><span className="chip">live preview · updates as you type</span></div>
      <div className="pv-label">Top promo ticker{!s.showPromo && <em>hidden: the ticker is switched off</em>}</div>
      <div className={'pv-ticker' + (s.showPromo ? '' : ' off')}><TickerRun text={s.promo} /></div>
      <div className="pv-pair">
        <div><div className="pv-label">Home banner</div><div className="pv-hero"><b>{s.heroTitle || 'Headline'}</b><span>{s.heroSub}</span></div></div>
        <div><div className="pv-label">Offer banner</div><div className="pv-offer"><b>{s.offerTitle || 'Headline'}</b><span>{s.offerSub}</span></div></div>
      </div>
    </div>
  );
}
