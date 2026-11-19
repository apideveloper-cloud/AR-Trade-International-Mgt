import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LiveTrack from '../components/LiveTrack.jsx';
import './hubInline.css';

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
      <div className="hxi-trackbar">
        <b className="hxi-tracklabel">Order</b>
        <select className="hxi-trackselect" value={pick} onChange={e => nav('/hub/track/' + e.target.value)}>{orders.map(x => <option key={x.id} value={x.id}>{x.id} · {x.name} · {x.flow}</option>)}</select>
        <span className="hxi-trackhint">Customer view — same page the shopper sees from "Track order".</span>
      </div>
      {d && d.id === pick && <LiveTrack d={d} phone={o.phone} onChanged={load} />}
    </>
  );
}
