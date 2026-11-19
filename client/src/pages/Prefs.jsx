import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import PrefToggle from './prefs/PrefToggle.jsx';
import { PREF_ROWS } from './prefs/prefRows.js';
import './prefs/prefs.css';

/** Standalone email preference page reached from the link in every marketing email. */
export default function Prefs() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [qs] = useSearchParams();
  const [welcome, setWelcome] = useState(false);
  const load = () => api.get('/prefs/' + token).then(setD).catch(e => setErr(e.message));
  // the link in the confirmation email carries ?confirm=1: opening it is the double opt-in click
  useEffect(() => {
    if (qs.get('confirm') === '1') api.post('/optin/confirm', { token }).then(() => setWelcome(true)).catch(e => setErr(e.message)).finally(load);
    else load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async k => {
    const prefs = { ...d.prefs, [k]: !d.prefs[k] };
    setD({ ...d, prefs }); setSaved(false);
    try { await api.put('/prefs/' + token, prefs); setSaved(true); } catch (e) { setErr(e.message); load(); }
  };
  const act = async what => { try { await api.post(`/prefs/${token}/${what}`); } catch (e) { setErr(e.message); } load(); };

  return (
    <div className="prf">
      <div className="prf-card">
        <div className="prf-hd">
          <img src="/ar-icon-round.png" alt="AR Trade" className="prf-logo" />
          <div className="prf-hd-txt"><b className="prf-title">Email preferences</b><span className="prf-mail">{d?.email || ''}</span></div>
        </div>
        {err && !d && <div className="prf-err">{err}</div>}
        {!d && !err && <div className="prf-load"><span className="spin" /></div>}
        {d?.subscribed && (
          <div className="prf-body">
            {welcome && <div className="prf-welcome">✓ You're subscribed. Your welcome code: <b className="prf-code">WELCOME10</b> (10% off your first order)</div>}
            <span className="prf-lead">Choose what you'd like to hear about. Changes apply immediately.</span>
            {PREF_ROWS.map(([k, t, ds]) => <PrefToggle key={k} title={t} desc={ds} on={d.prefs[k]} onToggle={() => toggle(k)} />)}
            {saved && <span className="prf-saved">✓ Preferences saved</span>}
            <div className="prf-foot-row">
              <button onClick={() => act('unsubscribe')} className="prf-unsub">Unsubscribe from all</button>
              <Link to="/" className="prf-back">Back to store →</Link>
            </div>
          </div>
        )}
        {d && !d.subscribed && (
          <div className="prf-off">
            <b className="prf-off-t">You're unsubscribed.</b>
            <span className="prf-lead">Effective immediately — {d.email} won't receive any more marketing emails from AR Trade. Order and delivery updates still arrive as normal.</span>
            <button onClick={() => act('resubscribe')} className="prf-resub">Changed your mind? Resubscribe</button>
          </div>
        )}
        <div className="prf-note">We never share or sell your email address. · AR Trade International, Dhaka</div>
      </div>
    </div>
  );
}
