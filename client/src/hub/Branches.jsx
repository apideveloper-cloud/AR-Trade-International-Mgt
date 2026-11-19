import { useEffect, useState } from 'react';
import { hubApi as hub } from '../admin/adminApi.js';
import { fmt } from '../api.js';
import './hubInline.css';

export default function Branches() {
  const [d, setD] = useState(null);
  useEffect(() => { hub.get('/branches').then(setD).catch(() => {}); }, []);
  if (!d) return <span className="spin" />;
  return (
    <>
      <div className="hbr">{d.branches.map(b => <div key={b.id}><b className="hxi-brname">⌂ {b.name}</b><span className="hxi-brarea">{b.area}</span><b className="hxi-brcount">{b.riders} riders · {b.active} active orders</b></div>)}</div>
      <div className="hcard hxi-routecard">
        <h4>Stock routing — nearest branch that has every item</h4>
        <span className="hxi-routehint">Matched from the delivery address; falls back to the next branch with full stock, then HQ.</span>
        {!d.routing.length && <span className="hxi-muted">No active orders to route.</span>}
        {d.routing.map(r => (
          <div key={r.id} className="route">
            <b className="mono">{r.id}</b><span className="hxi-routeaddr">{r.address}</span><b className={'hxi-routepick' + (r.fallback ? ' hxi-fallback' : '')}>→ {r.pick}</b>
            <span className="hxi-stocks">{r.stock.map(s => <span key={s.name} className={'hxi-stock' + (s.ok ? '' : ' hxi-out')}>{s.name}{s.ok ? ' ✓' : ' ✕'}{s.nearest ? ' (nearest)' : ''}</span>)}</span>
          </div>
        ))}
      </div>
      <div className="hbr">{d.couriers.map(c => <div key={c.id} className="hxi-courier"><span className="hxi-courier-logo" style={{ background: c.color }}>{c.id}</span><div className="hxi-courier-info"><b>{c.eta} · {fmt(c.fee)}</b><span className="hxi-courier-used">{c.used} orders handed over · API: demo</span></div></div>)}</div>
    </>
  );
}
