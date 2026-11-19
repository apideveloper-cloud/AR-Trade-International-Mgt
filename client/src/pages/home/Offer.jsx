import { useState } from 'react';
import { Link } from 'react-router-dom';
import { copyText } from '../../api.js';
import { useStore } from '../../store.jsx';

/** Cash-back offer banner with copyable coupon code. */
export default function Offer() {
  const { site, user, setLoginOpen } = useStore();
  const [copied, setCopied] = useState(false);
  const copy = () => copyText(site.coupon).then(ok => { if (ok) setCopied(true); });
  return (
    <section className="sec">
      <div className="offer">
        <span className="glow" /><span className="ring" />
        <div className="hm-col-18">
          <span className="pill-k">Cash-back offer · 2026</span>
          <h2>{site.offerTitle}</h2>
          <p className="hm-offer-sub">{site.offerSub}</p>
          <div className="hm-offer-btns">
            <Link to="/offers" className="btn hm-offer-btn hm-offer-white">See all offers →</Link>
            {!user && <button className="btn hm-offer-btn hm-offer-ghost" onClick={() => setLoginOpen(true)}>Create account</button>}
          </div>
        </div>
        <div className="hm-col-12">
          <div className="ticket">
            <div><small>FIRST ORDER</small><b className="hm-ticket-blue">5%</b><span>off when you order online</span></div>
            <div><small>NEXT ORDER</small><b className="hm-ticket-navy">10%</b><span>off for registered customers</span></div>
          </div>
          <div className="coupon"><div className="c"><small>Use code</small><b>{site.coupon}</b></div><button onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button></div>
          <div className="paywith"><span>Pay with</span><span>bKash</span><span>Nagad</span><span>Upay</span><span>Cash on delivery</span></div>
        </div>
      </div>
    </section>
  );
}
