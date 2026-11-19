import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store.jsx';

/** Weekly price-alert email sign-up with validation. */
export default function PriceAlert() {
  const { optIn, subscribed, say } = useStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    const v = email.trim();
    const bad = m => { setErr(m); say(m); }; // red message under the field and a toast
    if (!v) return bad('Please enter your email address.');
    if (!/^\S+@\S+\.\S+$/.test(v)) return bad('That email does not look right. Try name@company.com');
    setErr('');
    try { await optIn(v, 'Footer newsletter'); setSent(v); } catch (er) { bad(er.message); }
  };
  return (
    <section className="sec hm-alert-sec">
      <div className="alert">
        <span className="ring" />
        <div className="l">
          <span className="mail"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg></span>
          <div className="hm-alert-copy">
            <span className="tg">WEEKLY PRICE ALERTS</span>
            <h3>Get toner price drops <span className="hm-alert-accent">before anyone else.</span></h3>
            <span className="hm-alert-note">One email every Friday. Deals, new arrivals, no spam.</span>
          </div>
        </div>
        <div className="hm-rel">
          {!sent && !subscribed ? (
            <>
              <form className={'sub-form' + (err ? ' bad' : '')} onSubmit={submit} noValidate>
                <input type="email" placeholder="you@company.com" value={email} aria-invalid={!!err} aria-label="Email address" onChange={e => { setEmail(e.target.value); setErr(''); }} />
                <button type="submit">Subscribe →</button>
              </form>
              {err && <div className="form-err" role="alert">⚠ {err}</div>}
              <div className="fine"><span>By subscribing you agree to our <Link to="/policy/privacy">privacy policy</Link> ·</span><span>✓ Friday deals</span><span>✓ New arrivals</span><span>✓ Unsubscribe anytime</span></div>
            </>
          ) : (
            <div className="hm-sent">
              <b className="hm-sent-title">✉ Almost there — check your inbox</b>
              <span className="hm-sent-note">We sent a confirmation link{sent && <> to <b>{sent}</b></>}. Click it to start receiving deals.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
