import './overlays.css';

/** Dark brand panel on the left of the login modal (pitch + perks). */
export default function LoginSide() {
  return (
    <div className="l">
      <span className="o1" /><span className="o2" />
      <div className="ov-login-brand">
        <img className="ov-login-logo" src="/ar-icon-round.png" alt="AR Trade" />
        <span className="ov-login-brand-text">
          <b className="ov-login-brand-name">AR Trade International</b>
          <small className="ov-login-brand-sub">Since 2011 · Dhaka</small>
        </span>
      </div>
      <div className="ov-login-pitch">
        <b className="ov-login-pitch-title">Your AR Trade account.</b>
        <span className="ov-login-pitch-text">Track deliveries, re-order toner in one tap and follow your servicing requests.</span>
      </div>
      <ul className="lg-perks"><li><i>৳</i><span><b>5% off online orders</b><small>and 10% on your next one</small></span></li><li><i>⚑</i><span><b>Live order tracking</b><small>from packing to your door</small></span></li><li><i>♡</i><span><b>Saved printer models &amp; wishlist</b><small>re-order toner in one tap</small></span></li></ul>
    </div>
  );
}
