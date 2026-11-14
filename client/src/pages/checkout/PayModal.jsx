import { fmt } from '../../api.js';
import { PAY_HERO } from '../../data.js';

/** The (demo) payment screen shown for online payment methods. No money is charged. */
export default function PayModal({ pay, gw, total, busy, onPay, onCancel }) {
  return (
    <div className="modal-bg">
      <div className="paybox">
        <div className="hero2" style={{ background: PAY_HERO[pay] || PAY_HERO.Card }}><span className="ct-pay-hero-t">Secure payment · demo</span><b>{pay === 'Card' ? gw : pay}</b></div>
        <div className="bd">
          <div className="ct-pay-row"><span className="ct-pay-co">AR Trade International</span><b className="ct-pay-amt">{fmt(total)}</b></div>
          <span className="ct-pay-demo">{pay === 'Card' ? `You would enter card details on the ${gw} secure page.` : `You would enter your ${pay} number, OTP and PIN on the ${pay} payment page.`} Demo only — no money is charged.</span>
          <button className="btn btn-dark btn-pill ct-pad14" onClick={onPay} disabled={busy}>Pay {fmt(total)}</button>
          <button onClick={onCancel} className="ct-cancel">Cancel and go back</button>
        </div>
      </div>
    </div>
  );
}
