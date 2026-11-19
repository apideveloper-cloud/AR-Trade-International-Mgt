import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt, fmtDate } from '../../api.js';
import { useStore } from '../../store.jsx';
import { CardHead, Empty, H2, Thumb, acc } from './shared.jsx';

export default function Refill({ orders, reload: reloadRem, rems }) {
  const { find, addToCart, say } = useStore();
  const nav = useNavigate();
  const buyAgain = useMemo(() => {
    const seen = new Map();
    (orders || []).forEach(o => o.items.forEach(i => { if (!seen.has(i.id)) seen.set(i.id, { ...i, last: o.date }); }));
    return [...seen.values()].slice(0, 12);
  }, [orders]);
  const order = (id, qty) => { const p = find(id); if (p?.price) { addToCart(p, qty); nav('/cart'); } else say('This product is not available right now'); };
  const run = async fn => { try { await fn(); } catch (er) { say(er.message); } reloadRem(); }; // a failed call shows a message instead of an unhandled rejection
  const remind = i => run(() => acc.post('/reminders', { productId: i.id, qty: i.qty, every: 30 }));
  const due = r => { const d = Math.ceil((new Date(r.next) - Date.now()) / 864e5); return d <= 0 ? ['Due now', 'oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'] : d <= 7 ? [`In ${d} days`, 'oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'] : [`In ${d} days`, 'oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)']; };
  return (
    <>
      <H2 right={<span className="ac-muted">We'll remind you before your toner or ink runs out.</span>}>Refill reminders</H2>
      <div className="ac-card ac-card-flush">
        <CardHead title="Active reminders" hint={`${rems?.filter(r => r.active).length || 0} active`} />
        {rems && !rems.length && <Empty size="sm">No reminders yet. Tap “Remind me” on an item below.</Empty>}
        {rems?.map(r => {
          const [chip, bg, fg] = due(r);
          return (
            <div key={r.id} className={r.active ? 'ac-rem-row' : 'ac-rem-row off'}>
              <Thumb src={r.img} size={52} />
              <div className="ac-rem-info"><b className="ac-title-md">{r.name}</b><span className="ac-hint">Qty {r.qty} · next on {fmtDate(r.next)}</span></div>
              <span className="ac-rem-chip" style={{ background: bg, color: fg }}>{chip}</span>
              <select className="ac-input ac-rem-select" value={r.every} onChange={e => run(() => acc.put('/reminders/' + r.id, { every: e.target.value }))}>{[15, 30, 45, 60, 90].map(d => <option key={d} value={d}>Every {d} days</option>)}</select>
              <label className="ac-rem-on"><input type="checkbox" checked={r.active} onChange={e => run(() => acc.put('/reminders/' + r.id, { active: e.target.checked }))} />On</label>
              <button className="ac-btn dark sm" onClick={() => order(r.productId, r.qty)}>Order now</button>
              <button className="ac-btn ghost sm" title="Remove" onClick={() => run(() => acc.del('/reminders/' + r.id))}>✕</button>
            </div>
          );
        })}
      </div>
      <div className="ac-card ac-card-flush">
        <CardHead title="Buy again" hint="From your past orders" className="ac-hd-left" />
        {!buyAgain.length && <Empty size="sm">Items you order will appear here.</Empty>}
        <div className="ac-buy-grid">
          {buyAgain.map(b => (
            <div key={b.id} className="ac-buy-row">
              <Thumb src={b.img} size={48} />
              <div className="ac-buy-info"><b className="ac-buy-name">{b.name}</b><span className="ac-hint">{fmt(b.price)} · last {fmtDate(b.last)}</span></div>
              <button className="ac-btn dark sm" onClick={() => order(b.id, b.qty)}>Reorder</button>
              {!rems?.some(r => r.productId === b.id) && <button className="ac-btn ghost sm" onClick={() => remind(b)}>Remind me</button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
