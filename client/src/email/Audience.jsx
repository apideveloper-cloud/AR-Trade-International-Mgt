import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { fmtTime } from '../api.js';
import { card } from './emailShared.js';

export default function Audience() {
  const [d, setD] = useState(null);
  const load = () => api.get('/audience').then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <span className="spin" />;
  const CH = [['offers', 'Offers'], ['festivals', 'Festivals'], ['tips', 'Health tips'], ['refill', 'Refill alerts']];
  return (
    <>
      <div className="em-s83">
        <span className="em-s84">✓</span>
        <span><b>Our list is never shared or sold.</b> Subscribers only get what they chose in their preference center, and an unsubscribe takes effect immediately.</span>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="em-s85"><b className="em-s14">Confirmed subscribers · {d.subscribers.length}</b><span className="em-s48">Preferences are set by the subscriber, not by staff.</span></div>
        {!d.subscribers.length && <div className="em-s86">No confirmed subscribers yet.</div>}
        {d.subscribers.map(u => (
          <div key={u.email} className="em-s87">
            <b className="em-s88">{u.email}</b>
            <div className="em-s89">{CH.map(([k, t]) => <span key={k} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, background: u.prefs[k] ? 'oklch(0.95 0.04 250)' : '#f1f2f5', color: u.prefs[k] ? 'oklch(0.42 0.15 256)' : '#a0a5b1' }}>{t}</span>)}</div>
            {u.token && <a href={'/prefs/' + u.token} target="_blank" rel="noreferrer" className="em-s90">Preference page ↗</a>}
            <button onClick={async () => { if (window.confirm('Unsubscribe ' + u.email + '?')) { await api.del('/audience/' + encodeURIComponent(u.email)); load(); } }} className="em-s91">Unsubscribe</button>
          </div>
        ))}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="em-s92"><b className="em-s14">Unsubscribe &amp; preference log</b></div>
        {!d.log.length && <div className="em-s93">No changes yet.</div>}
        {d.log.map((l, i) => <div key={i} className="em-s94"><span className="mono em-s95">{fmtTime(l.at)}</span><b>{l.email}</b><span className="em-s96">{l.what}</span></div>)}
      </div>
    </>
  );
}
