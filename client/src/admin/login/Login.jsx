import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adm, setAdminToken } from '../adminApi.js';

/** Password box with a show / hide eye, so a mistyped password can be checked before signing in. */
function PasswordInput({ name, autoComplete, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-in">
      <input type={show ? 'text' : 'password'} name={name} required minLength={minLength} autoComplete={autoComplete} />
      <button type="button" className="pw-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} title={show ? 'Hide password' : 'Show password'}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {show
            ? <><path d="M3 3l18 18" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a12 12 0 0 1-2.6 3.3M6.6 7.6A12.4 12.4 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.6 0 3-.4 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
            : <><path d="M2.5 12c1-2 4.5-6 9.5-6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </span>
  );
}

// [role, icon, what the role does, accent hue]
const LOGIN_ROLES = [
  ['Master Admin', '★', 'Everything, and the role matrix', 85], ['Admin', '◆', 'Access set by the Master Admin', 250], ['Manager', '☰', 'Orders, deliveries, approvals', 160],
  ['Accountant', '৳', 'Money, payments, expenses', 300], ['Purchase Officer', '▣', 'Buying, products and stock', 45], ['RM', '☺', 'Customers, enquiries, campaigns', 15],
  ['Field Officer', '⚑', 'Mobile app: attendance, tracking', 200], ['Delivery rider', '🚚', 'Pick-ups and deliveries', 230], ['Marketing manager', '✉', 'Campaigns and subscribers', 330], ['Content writer', '✎', 'Blog and site pages', 120]
];

/** A graphical combo box: the chosen role is shown as an icon + name + what it does, and the list opens as coloured rows. Arrow keys, Enter, Esc and Home/End work. */
function RoleCombo({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  const cur = LOGIN_ROLES.find(r => r[0] === value);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  useEffect(() => { if (open) box.current?.querySelector('.rc-row.hi')?.scrollIntoView({ block: 'nearest' }); }, [open, hi]);
  const toggle = () => { setHi(Math.max(0, LOGIN_ROLES.findIndex(r => r[0] === value))); setOpen(o => !o); };
  const pick = i => { onChange(LOGIN_ROLES[i][0]); setOpen(false); box.current?.querySelector('.rc-btn')?.focus(); };
  const key = e => {
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); toggle(); } return; }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => (h + 1) % LOGIN_ROLES.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => (h - 1 + LOGIN_ROLES.length) % LOGIN_ROLES.length); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0); }
    else if (e.key === 'End') { e.preventDefault(); setHi(LOGIN_ROLES.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(hi); }
    else if (e.key === 'Tab') setOpen(false);
  };
  return (
    <div className={'rc' + (open ? ' open' : '')} ref={box} onKeyDown={key}>
      <button type="button" className="rc-btn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls="rc-list" aria-label="Your role" onClick={toggle} style={cur ? { '--h': cur[3] } : undefined}>
        {cur
          ? <><i className="rc-ic">{cur[1]}</i><span className="rc-tx"><b>{cur[0]}</b><small>{cur[2]}</small></span></>
          : <><i className="rc-ic none">?</i><span className="rc-tx"><b className="muted">Select your role</b><small>Tap to choose how you sign in</small></span></>}
        <svg className="rc-car" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className="rc-list" id="rc-list" role="listbox" aria-label="Roles">
          {LOGIN_ROLES.map(([r, ic, ds, h], i) => (
            <li key={r} role="option" aria-selected={value === r} className={'rc-row' + (hi === i ? ' hi' : '') + (value === r ? ' on' : '')} style={{ '--h': h }} onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); pick(i); }}>
              <i className="rc-ic">{ic}</i><span className="rc-tx"><b>{r}</b><small>{ds}</small></span>{value === r && <em aria-hidden="true">✓</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <img src="/admin-logo-light.png" alt="AR Trade International" style={{ display: 'block', width: 'min(340px, 74vw)', height: 'auto' }} />
          <span className="mono" style={{ fontSize: 11, letterSpacing: '.22em', color: 'oklch(0.78 0.1 230)' }}>ADMIN CONSOLE</span>
        </div>
        <div className="card">
          <div><span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', display: 'block' }}>Welcome back</span><span style={{ fontSize: 13, color: '#8f9bb8' }}>Pick your role, then sign in with your mobile number or work email.</span></div>
          <form onSubmit={submit} noValidate onInput={ev => { ev.target.removeAttribute?.('aria-invalid'); setErr(''); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="rc-field"><span className="rl-l">Your role</span><RoleCombo value={role} onChange={r => { setRole(r); setErr(''); }} /></div>
            <label>Mobile or email<input type="text" name="id" required placeholder="01XXXXXXXXX or email" autoComplete="username" defaultValue={remember ? lastUser : ''} /></label>
            <label>Password<PasswordInput name="pass" minLength={8} autoComplete="current-password" /></label>
            <label className="rm-row"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span className="rm-box" aria-hidden="true">✓</span><span className="rm-tx"><b>Remember me</b><small>Stay signed in on this device for 7 days. Do not use on a shared computer.</small></span></label>
            {err && <span className="lerr" role="alert">⚠ {err}</span>}
            <button className="go" disabled={busy}>{busy ? 'Checking…' : role ? 'Sign in as ' + role + ' →' : 'Sign in →'}</button>
          </form>
          <small className="lg-note">The role must match your account. A wrong role is refused even with the right password.</small>
        </div>
        <Link to="/" style={{ textAlign: 'center', color: '#8f9bb8', fontSize: 13 }}>← Back to storefront</Link>
        <span style={{ textAlign: 'center', color: '#6f7b98', fontSize: 12 }}>Dev By: <b style={{ color: '#c9d4ea', fontWeight: 700 }}>Eng. A T M Faruque</b></span>
      </div>
    </div>
  );
}
