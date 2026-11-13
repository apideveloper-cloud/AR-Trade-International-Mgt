import { useEffect, useState } from 'react';
import { hubApi as hub } from '../admin/adminApi.js';
import { fmt } from '../api.js';

export default function Branches() {
  const [d, setD] = useState(null);
  useEffect(() => { hub.get('/branches').then(setD).catch(() => {}); }, []);
  if (!d) return <span className="spin" />;
  return (
    <>
      <div className="hbr">{d.branches.map(b => <div key={b.id}><b style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 16, color: '#0b1631' }}>⌂ {b.name}</b><span style={{ fontSize: 12.5, color: '#56607a' }}>{b.area}</span><b style={{ fontSize: 12, color: 'oklch(0.45 0.15 255)' }}>{b.riders} riders · {b.active} active orders</b></div>)}</div>
      <div className="hcard" style={{ gap: 4, overflowX: 'auto' }}>
        <h4>Stock routing — nearest branch that has every item</h4>
        <span style={{ fontSize: 12, color: '#7a8299', marginBottom: 6 }}>Matched from the delivery address; falls back to the next branch with full stock, then HQ.</span>
        {!d.routing.length && <span style={{ color: '#7a8299' }}>No active orders to route.</span>}
        {d.routing.map(r => (
          <div key={r.id} className="route">
            <b className="mono">{r.id}</b><span style={{ color: '#56607a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.address}</span><b style={{ color: r.fallback ? 'oklch(0.5 0.16 40)' : 'oklch(0.45 0.15 255)' }}>→ {r.pick}</b>
            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{r.stock.map(s => <span key={s.name} style={{ fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 6, background: s.ok ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.03 25)', color: s.ok ? 'oklch(0.4 0.12 150)' : 'oklch(0.48 0.15 25)' }}>{s.name}{s.ok ? ' ✓' : ' ✕'}{s.nearest ? ' (nearest)' : ''}</span>)}</span>
          </div>
        ))}
      </div>
      <div className="hbr">{d.couriers.map(c => <div key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><span style={{ background: c.color, color: '#fff', fontWeight: 800, fontSize: 13, padding: '8px 12px', borderRadius: 10 }}>{c.id}</span><div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.35, fontSize: 12.5 }}><b>{c.eta} · {fmt(c.fee)}</b><span style={{ color: '#56607a' }}>{c.used} orders handed over · API: demo</span></div></div>)}</div>
    </>
  );
}
