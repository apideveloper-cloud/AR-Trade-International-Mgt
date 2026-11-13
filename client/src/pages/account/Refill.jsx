import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt, fmtDate } from '../../api.js';
import { useStore } from '../../store.jsx';
import { H2, Thumb, acc } from './shared.jsx';

export default function Refill({ orders, reload: reloadRem, rems }) {
  const { find, addToCart, say } = useStore();
  const nav = useNavigate();
  const buyAgain = useMemo(() => {
    const seen = new Map();
    (orders || []).forEach(o => o.items.forEach(i => { if (!seen.has(i.id)) seen.set(i.id, { ...i, last: o.date }); }));
    return [...seen.values()].slice(0, 12);
  }, [orders]);
  const order = (id, qty) => { const p = find(id); if (p?.price) { addToCart(p, qty); nav('/cart'); } else say('This product is not available right now'); };
  const remind = async i => { await acc.post('/reminders', { productId: i.id, qty: i.qty, every: 30 }); reloadRem(); };
  const due = r => { const d = Math.ceil((new Date(r.next) - Date.now()) / 864e5); return d <= 0 ? ['Due now', 'oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'] : d <= 7 ? [`In ${d} days`, 'oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'] : [`In ${d} days`, 'oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)']; };
  return (
    <>
      <H2 right={<span className="ac-s6">We'll remind you before your toner or ink runs out.</span>}>Refill reminders</H2>
      <div className="ac-card ac-s9">
        <div className="ac-card-hd"><b>Active reminders</b><span className="ac-s94">{rems?.filter(r => r.active).length || 0} active</span></div>
        {rems && !rems.length && <div className="ac-s118">No reminders yet. Tap “Remind me” on an item below.</div>}
        {rems?.map(r => {
          const [chip, bg, fg] = due(r);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f3f4f7', flexWrap: 'wrap', opacity: r.active ? 1 : .55 }}>
              <Thumb src={r.img} size={52} />
              <div className="ac-s119"><b className="ac-s120">{r.name}</b><span className="ac-s94">Qty {r.qty} · next on {fmtDate(r.next)}</span></div>
              <span style={{ fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 999, background: bg, color: fg }}>{chip}</span>
              <select className="ac-input ac-s121" value={r.every} onChange={async e => { await acc.put('/reminders/' + r.id, { every: e.target.value }); reloadRem(); }}>{[15, 30, 45, 60, 90].map(d => <option key={d} value={d}>Every {d} days</option>)}</select>
              <label className="ac-s122"><input type="checkbox" checked={r.active} onChange={async e => { await acc.put('/reminders/' + r.id, { active: e.target.checked }); reloadRem(); }} />On</label>
              <button className="ac-btn dark sm" onClick={() => order(r.productId, r.qty)}>Order now</button>
              <button className="ac-btn ghost sm" title="Remove" onClick={async () => { await acc.del('/reminders/' + r.id); reloadRem(); }}>✕</button>
            </div>
          );
        })}
      </div>
      <div className="ac-card ac-s9">
        <div className="ac-card-hd ac-s123"><b>Buy again</b><span className="ac-s94">From your past orders</span></div>
        {!buyAgain.length && <div className="ac-s118">Items you order will appear here.</div>}
        <div className="ac-s124">
          {buyAgain.map(b => (
            <div key={b.id} className="ac-s125">
              <Thumb src={b.img} size={48} />
              <div className="ac-s126"><b className="ac-s127">{b.name}</b><span className="ac-s94">{fmt(b.price)} · last {fmtDate(b.last)}</span></div>
              <button className="ac-btn dark sm" onClick={() => order(b.id, b.qty)}>Reorder</button>
              {!rems?.some(r => r.productId === b.id) && <button className="ac-btn ghost sm" onClick={() => remind(b)}>Remind me</button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
