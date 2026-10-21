import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useStore } from '../store.jsx';

/** Customer sets a new password from the one-time link sent by staff. */
export default function Reset() {
  const { token } = useParams();
  const { setUser } = useStore();
  const nav = useNavigate();
  const [who, setWho] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/auth/reset/' + token).then(r => setWho(r.name)).catch(e => setErr(e.message)); }, [token]);
  const submit = async e => {
    e.preventDefault(); setErr('');
    const d = Object.fromEntries(new FormData(e.target).entries());
    if (d.pw !== d.pw2) return setErr('The two passwords do not match');
    setBusy(true);
    try { const r = await api.post('/auth/reset', { token, password: d.pw }); setToken(true); setUser(r.user); nav('/account'); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <section style={{ maxWidth: 440, margin: '60px auto', padding: '0 20px' }}>
      <div className="white-card" style={{ gap: 14 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Set a new password</h1>
        {!who && !err && <span className="spin" />}
        {err && !who && <><div className="a-msg err" style={{ background: '#fdeceb', color: '#b3261e', padding: 12, borderRadius: 10, fontWeight: 600 }}>{err}</div><span style={{ fontSize: 13, color: '#5d6270' }}>Ask us for a new link from “Forgot password” on the sign-in form.</span><Link to="/">← Back to store</Link></>}
        {who && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ color: '#5d6270' }}>Hello <b>{who}</b>, choose a new password for your account.</span>
            <label className="lbl">New password<input className="field" name="pw" type="password" required minLength={8} autoComplete="new-password" /></label>
            <label className="lbl">Confirm password<input className="field" name="pw2" type="password" required minLength={8} autoComplete="new-password" /></label>
            {err && <span style={{ color: '#b3261e', fontSize: 13, fontWeight: 600 }}>{err}</span>}
            <button className="btn btn-dark btn-pill" disabled={busy} style={{ padding: 12 }}>{busy ? 'Saving…' : 'Save and sign in'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
