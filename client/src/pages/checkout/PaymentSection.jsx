import { PAY } from '../../data.js';
import { GATEWAYS } from './constants.js';

/** Checkout step 3: payment method (and card gateway). `c` is the checkout context (see CheckoutPage). */
export default function PaymentSection({ c }) {
  const { site, pay, setPay, gw, setGw, online } = c;
  const payOpts = PAY.filter(([k]) => site.payments[k] !== false);
  const payNote = online ? "You'll confirm the payment on the next screen. Demo only — no money is charged." : pay === 'COD' ? 'Pay cash or bKash to the rider when your order arrives.' : 'We email bank details with your invoice. Dispatch after payment clears.';
  return (
    <div className="cardbox2">
      <div className="co-h"><i>3</i><div><b>Payment</b><small>Pick how you would like to pay</small></div></div>
      <div className="ct-pay-grid">
        {payOpts.map(([k, tt, d, [logo, fs, bg, img]]) => (
          <button type="button" key={k} className={'pay' + (pay === k ? ' on' : '')} onClick={() => setPay(k)}>
            <span className={'logo2' + (img ? ' img' : '')} style={img ? undefined : { background: bg, fontSize: fs }}>{img ? <img src={img} alt={tt} /> : logo}</span>
            <span className="ct-pay-col"><b>{tt}</b><small>{d}</small></span>
            <span className="rad"><i /></span>
          </button>
        ))}
      </div>
      {pay === 'Card' && (
        <div className="ct-col8">
          <span className="ct-label13">Card gateway <span className="ct-gw-sub">· Visa, Mastercard, Amex, DBBL Nexus</span></span>
          <div className="ct-wrap8">{GATEWAYS.map(g => <button type="button" key={g} className={'slot-t ct-gw-btn' + (gw === g ? ' on' : '')} onClick={() => setGw(g)}>{g}</button>)}</div>
        </div>
      )}
      <span className="ct-note">{payNote}</span>
    </div>
  );
}
