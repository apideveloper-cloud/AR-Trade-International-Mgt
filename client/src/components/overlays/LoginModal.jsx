import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Social from '../Social.jsx';
import { api } from '../../api.js';
import { useStore } from '../../store.jsx';
import LoginSide from './LoginSide.jsx';
import './overlays.css';

/** Sign-in / register modal (also rendered on the /login route); closes itself once a user is signed in. */
export default function LoginModal() {
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
        <LoginSide />
        <div className="r">
          <button className="x" onClick={close} title="Close" aria-label="Close">✕</button>
          <div className="ltabs">
            <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Sign in</button>
            <button className={reg ? 'on' : ''} onClick={() => setMode('register')}>Register</button>
          </div>
          <form onSubmit={submit} className="ov-login-form">
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
            {reg && <span className="ov-login-hint">Password: at least 8 characters, with a letter and a number.</span>}
            {err && <span className="err ov-login-err">{err}</span>}
            {!reg && !sentForgot && <button type="button" onClick={forgot} className="ov-login-forgot">Forgot password?</button>}
            {sentForgot && <span className="ov-login-sent">Request received. Our team will send you a password reset link on your mobile or email shortly. You can also call {site.phone}.</span>}
            {!reg && <span className="ov-login-demo">Demo account: <b>demo@artrade.com</b> / <b>demo123</b></span>}
            <button className="btn btn-dark btn-pill ov-login-submit" disabled={busy}>{reg ? 'Create account' : 'Sign in'}</button>
          </form>
          <Social onDone={done} onError={setErr} />
        </div>
      </div>
    </div>
  );
}
