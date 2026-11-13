import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LiveTrack from '../components/LiveTrack.jsx';

export default function TrackPage({ board }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const orders = board.orders;
  const pick = id || (orders.find(o => o.flow === 'Out for delivery') || orders[0])?.id;
  const o = orders.find(x => x.id === pick);
  const load = useCallback(() => (o ? fetch(`/api/live/live?id=${o.id}&phone=${encodeURIComponent(o.phone)}`).then(r => r.json()).then(setD).catch(() => {}) : Promise.resolve()), [o?.id, o?.phone]);
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 4000); return () => clearInterval(t); }, [load]);
  if (!orders.length) return <div className="a-empty">No orders yet.</div>;
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <b style={{ fontSize: 13, color: '#56607a' }}>Order</b>
        <select value={pick} onChange={e => nav('/hub/track/' + e.target.value)} style={{ border: '1px solid #d5ddeb', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, background: '#fff' }}>{orders.map(x => <option key={x.id} value={x.id}>{x.id} · {x.name} · {x.flow}</option>)}</select>
        <span style={{ fontSize: 12, color: '#7a8299' }}>Customer view — same page the shopper sees from "Track order".</span>
      </div>
      {d && d.id === pick && <LiveTrack d={d} phone={o.phone} onChanged={load} />}
    </>
  );
}
