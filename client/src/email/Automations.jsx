import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { Note, Switch } from './EmailParts.jsx';
import { card, dash } from './emailShared.js';

export default function Automations() {
  const [rows, setRows] = useState(null);
  const load = () => api.get('/automations').then(setRows);
  useEffect(() => { load(); }, []);
  const toggle = async a => { await api.put('/automations/' + a.id, { active: !a.active }); load(); };
  if (!rows) return <span className="spin" />;
  return (
    <>
      <div className="em-s27">
        {rows.map(a => (
          <div key={a.id} style={{ ...card, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="em-s28">
              <div className="em-s29"><b className="em-s30">{a.name}</b><span className="em-s31">Trigger: {a.trigger}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: a.active ? 'oklch(0.42 0.12 150)' : '#8a8f9b' }}>{a.active ? 'ON' : 'PAUSED'}<Switch on={a.active} onClick={() => toggle(a)} /></div>
            </div>
            <div className="em-s32">
              {a.steps.map(([w, t]) => (
                <div key={w} className="em-s33">
                  <span className="em-s34" />
                  <span className="mono em-s35">{w}</span><span className="em-s36">{t}</span>
                </div>
              ))}
            </div>
            <div className="em-s37">
              {[['Queued now', a.live ? a.queued : dash], ['Sent', a.sent || dash], ['Wiring', a.live ? 'Live' : 'Needs provider events']].map(([k, v]) => <div key={k} className="em-s38"><span className="em-s39">{k}</span><b className="em-s40">{v}</b></div>)}
            </div>
          </div>
        ))}
      </div>
      <Note>The welcome series is live: confirming a subscription queues its steps. The other automations switch on here, but need cart, order or stock events from the connected provider. They only email confirmed subscribers who allow that type.</Note>
    </>
  );
}
