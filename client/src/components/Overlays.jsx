import { useEffect, useState } from 'react';
import { productPath } from '../slug.js';
import Social from './Social.jsx';
import { popupAllowed, popupClose, popupOpen } from '../popupBus.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, copyText, fmt, offPct } from '../api.js';
import { useStore } from '../store.jsx';

const TOAST_ICON = {
  success: <path className="draw" d="M5 12.5l4.5 4.5L19 7.5" />,
  error: <><path d="M12 7v6.5" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></>,
  info: <><path d="M12 11v6" /><circle cx="12" cy="7.6" r=".6" fill="currentColor" /></>,
  cart: <><path d="M5 7h14l-1.4 9.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 7z" /><path d="M9 7V6a3 3 0 0 1 6 0v1" /></>
};
const TOAST_TITLE = { success: 'All done', error: 'Please check', info: 'Heads up', cart: 'Added to cart' };

/** Pop-up notice: coloured icon badge, title + message, a countdown bar and a close button. */
export function Toast() {
  const { toast, dismissToast } = useStore();
  if (!toast) return null;
  const k = toast.kind || 'info';
  const text = k === 'cart' ? toast.text.replace(/^Added:\s*/i, '') : toast.text;
  return (
    <div className={'toast t-' + k} key={toast.id} role={k === 'error' ? 'alert' : 'status'} aria-live="polite" style={{ '--dur': (toast.ms || 3200) + 'ms' }}>
      <i className="ti"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{k === 'error' || k === 'info' ? <circle cx="12" cy="12" r="9.2" strokeWidth="2" /> : null}{TOAST_ICON[k]}</svg></i>
      <div className="tx"><b>{TOAST_TITLE[k]}</b><span>{text}</span></div>
      {toast.link && <Link to={toast.link} onClick={dismissToast}>View cart</Link>}
      <button type="button" className="tc" onClick={dismissToast} aria-label="Dismiss">×</button>
      <u className="tb" />
    </div>
  );
}

export function CompareBar() {
  const { compare, setCompare, find } = useStore();
  const { pathname } = useLocation();
  const items = compare.map(find).filter(Boolean);
  if (!items.length || pathname === '/compare') return null;
  return (
    <div className="cmp-bar">
      <b style={{ fontSize: 13 }}>Compare</b>
      <div style={{ display: 'flex', gap: 6 }}>{items.map(p => <span className="th" key={p.id}>{p.img && <img src={p.img} alt="" />}</span>)}</div>
      <Link to="/compare" className="go">Compare {items.length} →</Link>
      <button className="x" title="Clear" aria-label="Clear compare list" onClick={() => setCompare([])}>×</button>
    </div>
  );
}

export function CartDrawer() {
  const { cartOpen, setCartOpen, cartLines, cartCount, cartSubtotal, setQty } = useStore();
  if (!cartOpen) return null;
  const close = () => setCartOpen(false);
  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer">
        <div className="hd">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="ic">⌂</span>
            <div><b>My cart</b><small>{cartCount} items · {fmt(cartSubtotal)}</small></div>
          </div>
          <button className="x" onClick={close} title="Close" aria-label="Close">×</button>
        </div>
        <div className="list">
          {!cartLines.length && (
            <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', color: '#5d6270', fontSize: 14, padding: '40px 10px' }}>
              <span style={{ width: 76, height: 76, borderRadius: '50%', background: '#fff', boxShadow: '0 12px 30px -12px rgba(11,22,49,.3)', display: 'grid', placeItems: 'center', fontSize: 30 }}>⌂</span>
              <b style={{ color: '#0b1631', fontSize: 16 }}>Your cart is empty</b>
              <Link to="/shop/all" onClick={close} className="btn btn-grad">Browse products →</Link>
            </div>
          )}
          {cartLines.map(({ p, qty }) => (
            <div className="dline" key={p.id}>
              <Link to={productPath(p)} onClick={close} className="th">{p.img && <img src={p.img} alt="" />}</Link>
              <div className="mid">
                <Link to={productPath(p)} onClick={close} className="nm clamp2">{p.name}</Link>
                <div className="row2">
                  <div className="q"><button type="button" aria-label="Decrease quantity" onClick={() => setQty(p.id, qty - 1)}>−</button><span>{qty}</span><button type="button" aria-label="Increase quantity" onClick={() => setQty(p.id, qty + 1)}>+</button></div>
                  <b>{fmt(p.price * qty)}</b>
                </div>
              </div>
              <button className="rm" onClick={() => setQty(p.id, 0)} title="Remove" aria-label="Remove item">×</button>
            </div>
          ))}
        </div>
        {cartLines.length > 0 && (
          <div className="ft">
            <div className="sub"><span>Subtotal <span style={{ color: '#9aa1b2', fontWeight: 500 }}>· delivery at checkout</span></span><b>{fmt(cartSubtotal)}</b></div>
            <div className="acts"><Link to="/cart" onClick={close}>View cart</Link><Link to="/checkout" onClick={close}>Checkout →</Link></div>
            <div className="sec2"><span>✓ Secure checkout</span><span>✓ Cash on delivery</span></div>
          </div>
        )}
      </aside>
    </>
  );
}

