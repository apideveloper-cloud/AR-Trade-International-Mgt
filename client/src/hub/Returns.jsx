import { useEffect, useState } from 'react';
import { hubApi as hub } from '../admin/adminApi.js';
import { fmt, fmtTime } from '../api.js';

export default function Returns() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const load = () => hub.get('/returns').then(setRows).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = async (id, action) => { try { await hub.put('/returns/' + id, { action }); load(); } catch (e) { setErr(e.message); } };
  return (
    <div className="hret">
      <div style={{ background: '#0b1631', color: '#fff', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, lineHeight: 1.55 }}>
        <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 18 }}>Return &amp; refund policy</span>
        <span style={{ color: '#c9d4ea' }}>Requests within <b style={{ color: '#fff' }}>7 days</b> of delivery.</span>
        <span>✓ Damaged in transit — replacement or full refund</span>
        <span>✓ Wrong item delivered — free pickup &amp; exchange</span>
        <span>✓ Defective, leaking or expired cartridge — replacement after inspection</span>
        <span style={{ color: '#f3b9c4' }}>✕ Opened toner, ink and consumables are non-returnable for change of mind</span>
        <span style={{ color: '#c9d4ea' }}>Refunds go back to the original method (bKash/Nagad/card) within 3–5 working days; COD refunds via bKash.</span>
      </div>
      <div className="hcard" style={{ gap: 4 }}>
        <h4 style={{ marginBottom: 6 }}>Return requests</h4>
        {err && <div className="a-msg err">{err}</div>}
        {rows && !rows.length && <span style={{ color: '#7a8299', padding: '20px 0' }}>No return requests yet. Customers request them from the tracking page.</span>}
        {rows?.map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #eef2f8' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><span><b className="mono">{r.id}</b> · {r.name} · {fmt(r.total)}</span><span style={{ fontSize: 12, color: '#56607a' }}>{r.reason} · {fmtTime(r.at)}</span></div>
            {r.status === 'Requested'
              ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="a-btn sm green" onClick={() => act(r.id, 'refund')}>Refund</button><button className="a-btn sm" onClick={() => act(r.id, 'replace')}>Replace</button><button className="a-btn sm ghost" onClick={() => act(r.id, 'reject')}>Reject</button></div>
              : <b style={{ fontSize: 12, color: r.status === 'Approved' ? 'oklch(0.45 0.13 150)' : 'oklch(0.5 0.18 20)' }}>{r.status === 'Approved' ? (r.mode === 'Replacement' ? 'Replacement sent' : 'Refunded ' + fmt(r.refund)) : 'Rejected'}</b>}
          </div>
        ))}
      </div>
    </div>
  );
}
