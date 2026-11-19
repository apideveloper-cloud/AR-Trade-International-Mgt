import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { popupAllowed, popupOpen } from '../../popupBus.js';
import { useStore } from '../../store.jsx';
import PopupShell from './PopupShell.jsx';
import usePopupSlot from './usePopupSlot.js';
import './overlays.css';

/** Newsletter popup: after a delay and on exit intent (once per session), then the double opt-in demo mail. */
export default function NewsletterPopup() {
  const { content, optIn, subscribed, optMail, say, site } = useStore();
  const [mode, setMode] = useState(null);
  const [err, setErr] = useState('');
  const pp = content.popup || { on: true, delay: 30, exit: true };
  const pmode = site.popupMode || 'one';
  const delay = Number(site.nlDelay ?? pp.delay ?? 30);
  const exitOn = site.nlExit ?? pp.exit;

  useEffect(() => {
    if (!pp.on || pmode === 'off') return undefined;
    let done = false;
    const show = m => {
      if (done) return;
      try { if (sessionStorage.getItem('ar_nl_seen')) { done = true; return; } } catch { /* storage unavailable */ }
      if (subscribed || optMail) return;
      if (!popupAllowed('newsletter', pmode)) return; // another popup is open (or this visit already had one): never stack
      try { sessionStorage.setItem('ar_nl_seen', '1'); } catch { /* storage unavailable */ }
      done = true; popupOpen('newsletter'); setMode(m);
    };
    // the timed popup waits politely until nothing else is open
    let t = setTimeout(function tick() { show('timed'); if (!done) t = setTimeout(tick, 4000); }, Math.max(1, delay) * 1000);
    const out = e => { if (exitOn && !e.relatedTarget && e.clientY <= 0) show('exit'); };
    document.addEventListener('mouseout', out);
    return () => { done = true; clearTimeout(t); document.removeEventListener('mouseout', out); };
  }, [pp.on, pmode, delay, exitOn, subscribed, optMail]);
  usePopupSlot('newsletter', !!mode);

  if (!mode) return null;
  const close = () => setMode(null);
  const submit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get('email') || '').trim();
    const bad = m => { setErr(m); say(m); }; // red message in the form and a toast
    if (!email) return bad('Please enter your email address.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return bad('That email does not look right. Try name@company.com');
    if (!fd.get('agree')) return bad('Please tick the box to agree to receive emails.');
    setErr('');
    try { await optIn(email, mode === 'exit' ? 'Exit-intent popup' : 'Newsletter popup'); close(); } catch (er) { bad(er.message); }
  };
  return (
    <PopupShell onClose={close} bgClass="ov-nl-bg" panelClass="nl">
      <button className="x" onClick={close} title="Close" aria-label="Close">×</button>
      <div className="l">
        <img className="ov-nl-logo" src="/ar-icon-round.png" alt="AR Trade" />
        <div className="ov-nl-offer">
          <span className="ov-nl-kicker">Welcome offer</span>
          <span className="ov-nl-big">10%<span className="ov-nl-big-off"> off</span></span>
          <span className="ov-nl-sub">your first order of toner, ink &amp; printers.</span>
        </div>
        <span className="ov-nl-note">Code unlocks after you confirm your email.</span>
      </div>
      <form className="r" onSubmit={submit} noValidate>
        <h3>{mode === 'exit' ? 'Wait — before you go.' : 'Join the AR Trade list.'}</h3>
        <span className="ov-nl-text">Get 10% off your first order, plus Friday deals and refill reminders. One or two emails a week, at most.</span>
        <input name="email" type="email" placeholder="you@company.com" aria-label="Email address" onChange={() => setErr('')} className={'ov-nl-input' + (err ? ' is-err' : '')} />
        <label className="ov-nl-agree">
          <input type="checkbox" name="agree" onChange={() => setErr('')} className="ov-nl-check" />
          <span>I agree to receive marketing emails from AR Trade International. I can unsubscribe anytime. See our <Link to="/policy/privacy" onClick={close} className="ov-nl-policy">privacy policy</Link>.</span>
        </label>
        {err && <div className="form-err ov-nl-err" role="alert">⚠ {err}</div>}
        <button className="btn btn-grad btn-pill ov-nl-send">Send my 10% code</button>
        <button type="button" onClick={close} className="ov-nl-later">No thanks, I'll pay full price</button>
      </form>
    </PopupShell>
  );
}