export function LoginModal() {
  const { loginOpen, setLoginOpen, login, register, user, site } = useStore();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const open = loginOpen || pathname === '/login';
  const [mode, setMode] = useState('login');
  const [sentForgot, setSentForgot] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setErr(''); } if (!open || mode !== 'login') setSentForgot(false); }, [open, mode]);
  if (!open || user) return null;

  const close = () => { setLoginOpen(false); if (pathname === '/login') nav('/'); };
  const done = () => { setLoginOpen(false); nav('/account'); };
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    setErr(''); setBusy(true);
    try {
      if (mode === 'register') {
        if (d.pw !== d.pw2) throw new Error('Passwords do not match.');
        await register({ name: d.name, phone: d.phone, email: d.email, password: d.pw });
      } else await login({ id: d.id, password: d.pw });
      done();
    } catch (e2) { setErr(e2.message); }
    setBusy(false); // this modal stays mounted, so a later sign-in (after signing out) must not find the button still disabled
  };
  const forgot = async e => {
    const id = (e.currentTarget.form.elements.id.value || '').trim();
    if (id.length < 5) return setErr('Enter your mobile number or email above, then tap “Forgot password?”');
    setErr('');
    try { await api.post('/auth/forgot', { id }); setSentForgot(true); } catch (er) { setErr(er.message); }
  };
  const reg = mode === 'register';

  return (
    <div className="login-wrap">
      <div className="login-bg" onClick={close} />
      <div className="login">
        <div className="l">
          <span className="o1" /><span className="o2" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/ar-icon-round.png" alt="AR Trade" style={{ width: 42, height: 42, borderRadius: '50%', boxShadow: '0 0 0 3px rgba(255,255,255,.18)' }} />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <b style={{ fontFamily: 'var(--disp)', fontSize: 15, color: '#fff' }}>AR Trade International</b>
              <small style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9fb3d1' }}>Since 2011 · Dhaka</small>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b style={{ fontFamily: 'var(--disp)', fontSize: 24, letterSpacing: '-.03em', lineHeight: 1 }}>Your AR Trade account.</b>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: '#c9ccd4' }}>Track deliveries, re-order toner in one tap and follow your servicing requests.</span>
          </div>
          <ul className="lg-perks"><li><i>৳</i><span><b>5% off online orders</b><small>and 10% on your next one</small></span></li><li><i>⚑</i><span><b>Live order tracking</b><small>from packing to your door</small></span></li><li><i>♡</i><span><b>Saved printer models &amp; wishlist</b><small>re-order toner in one tap</small></span></li></ul>
        </div>
        <div className="r">
          <button className="x" onClick={close} title="Close" aria-label="Close">✕</button>
          <div className="ltabs">
            <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Sign in</button>
            <button className={reg ? 'on' : ''} onClick={() => setMode('register')}>Register</button>
          </div>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {reg && <label className="llbl">FULL NAME<input name="name" required /></label>}
            {!reg && <label className="llbl">MOBILE OR EMAIL<input name="id" required placeholder="01XXX-XXXXXX or you@mail.com" /></label>}
            {reg && (
              <>
                <label className="llbl">MOBILE<input name="phone" required pattern="01[0-9]{9}" placeholder="01XXXXXXXXX" /></label>
                <label className="llbl">EMAIL<input name="email" type="email" required placeholder="you@mail.com" /></label>
              </>
            )}
            {reg ? (
              <div className="lg-row">
                <label className="llbl">PASSWORD<input name="pw" type="password" required minLength={8} autoComplete="new-password" /></label>
                <label className="llbl">CONFIRM PASSWORD<input name="pw2" type="password" required minLength={8} autoComplete="new-password" /></label>
              </div>
            ) : <label className="llbl">PASSWORD<input name="pw" type="password" required minLength={8} /></label>}
            {reg && <span style={{ fontSize: 11.5, color: '#7a8090' }}>Password: at least 8 characters, with a letter and a number.</span>}
            {err && <span className="err" style={{ padding: '10px 12px', fontSize: 13 }}>{err}</span>}
            {!reg && !sentForgot && <button type="button" onClick={forgot} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, color: 'oklch(0.45 0.16 252)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Forgot password?</button>}
            {sentForgot && <span style={{ fontSize: 12.5, color: 'oklch(0.4 0.12 150)', background: 'oklch(0.96 0.04 150)', padding: '9px 11px', borderRadius: 10, lineHeight: 1.5 }}>Request received. Our team will send you a password reset link on your mobile or email shortly. You can also call {site.phone}.</span>}
            {!reg && <span style={{ fontSize: 12, color: '#7a8090' }}>Demo account: <b>demo@artrade.com</b> / <b>demo123</b></span>}
            <button className="btn btn-dark btn-pill" disabled={busy} style={{ padding: 11, marginTop: 2 }}>{reg ? 'Create account' : 'Sign in'}</button>
          </form>
          <Social onDone={done} onError={setErr} />
        </div>
      </div>
    </div>
  );
}

