import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import LiveTrack from '../components/LiveTrack.jsx';

export default function Track() {
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get('id') && sp.get('phone') ? { id: sp.get('id'), phone: sp.get('phone') } : null);
  const [d, setD] = useState(null);
  const [miss, setMiss] = useState(false);

  const load = useCallback(() => {
    if (!q) return Promise.resolve();
    return api.get(`/live/live?id=${encodeURIComponent(q.id)}&phone=${encodeURIComponent(q.phone)}`).then(r => { setD(r); setMiss(false); }).catch(() => { setD(null); setMiss(true); });
  }, [q]);
  useEffect(() => { load(); }, [load]);
  // refresh while the parcel is on the road so the progress bar and ETA move
  useEffect(() => {
    if (d?.flow !== 'Out for delivery') return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, 5000);
    return () => clearInterval(t);
  }, [d?.flow, load]);

  const submit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target).entries()); setQ({ id: f.id.trim(), phone: f.phone.trim() }); };
  return (
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 60px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}><h1 style={{ fontWeight: 800, fontSize: 'clamp(28px,3.4vw,42px)', letterSpacing: '-.025em', margin: 0, color: '#0b1631' }}>Track your order</h1><span style={{ color: '#5d6270', fontSize: 15 }}>Enter your order ID and mobile number.</span></div>
      <form className="track-form" onSubmit={submit} style={{ marginBottom: 18 }}>
        <input name="id" required placeholder="Order ID (e.g. AR-10481)" defaultValue={sp.get('id') || ''} />
        <input name="phone" required placeholder="Mobile number" defaultValue={sp.get('phone') || ''} />
        <button className="btn" style={{ padding: '12px 20px' }}>Track</button>
      </form>
      {miss && <div className="err">No order found with that ID and mobile number.</div>}
      {d && <LiveTrack d={d} phone={q.phone} onChanged={load} />}
    </section>
  );
}
