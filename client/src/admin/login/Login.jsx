import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adm, setAdminToken } from '../adminApi.js';
import { PasswordInput } from './PasswordInput.jsx';
import { LOGIN_ROLES, RoleCombo } from './RoleCombo.jsx';
import './login.css';

/** Sign-in screen: role + mobile/email + password, with "remember me" and the one-device-session notice. */
export function Login({ onDone }) {
  const [role, setRole] = useState(() => { try { const r = localStorage.getItem('ar_login_role'); return LOGIN_ROLES.some(x => x[0] === r) ? r : ''; } catch { return ''; } });
  const [remember, setRemember] = useState(() => { try { return localStorage.getItem('ar_login_remember') === '1'; } catch { return false; } });
  const [lastUser] = useState(() => { try { return localStorage.getItem('ar_login_user') || ''; } catch { return ''; } });
  // set when another device signed in with this account and ended the old session
  const [err, setErr] = useState(() => { try { const n = sessionStorage.getItem('ar_admin_notice') || ''; sessionStorage.removeItem('ar_admin_notice'); return n; } catch { return ''; } });
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!role) { setErr('Pick your role first.'); document.querySelector('.rc-btn')?.focus(); return; }
    // our own validation instead of the browser's grey "Please fill out this field" bubble
    for (const el of e.target.querySelectorAll('input[required]')) {
      const v = el.value.trim();
      const label = (el.closest('label')?.firstChild?.textContent || 'this field').trim().toLowerCase();
      const problem = !v ? `Please enter your ${label}.` : el.minLength > 0 && v.length < el.minLength ? `The ${label} must be at least ${el.minLength} characters.` : '';
      if (problem) { el.setAttribute('aria-invalid', 'true'); el.focus(); setErr(problem); return; }
    }
    const d = Object.fromEntries(new FormData(e.target).entries());
    setBusy(true);
    try {
      const r = await adm.post('/login', { id: d.id, password: d.pass, role, remember });
      try {
        localStorage.setItem('ar_login_role', role); localStorage.setItem('ar_login_remember', remember ? '1' : '0');
        if (remember) localStorage.setItem('ar_login_user', d.id.trim()); else localStorage.removeItem('ar_login_user'); // only the user name is kept, never the password
      } catch { /* storage unavailable */ }
      setAdminToken(r.token, remember); onDone(r.staff);
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  return (
    <div className="adm-login">
      <div className="box">
        <div className="xlogin-brand">
          <img className="xlogin-logo" src="/admin-logo-light.png" alt="AR Trade International" />
          <span className="mono xlogin-tag">ADMIN CONSOLE</span>
        </div>
        <div className="card">
          <div><span className="xlogin-welcome">Welcome back</span><span className="xlogin-sub">Pick your role, then sign in with your mobile number or work email.</span></div>
          <form className="xlogin-form" onSubmit={submit} noValidate onInput={ev => { ev.target.removeAttribute?.('aria-invalid'); setErr(''); }}>
            <div className="rc-field"><span className="rl-l">Your role</span><RoleCombo value={role} onChange={r => { setRole(r); setErr(''); }} /></div>
            <label>Mobile or email<input type="text" name="id" required placeholder="01XXXXXXXXX or email" autoComplete="username" defaultValue={remember ? lastUser : ''} /></label>
            <label>Password<PasswordInput name="pass" minLength={8} autoComplete="current-password" /></label>
            <label className="rm-row"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span className="rm-box" aria-hidden="true">✓</span><span className="rm-tx"><b>Remember me</b><small>Stay signed in on this device for 7 days. Do not use on a shared computer.</small></span></label>
            {err && <span className="lerr" role="alert">⚠ {err}</span>}
            <button className="go" disabled={busy}>{busy ? 'Checking…' : role ? 'Sign in as ' + role + ' →' : 'Sign in →'}</button>
          </form>
          <small className="lg-note">The role must match your account. A wrong role is refused even with the right password.</small>
        </div>
        <Link to="/" className="xlogin-back">← Back to storefront</Link>
        <span className="xlogin-dev">Dev By: <b>Eng. A T M Faruque</b></span>
      </div>
    </div>
  );
}
