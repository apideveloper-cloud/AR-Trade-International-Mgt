import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { Note, Switch } from './EmailParts.jsx';
import { act, dash } from './emailShared.js';

export default function Automations() {
  const [rows, setRows] = useState(null);
  const load = () => api.get('/automations').then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  const toggle = a => act(() => api.put('/automations/' + a.id, { active: !a.active }), load);
  if (!rows) return <span className="spin" />;
  return (
    <>
      <div className="em-auto-grid">
        {rows.map(a => (
          <div key={a.id} className="em-card em-card-lg em-auto">
            <div className="em-auto-head">
              <div className="em-stack-4"><b className="em-auto-name">{a.name}</b><span className="em-sub">Trigger: {a.trigger}</span></div>
              <div className={'em-auto-state' + (a.active ? ' em-auto-state--on' : '')}>{a.active ? 'ON' : 'PAUSED'}<Switch on={a.active} onClick={() => toggle(a)} /></div>
            </div>
            <div className="em-timeline">
              {a.steps.map(([w, t]) => (
                <div key={w} className="em-step">
                  <span className="em-step-dot" />
                  <span className="mono em-step-when">{w}</span><span className="em-step-text">{t}</span>
                </div>
              ))}
            </div>
            <div className="em-stats">
              {[['Queued now', a.live ? a.queued : dash], ['Sent', a.sent || dash], ['Wiring', a.live ? 'Live' : 'Needs provider events']].map(([k, v]) => <div key={k} className="em-col-2"><span className="em-stat-key">{k}</span><b className="em-stat-val">{v}</b></div>)}
            </div>
          </div>
        ))}
      </div>
      <Note>The welcome series is live: confirming a subscription queues its steps. The other automations switch on here, but need cart, order or stock events from the connected provider. They only email confirmed subscribers who allow that type.</Note>
    </>
  );
}
