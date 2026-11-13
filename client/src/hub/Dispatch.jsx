import { useState } from 'react';
import { Link } from 'react-router-dom';
import { hubApi as hub } from '../admin/adminApi.js';
import { FLOW, FLOW_COLOR } from '../components/LiveTrack.jsx';
import { fmt } from '../api.js';
import { DONE, ago } from './hubUtils.js';

export default function Dispatch({ board, reload }) {
  const [err, setErr] = useState('');
  const run = async fn => { setErr(''); try { await fn(); reload(); } catch (e) { setErr(e.message); } };
  const orders = board.orders;
  const active = orders.filter(o => !DONE.includes(o.flow));
  const branchName = id => board.branches.find(b => b.id === id)?.name || id;
  const card = o => {
    const idx = FLOW.indexOf(o.flow), nextT = FLOW[idx + 1];
    const needCarrier = o.flow === 'Packed' && !o.hasRider && !o.courier;
    const canAssign = o.flow === 'Packed' || (o.flow === 'Out for delivery' && !o.hasRider && !o.courier);
    const verify = o.flow === 'Verification' ? (o.held ? 'High-value item — needs manager approval.' : !o.cod && o.payStatus !== 'Paid' ? `Confirm ${o.payment} payment received.` : 'Check stock, address & phone, then confirm.')
      : o.flow === 'Placed' && o.fallback ? `Nearest branch (${o.nearName}) lacks stock — routed to ${o.pickName}.` : '';
    const rider = board.riders.find(r => r.id === o.rider);
    return (
      <article key={o.id} className="ocard">
        <div className="t"><Link to={'/hub/track/' + o.id}>{o.id}</Link><span>{ago(o.date)}</span></div>
        <div style={{ minWidth: 0 }}><div className="nm">{o.name}</div><div className="ad" title={o.address}>{o.address}</div></div>
        <div className="chips">
          <span style={{ background: '#eef2f8', color: '#0b1631' }}>{fmt(o.total)}</span>
          <span style={{ background: o.cod ? 'oklch(0.96 0.05 85)' : 'oklch(0.95 0.04 150)', color: o.cod ? 'oklch(0.45 0.12 70)' : 'oklch(0.4 0.12 150)' }}>{o.cod ? 'COD' : o.payment + (o.payStatus === 'Paid' ? ' ✓' : '')}</span>
          <span style={{ background: o.fallback ? 'oklch(0.96 0.04 25)' : '#eef2f8', color: o.fallback ? 'oklch(0.48 0.16 25)' : '#3a4256' }}>⌂ {branchName(o.branch)}</span>
        </div>
        {verify && <span className="vnote">{verify}</span>}
        {canAssign && (
          <div className="asg">
            <select value={o.rider || ''} onChange={e => run(() => hub.put(`/orders/${o.id}/rider`, { riderId: e.target.value || null }))}><option value="">Own rider…</option>{board.riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <select value={o.courier || ''} onChange={e => run(() => hub.put(`/orders/${o.id}/courier`, { courier: e.target.value || null }))}><option value="">Courier…</option>{board.couriers.map(c => <option key={c.id}>{c.id}</option>)}</select>
          </div>
        )}
        {(o.hasRider || o.courier) && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'oklch(0.42 0.15 255)' }}>{o.courier ? `${o.courier} · ${o.courierTn}` : '🛵 ' + (rider?.name || 'Rider')}</span>}
        <div className="acts">
          {nextT && o.flow !== 'Out for delivery' && <button className="go" disabled={needCarrier} title={needCarrier ? 'Assign a rider or courier first' : ''} style={{ background: needCarrier ? '#b6bfd0' : '#0b1631' }} onClick={() => run(() => hub.put(`/orders/${o.id}/flow`, { flow: nextT }))}>{nextT === 'Out for delivery' ? 'Dispatch →' : nextT + ' →'}</button>}
          {o.flow === 'Out for delivery' && o.courier && <button className="go" style={{ background: 'oklch(0.55 0.16 150)' }} onClick={() => run(() => hub.post(`/orders/${o.id}/deliver`, { method: 'courier', cod: o.cod }))}>Delivered ✓</button>}
          <button className="x" title="Cancel order" onClick={() => { const n = window.prompt(`Cancel ${o.id} — reason?`, 'Customer request'); if (n !== null) run(() => hub.post(`/orders/${o.id}/cancel`, { note: n })); }}>✕</button>
        </div>
      </article>
    );
  };
  return (
    <>
      <div className="legend">{[...FLOW, 'Cancelled', 'Returned'].map((t, i) => <span key={t} style={{ display: 'contents' }}><span className="p"><i style={{ background: FLOW_COLOR[t] }} />{t}</span>{i < FLOW.length - 1 && <span>→</span>}</span>)}</div>
      {err && <div className="a-msg err">{err}</div>}
      <div className="board">
        {FLOW.slice(0, 5).map(t => {
          const list = active.filter(o => o.flow === t);
          return (
            <section key={t} className="col" style={{ borderTop: '3px solid ' + FLOW_COLOR[t] }}>
              <header><span><i style={{ background: FLOW_COLOR[t] }} />{t}</span><span className="n">{list.length}</span></header>
              {!list.length && <div className="none">No orders</div>}
              {list.map(card)}
            </section>
          );
        })}
      </div>
      <div className="donegrid">
        {['Delivered', 'Cancelled', 'Returned'].map(t => {
          const list = orders.filter(o => o.flow === t);
          return <div key={t}><h5><i style={{ background: FLOW_COLOR[t] }} />{t} · {list.length}</h5>{list.slice(0, 5).map(o => <Link key={o.id} to={'/hub/track/' + o.id}><b className="mono">{o.id}</b><span style={{ color: '#56607a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span><b>{fmt(o.total)}</b></Link>)}</div>;
        })}
      </div>
    </>
  );
}
