import { useState } from 'react';
import { Link } from 'react-router-dom';
import { hubApi as hub } from '../admin/adminApi.js';
import { FLOW, FLOW_COLOR } from '../components/LiveTrack.jsx';
import { fmt } from '../api.js';
import { DONE, ago } from './hubUtils.js';
import './hubInline.css';

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
        <div className="hxi-mw0"><div className="nm">{o.name}</div><div className="ad" title={o.address}>{o.address}</div></div>
        <div className="chips">
          <span className="hxi-chip hxi-amount">{fmt(o.total)}</span>
          <span className={'hxi-chip ' + (o.cod ? 'hxi-cod' : 'hxi-paid')}>{o.cod ? 'COD' : o.payment + (o.payStatus === 'Paid' ? ' ✓' : '')}</span>
          <span className={'hxi-chip' + (o.fallback ? ' hxi-fb' : '')}>⌂ {branchName(o.branch)}</span>
        </div>
        {verify && <span className="vnote">{verify}</span>}
        {canAssign && (
          <div className="asg">
            <select value={o.rider || ''} onChange={e => run(() => hub.put(`/orders/${o.id}/rider`, { riderId: e.target.value || null }))}><option value="">Own rider…</option>{board.riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            <select value={o.courier || ''} onChange={e => run(() => hub.put(`/orders/${o.id}/courier`, { courier: e.target.value || null }))}><option value="">Courier…</option>{board.couriers.map(c => <option key={c.id}>{c.id}</option>)}</select>
          </div>
        )}
        {(o.hasRider || o.courier) && <span className="hxi-carrier">{o.courier ? `${o.courier} · ${o.courierTn}` : '🛵 ' + (rider?.name || 'Rider')}</span>}
        <div className="acts">
          {nextT && o.flow !== 'Out for delivery' && <button className={'go hxi-go' + (needCarrier ? ' hxi-wait' : '')} disabled={needCarrier} title={needCarrier ? 'Assign a rider or courier first' : ''} onClick={() => run(() => hub.put(`/orders/${o.id}/flow`, { flow: nextT }))}>{nextT === 'Out for delivery' ? 'Dispatch →' : nextT + ' →'}</button>}
          {o.flow === 'Out for delivery' && o.courier && <button className="go hxi-go hxi-done" onClick={() => run(() => hub.post(`/orders/${o.id}/deliver`, { method: 'courier', cod: o.cod }))}>Delivered ✓</button>}
          <button className="x" title="Cancel order" onClick={() => { const n = window.prompt(`Cancel ${o.id} — reason?`, 'Customer request'); if (n !== null) run(() => hub.post(`/orders/${o.id}/cancel`, { note: n })); }}>✕</button>
        </div>
      </article>
    );
  };
  return (
    <>
      <div className="legend">{[...FLOW, 'Cancelled', 'Returned'].map((t, i) => <span key={t} className="hxi-contents"><span className="p"><i style={{ background: FLOW_COLOR[t] }} />{t}</span>{i < FLOW.length - 1 && <span>→</span>}</span>)}</div>
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
          return <div key={t}><h5><i style={{ background: FLOW_COLOR[t] }} />{t} · {list.length}</h5>{list.slice(0, 5).map(o => <Link key={o.id} to={'/hub/track/' + o.id}><b className="mono">{o.id}</b><span className="hxi-donename">{o.name}</span><b>{fmt(o.total)}</b></Link>)}</div>;
        })}
      </div>
    </>
  );
}
