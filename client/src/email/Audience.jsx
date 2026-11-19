import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { fmtTime } from '../api.js';
import { PanelHead } from './EmailParts.jsx';
import { act } from './emailShared.js';

const CHANNELS = [['offers', 'Offers'], ['festivals', 'Festivals'], ['tips', 'Health tips'], ['refill', 'Refill alerts']];

export default function Audience() {
  const [d, setD] = useState(null);
  const load = () => api.get('/audience').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return <span className="spin" />;
  return (
    <>
      <div className="em-promise">
        <span className="em-promise-icon">✓</span>
        <span><b>Our list is never shared or sold.</b> Subscribers only get what they chose in their preference center, and an unsubscribe takes effect immediately.</span>
      </div>
      <div className="em-card em-card-clip">
        <PanelHead><b className="em-panel-title">Confirmed subscribers · {d.subscribers.length}</b><span className="em-hint">Preferences are set by the subscriber, not by staff.</span></PanelHead>
        {!d.subscribers.length && <div className="em-empty-row">No confirmed subscribers yet.</div>}
        {d.subscribers.map(u => (
          <div key={u.email} className="em-sub-row">
            <b className="em-sub-email">{u.email}</b>
            <div className="em-chips">{CHANNELS.map(([k, t]) => <span key={k} className={'em-chip' + (u.prefs[k] ? ' em-chip--on' : '')}>{t}</span>)}</div>
            {u.token && <a href={'/prefs/' + u.token} target="_blank" rel="noreferrer" className="em-sub-link">Preference page ↗</a>}
            <button onClick={() => { if (window.confirm('Unsubscribe ' + u.email + '?')) act(() => api.del('/audience/' + encodeURIComponent(u.email)), load); }} className="em-sub-unsub">Unsubscribe</button>
          </div>
        ))}
      </div>
      <div className="em-card em-card-clip">
        <PanelHead plain><b className="em-panel-title">Unsubscribe &amp; preference log</b></PanelHead>
        {!d.log.length && <div className="em-empty-row">No changes yet.</div>}
        {d.log.map((l, i) => <div key={i} className="em-log-row"><span className="mono em-log-when">{fmtTime(l.at)}</span><b>{l.email}</b><span className="em-log-what">{l.what}</span></div>)}
      </div>
    </>
  );
}