/** Home-page "Mega Toner Sale" popup, shown once per browser session (as in the design). */
export function PromoPopup() {
  const { pathname } = useLocation();
  const { products, site } = useStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (pathname !== '/') return undefined;
    const mode = site.popupMode || 'one';
    const t = setTimeout(() => {
      try { if (sessionStorage.getItem('arPromoSeen')) return; } catch { /* storage unavailable */ }
      if (popupAllowed('promo', mode)) { popupOpen('promo'); setOpen(true); }
    }, Math.max(0, Number(site.promoDelay ?? 1)) * 1000);
    return () => clearTimeout(t);
  }, [pathname, site.popupMode, site.promoDelay]);
  useEffect(() => { if (open) return () => popupClose('promo'); return undefined; }, [open]);
  if (!open) return null;

  const src = products.filter(p => p.img && p.old && p.price).map(p => ({ p, off: offPct(p) })).sort((a, b) => b.off - a.off);
  const close = () => { try { sessionStorage.setItem('arPromoSeen', '1'); } catch { /* storage unavailable */ } setOpen(false); };
  const copy = () => copyText(site.coupon).then(ok => { if (ok) setCopied(true); });

  return (
    <div className="pop-bg" onClick={close}>
      <div className="promo-pop" onClick={e => e.stopPropagation()}>
        <button className="x" onClick={close} title="Close" aria-label="Close">×</button>
        <div className="promo-card">
          <span className="rays" /><span className="glow" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span className="brandpill"><img src="/ar-icon-round.png" alt="" />AR Trade</span><span className="lt">LIMITED TIME</span>
          </div>
          <div className="promo-head">
            <span className="bn">ধামাকা অফার!</span>
            <span className="ttl">Mega Toner Sale</span>
            <span className="bigrow"><span className="big">UP TO {src.length ? src[0].off : 20}%</span><span className="off">OFF</span></span>
          </div>
          <div className="promo-items">
            {src.slice(0, 3).map(({ p, off }) => (
              <Link key={p.id} to={productPath(p)} onClick={close}><em>−{off}%</em><div style={{ backgroundImage: `url('${p.img}')` }} /><b>{fmt(p.price)}</b></Link>
            ))}
          </div>
          <div className="promo-coupon">
            <div className="c"><small>Extra {site.couponPct}% off with code</small><b>{site.coupon}</b></div>
            <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
          <Link to="/offers" className="promo-cta" onClick={close}>Shop the offer now →</Link>
          <div className="promo-cont">
            <a href="tel:+8801977554401"><i>☏</i><span><small>Call / WhatsApp</small><b>{site.phone}</b></span></a>
            <a href={'mailto:' + site.email}><i>@</i><span><small>Email</small><b>{site.email}</b></span></a>
          </div>
          <button className="promo-later" onClick={close}>No thanks, maybe later</button>
        </div>
      </div>
    </div>
  );
}

