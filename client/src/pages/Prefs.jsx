import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

const ROWS = [['offers', 'Offers & weekly deals', 'Friday deals and price drops'], ['festivals', 'Festival campaigns', 'Eid, Puja and Pohela Boishakh offers'], ['tips', 'Health tips', 'Printer care guides and servicing advice'], ['refill', 'Refill & back-in-stock alerts', 'Reminders for the supplies you use']];

/** Standalone email preference page reached from the link in every marketing email. */
export default function Prefs() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const load = () => api.get('/prefs/' + token).then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async k => {
    const prefs = { ...d.prefs, [k]: !d.prefs[k] };
    setD({ ...d, prefs }); setSaved(false);
    try { await api.put('/prefs/' + token, prefs); setSaved(true); } catch (e) { setErr(e.message); load(); }
  };
  const act = async what => { await api.post(`/prefs/${token}/${what}`); load(); };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px 18px', background: 'radial-gradient(90% 60% at 50% 0%,#dbe6f7 0%,#eef1f6 70%)' }}>
      <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 24, boxShadow: '0 30px 70px -40px rgba(11,22,49,.5)', overflow: 'hidden' }}>
        <div style={{ background: '#0b1631', color: '#fff', padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/api/uploads/site/ar-icon-round.png" alt="AR Trade" style={{ width: 44, height: 44, borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontFamily: 'var(--disp)', fontSize: 20 }}>Email preferences</b><span style={{ fontSize: 12.5, color: '#a9b6d3' }}>{d?.email || ''}</span></div>
        </div>
        {err && !d && <div style={{ padding: '30px 26px', color: 'oklch(0.5 0.18 25)', fontWeight: 600 }}>{err}</div>}
        {!d && !err && <div style={{ padding: 40, textAlign: 'center' }}><span className="spin" /></div>}
        {d?.subscribed && (
          <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: 14, color: '#56607a', lineHeight: 1.55 }}>Choose what you'd like to hear about. Changes apply immediately.</span>
            {ROWS.map(([k, t, ds]) => {
              const on = d.prefs[k];
              return (
                <button key={k} onClick={() => toggle(k)} style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', border: '1.5px solid ' + (on ? 'oklch(0.75 0.1 250)' : '#e3e8f2'), background: on ? 'oklch(0.97 0.02 250)' : '#fff', borderRadius: 16, padding: '14px 16px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 14.5, color: '#0b1631' }}>{t}</b><span style={{ fontSize: 12.5, color: '#6b7080' }}>{ds}</span></div>
                  <span style={{ width: 44, height: 26, borderRadius: 999, background: on ? 'oklch(0.52 0.16 252)' : '#cfd5e1', position: 'relative', flexShrink: 0 }}><span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} /></span>
                </button>
              );
            })}
            {saved && <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.42 0.12 150)' }}>✓ Preferences saved</span>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #eef0f4', paddingTop: 16 }}>
              <button onClick={() => act('unsubscribe')} style={{ border: '1.5px solid oklch(0.6 0.17 25)', background: '#fff', color: 'oklch(0.5 0.18 25)', borderRadius: 999, padding: '11px 18px', fontSize: 13.5, fontWeight: 800 }}>Unsubscribe from all</button>
              <Link to="/" style={{ fontSize: 13, fontWeight: 700 }}>Back to store →</Link>
            </div>
          </div>
        )}
        {d && !d.subscribed && (
          <div style={{ padding: '30px 26px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <b style={{ fontFamily: 'var(--disp)', fontSize: 24, color: '#0b1631' }}>You're unsubscribed.</b>
            <span style={{ fontSize: 14, color: '#56607a', lineHeight: 1.55 }}>Effective immediately — {d.email} won't receive any more marketing emails from AR Trade. Order and delivery updates still arrive as normal.</span>
            <button onClick={() => act('resubscribe')} style={{ border: 0, background: '#0b1631', color: '#fff', borderRadius: 999, padding: '11px 18px', fontSize: 13.5, fontWeight: 700 }}>Changed your mind? Resubscribe</button>
          </div>
        )}
        <div style={{ padding: '14px 26px', background: '#f7f8fb', fontSize: 11.5, color: '#7a8090' }}>We never share or sell your email address. · AR Trade International, Dhaka</div>
      </div>
    </div>
  );
}
