import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useStore } from '../store.jsx';
import './reset/reset.css';

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
    <section className="rsp">
      <div className="white-card rsp-card">
        <h1 className="rsp-h1">Set a new password</h1>
        {!who && !err && <span className="spin" />}
        {err && !who && <><div className="a-msg err rsp-err-box">{err}</div><span className="rsp-hint">Ask us for a new link from “Forgot password” on the sign-in form.</span><Link to="/">← Back to store</Link></>}
        {who && (
          <form onSubmit={submit} className="rsp-form">
            <span className="rsp-hello">Hello <b>{who}</b>, choose a new password for your account.</span>
            <label className="lbl">New password<input className="field" name="pw" type="password" required minLength={8} autoComplete="new-password" /></label>
            <label className="lbl">Confirm password<input className="field" name="pw2" type="password" required minLength={8} autoComplete="new-password" /></label>
            {err && <span className="rsp-err">{err}</span>}
            <button className="btn btn-dark btn-pill rsp-submit" disabled={busy}>{busy ? 'Saving…' : 'Save and sign in'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
