import { fmt } from '../../api.js';

/** Standard / express choice for orders inside Dhaka. `c` is the checkout context (see CheckoutPage). */
export default function DeliveryMethod({ c }) {
  const { exOn, setExpress, stdFee, site, codOn } = c;
  return (
    <div className="dmeth">
      <span className="ct-label13">Delivery method</span>
      <div className="dmeth-grid" role="radiogroup" aria-label="Delivery method">
        <button type="button" role="radio" aria-checked={!exOn} className={'dopt' + (!exOn ? ' on' : '')} onClick={() => setExpress(false)}>
          <span className="dopt-ic std">🚚</span>
          <span className="ct-express-col">
            <span className="ex-ttl"><b className="ct-fs14">Standard delivery</b><span className="ex-badge std">same / next day</span></span>
            <span className="ct-express-d">Brought to your door by our own rider</span>
          </span>
          <span className="ex-fee">{stdFee}</span>
          <span className="dopt-rad" aria-hidden="true"><i /></span>
        </button>
        <button type="button" role="radio" aria-checked={exOn} className={'dopt xp' + (exOn ? ' on' : '')} onClick={() => setExpress(true)}>
          <span className="dopt-ic">⚡</span>
          <span className="ct-express-col">
            <span className="ex-ttl"><b className="ct-fs14">Express delivery</b><span className="ex-badge">within 3 hours</span></span>
            <span className="ct-express-d">For urgent toner and cartridges inside Dhaka</span>
          </span>
          <span className="ex-fee">+ {fmt(site.expressFee)}</span>
          <span className="dopt-rad" aria-hidden="true"><i /></span>
        </button>
      </div>
      {codOn && <span className="cod-pill">✓ Cash on delivery available</span>}
    </div>
  );
}