/** Newsletter popup: after a delay and on exit intent (once per session), then the double opt-in demo mail. */
export function NewsletterPopup() {
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
  useEffect(() => { if (mode) return () => popupClose('newsletter'); return undefined; }, [mode]);

  if (!mode) return null;
  const submit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = String(fd.get('email') || '').trim();
    const bad = m => { setErr(m); say(m); }; // red message in the form and a toast
    if (!email) return bad('Please enter your email address.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return bad('That email does not look right. Try name@company.com');
    if (!fd.get('agree')) return bad('Please tick the box to agree to receive emails.');
    setErr('');
    try { await optIn(email, mode === 'exit' ? 'Exit-intent popup' : 'Newsletter popup'); setMode(null); } catch (er) { bad(er.message); }
  };
  return (
    <div className="pop-bg" style={{ zIndex: 90, background: 'rgba(8,14,32,.62)' }} onClick={() => setMode(null)}>
      <div className="nl" onClick={e => e.stopPropagation()}>
        <button className="x" onClick={() => setMode(null)} title="Close" aria-label="Close">×</button>
        <div className="l">
          <img src="/ar-icon-round.png" alt="AR Trade" style={{ width: 48, height: 48, borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'oklch(0.82 0.1 230)' }}>Welcome offer</span>
            <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 84, lineHeight: .9, letterSpacing: '-.04em' }}>10%<span style={{ fontSize: 30, letterSpacing: 0 }}> off</span></span>
            <span style={{ fontSize: 15, color: '#c9d4ea' }}>your first order of toner, ink &amp; printers.</span>
          </div>
          <span style={{ fontSize: 12, color: '#8fa0c2', position: 'relative' }}>Code unlocks after you confirm your email.</span>
        </div>
        <form className="r" onSubmit={submit} noValidate>
          <h3>{mode === 'exit' ? 'Wait — before you go.' : 'Join the AR Trade list.'}</h3>
          <span style={{ fontSize: 14, lineHeight: 1.55, color: '#56607a' }}>Get 10% off your first order, plus Friday deals and refill reminders. One or two emails a week, at most.</span>
          <input name="email" type="email" placeholder="you@company.com" aria-label="Email address" onChange={() => setErr('')} style={{ border: '1.5px solid ' + (err ? '#e0584b' : '#cfdcef'), borderRadius: 14, padding: '14px 16px', fontSize: 15, outline: 0, color: '#0b1631' }} />
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.45, color: '#3a3f4b', cursor: 'pointer' }}>
            <input type="checkbox" name="agree" onChange={() => setErr('')} style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
            <span>I agree to receive marketing emails from AR Trade International. I can unsubscribe anytime. See our <Link to="/policy/privacy" onClick={() => setMode(null)} style={{ color: 'oklch(0.48 0.16 254)', fontWeight: 700 }}>privacy policy</Link>.</span>
          </label>
          {err && <div className="form-err" role="alert" style={{ margin: 0 }}>⚠ {err}</div>}
          <button className="btn btn-grad btn-pill" style={{ padding: 15, fontSize: 15 }}>Send my 10% code</button>
          <button type="button" onClick={() => setMode(null)} style={{ border: 0, background: 'transparent', color: '#7a8090', fontSize: 12.5, textDecoration: 'underline' }}>No thanks, I'll pay full price</button>
        </form>
      </div>
    </div>
  );
}

/** "Check your inbox" toast: the confirmation link itself arrives by email and opens the preferences page. */
export function OptInMail() {
  const { optMail, setOptMail } = useStore();
  if (!optMail) return null;
  return (
    <div className="toast-opt">
      <i>✉</i>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <b style={{ fontSize: 14, color: '#0b1631' }}>Confirm your email</b>
        <span style={{ fontSize: 12.5, color: '#56607a', lineHeight: 1.45 }}>We sent a link to <b>{optMail.email}</b>. You're subscribed only after you click it.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-pill" style={{ padding: '7px 13px', fontSize: 12 }} onClick={() => setOptMail(null)}>OK</button>
        </div>
      </div>
    </div>
  );
}
