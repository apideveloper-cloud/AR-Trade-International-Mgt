import { useEffect, useState } from 'react';
import Social from './Social.jsx';
import { popupAllowed, popupClose, popupOpen } from '../popupBus.js';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, fmt, offPct } from '../api.js';
import { useStore } from '../store.jsx';

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.link && <Link to={toast.link}>View cart</Link>}
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
      <button className="x" title="Clear" onClick={() => setCompare([])}>×</button>
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
          <button className="x" onClick={close} title="Close">×</button>
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
              <Link to={'/product/' + p.id} onClick={close} className="th">{p.img && <img src={p.img} alt="" />}</Link>
              <div className="mid">
                <Link to={'/product/' + p.id} onClick={close} className="nm clamp2">{p.name}</Link>
                <div className="row2">
                  <div className="q"><button onClick={() => setQty(p.id, qty - 1)}>−</button><span>{qty}</span><button onClick={() => setQty(p.id, qty + 1)}>+</button></div>
                  <b>{fmt(p.price * qty)}</b>
                </div>
              </div>
              <button className="rm" onClick={() => setQty(p.id, 0)} title="Remove">×</button>
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
    } catch (e2) { setErr(e2.message); setBusy(false); }
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
            <b style={{ fontFamily: 'var(--disp)', fontSize: 30, letterSpacing: '-.03em', lineHeight: 1 }}>Your AR Trade account.</b>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: '#c9ccd4' }}>Track deliveries, re-order toner in one tap and follow your servicing requests.</span>
          </div>
          <ul className="lg-perks"><li><i>৳</i><span><b>5% off online orders</b><small>and 10% on your next one</small></span></li><li><i>⚑</i><span><b>Live order tracking</b><small>from packing to your door</small></span></li><li><i>♡</i><span><b>Saved printer models &amp; wishlist</b><small>re-order toner in one tap</small></span></li></ul>
        </div>
        <div className="r">
          <button className="x" onClick={close} title="Close">✕</button>
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
  }, [pathname, site.popupMode, site.promoDelay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) return () => popupClose('promo'); return undefined; }, [open]);
  if (!open) return null;

  const src = products.filter(p => p.img && p.old && p.price).map(p => ({ p, off: offPct(p) })).sort((a, b) => b.off - a.off);
  const close = () => { try { sessionStorage.setItem('arPromoSeen', '1'); } catch { /* storage unavailable */ } setOpen(false); };
  const copy = () => { try { navigator.clipboard.writeText(site.coupon); } catch { /* clipboard unavailable */ } setCopied(true); };

  return (
    <div className="pop-bg" onClick={close}>
      <div className="promo-pop" onClick={e => e.stopPropagation()}>
        <button className="x" onClick={close} title="Close">×</button>
        <div className="promo-card">
          <span className="rays" /><span className="glow" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span className="brandpill"><img src="/ar-icon-round.png" alt="" />AR Trade</span><span className="lt">LIMITED TIME</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'var(--bn)', fontSize: 20, fontWeight: 600 }}>ধামাকা অফার!</span>
            <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 22, letterSpacing: '.02em', textTransform: 'uppercase' }}>Mega Toner Sale</span>
            <span className="big">UP TO {src.length ? src[0].off : 20}%</span>
            <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 26, letterSpacing: '.3em', background: '#2b2f38', borderRadius: 8, padding: '2px 14px 2px 20px', marginTop: 6 }}>OFF</span>
          </div>
          <div className="promo-items">
            {src.slice(0, 3).map(({ p, off }) => (
              <Link key={p.id} to={'/product/' + p.id} onClick={close}><em>−{off}%</em><div style={{ backgroundImage: `url('${p.img}')` }} /><b>{fmt(p.price)}</b></Link>
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
          <button onClick={close} style={{ display: 'block', margin: '12px auto 0', border: 0, background: 'transparent', color: 'rgba(255,255,255,.85)', fontSize: 12, textDecoration: 'underline', position: 'relative' }}>No thanks, maybe later</button>
        </div>
      </div>
    </div>
  );
}

/** Newsletter popup: after a delay and on exit intent (once per session), then the double opt-in demo mail. */
export function NewsletterPopup() {
  const { content, optIn, subscribed, optMail, say } = useStore();
  const [mode, setMode] = useState(null);
  const { site } = useStore();
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
    const email = new FormData(e.target).get('email');
    try { await optIn(email, mode === 'exit' ? 'Exit-intent popup' : 'Newsletter popup'); setMode(null); } catch (er) { say(er.message); }
  };
  return (
    <div className="pop-bg" style={{ zIndex: 90, background: 'rgba(8,14,32,.62)' }} onClick={() => setMode(null)}>
      <div className="nl" onClick={e => e.stopPropagation()}>
        <button className="x" onClick={() => setMode(null)} title="Close">×</button>
        <div className="l">
          <img src="/ar-icon-round.png" alt="AR Trade" style={{ width: 48, height: 48, borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'oklch(0.82 0.1 230)' }}>Welcome offer</span>
            <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 84, lineHeight: .9, letterSpacing: '-.04em' }}>10%<span style={{ fontSize: 30, letterSpacing: 0 }}> off</span></span>
            <span style={{ fontSize: 15, color: '#c9d4ea' }}>your first order of toner, ink &amp; printers.</span>
          </div>
          <span style={{ fontSize: 12, color: '#8fa0c2', position: 'relative' }}>Code unlocks after you confirm your email.</span>
        </div>
        <form className="r" onSubmit={submit}>
          <h3>{mode === 'exit' ? 'Wait — before you go.' : 'Join the AR Trade list.'}</h3>
          <span style={{ fontSize: 14, lineHeight: 1.55, color: '#56607a' }}>Get 10% off your first order, plus Friday deals and refill reminders. One or two emails a week, at most.</span>
          <input name="email" type="email" required placeholder="you@company.com" style={{ border: '1.5px solid #cfdcef', borderRadius: 14, padding: '14px 16px', fontSize: 15, outline: 0, color: '#0b1631' }} />
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.45, color: '#3a3f4b', cursor: 'pointer' }}>
            <input type="checkbox" required style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
            <span>I agree to receive marketing emails from AR Trade International. I can unsubscribe anytime. See our <Link to="/policy/privacy" onClick={() => setMode(null)} style={{ color: 'oklch(0.48 0.16 254)', fontWeight: 700 }}>privacy policy</Link>.</span>
          </label>
          <button className="btn btn-grad btn-pill" style={{ padding: 15, fontSize: 15 }}>Send my 10% code</button>
          <button type="button" onClick={() => setMode(null)} style={{ border: 0, background: 'transparent', color: '#7a8090', fontSize: 12.5, textDecoration: 'underline' }}>No thanks, I'll pay full price</button>
        </form>
      </div>
    </div>
  );
}

/** The "confirm your email" toast and the demo confirmation email. */
export function OptInMail() {
  const { optMail, setOptMail, confirmOptIn, say } = useStore();
  const [copied, setCopied] = useState(false);
  if (!optMail) return null;
  const { email, token, open, confirmed } = optMail;
  const set = patch => setOptMail(m => ({ ...m, ...patch }));
  const confirm = async () => { try { await confirmOptIn(); } catch (e) { say(e.message); } };

  if (!open) {
    if (confirmed) return null;
    return (
      <div className="toast-opt">
        <i>✉</i>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <b style={{ fontSize: 14, color: '#0b1631' }}>Confirm your email</b>
          <span style={{ fontSize: 12.5, color: '#56607a', lineHeight: 1.45 }}>We sent a link to <b>{email}</b>. You're subscribed only after you click it.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pill" style={{ padding: '7px 13px', fontSize: 12 }} onClick={() => set({ open: true })}>Open email (demo)</button>
            <button style={{ border: 0, background: 'transparent', color: '#7a8090', fontSize: 12, fontWeight: 700 }} onClick={() => setOptMail(null)}>Later</button>
          </div>
        </div>
      </div>
    );
  }
  const close = () => (confirmed ? setOptMail(null) : set({ open: false }));
  return (
    <div className="modal-bg" onClick={close}>
      <div className="mail" onClick={e => e.stopPropagation()}>
        <div className="hd">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><b style={{ fontSize: 14.5, color: '#0b1631' }}>Confirm your subscription to AR Trade</b><button onClick={close} style={{ border: 0, background: 'transparent', fontSize: 18, color: '#56607a' }}>×</button></div>
          <span>From: AR Trade International &lt;hello@artradeinternational.com&gt;</span><span>To: {email}</span>
        </div>
        <div className="bd"><div className="card">
          <img src="/ar-icon-round.png" alt="AR Trade" style={{ width: 52, height: 52, borderRadius: '50%' }} />
          {!confirmed ? (
            <>
              <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 24, color: '#0b1631' }}>One click to confirm</span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: '#56607a', maxWidth: 380 }}>Someone (hopefully you) asked to get deals and updates from AR Trade at this address. Confirm and we'll send your 10% welcome code.</span>
              <button className="btn btn-grad btn-pill" style={{ padding: '13px 26px' }} onClick={confirm}>Yes, subscribe me</button>
              <span style={{ fontSize: 11.5, color: '#8a8f9b' }}>Didn't request this? Ignore this email — you won't be added.</span>
            </>
          ) : (
            <>
              <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 24, color: 'oklch(0.42 0.12 150)' }}>✓ You're subscribed</span>
              <span style={{ fontSize: 14, color: '#56607a' }}>Here's your welcome code — 10% off your first order:</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', border: '2px dashed oklch(0.7 0.1 240)', borderRadius: 14, padding: '8px 8px 8px 18px' }}>
                <b style={{ fontFamily: 'var(--mono)', fontSize: 20, letterSpacing: '.12em', color: '#0b1631' }}>WELCOME10</b>
                <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => { try { navigator.clipboard.writeText('WELCOME10'); } catch { /* clipboard unavailable */ } setCopied(true); }}>{copied ? 'Copied ✓' : 'Copy'}</button>
              </div>
              <Link to="/shop/all" onClick={close} style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.48 0.16 254)' }}>Start shopping →</Link>
            </>
          )}
          <span style={{ fontSize: 11, color: '#8a8f9b', borderTop: '1px solid #eef0f4', paddingTop: 12, width: '100%' }}>Ref {token} · AR Trade International, Dhaka · <Link to={'/prefs/' + token} onClick={close} style={{ color: '#6b7080', textDecoration: 'underline' }}>Unsubscribe</Link> · <Link to={'/prefs/' + token} onClick={close} style={{ color: '#6b7080', textDecoration: 'underline' }}>Manage preferences</Link></span>
        </div></div>
      </div>
    </div>
  );
}
