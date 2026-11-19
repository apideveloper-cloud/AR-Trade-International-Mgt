import { useEffect, useState } from 'react';
import { hubApi as hub } from '../admin/adminApi.js';
import { fmt, fmtTime } from '../api.js';
import './hubInline.css';

export default function Returns() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const load = () => hub.get('/returns').then(setRows).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = async (id, action) => { try { await hub.put('/returns/' + id, { action }); load(); } catch (e) { setErr(e.message); } };
  return (
    <div className="hret">
      <div className="hxi-policy">
        <span className="hxi-policy-title">Return &amp; refund policy</span>
        <span className="hxi-policy-soft">Requests within <b className="hxi-policy-strong">7 days</b> of delivery.</span>
        <span>✓ Damaged in transit — replacement or full refund</span>
        <span>✓ Wrong item delivered — free pickup &amp; exchange</span>
        <span>✓ Defective, leaking or expired cartridge — replacement after inspection</span>
        <span className="hxi-policy-no">✕ Opened toner, ink and consumables are non-returnable for change of mind</span>
        <span className="hxi-policy-soft">Refunds go back to the original method (bKash/Nagad/card) within 3–5 working days; COD refunds via bKash.</span>
      </div>
      <div className="hcard hxi-tight">
        <h4 className="hxi-retitle">Return requests</h4>
        {err && <div className="a-msg err">{err}</div>}
        {rows && !rows.length && <span className="hxi-empty">No return requests yet. Customers request them from the tracking page.</span>}
        {rows?.map(r => (
          <div key={r.id} className="hxi-retrow">
            <div className="hxi-retinfo"><span><b className="mono">{r.id}</b> · {r.name} · {fmt(r.total)}</span><span className="hxi-retreason">{r.reason} · {fmtTime(r.at)}</span></div>
            {r.status === 'Requested'
              ? <div className="hxi-retacts"><button className="a-btn sm green" onClick={() => act(r.id, 'refund')}>Refund</button><button className="a-btn sm" onClick={() => act(r.id, 'replace')}>Replace</button><button className="a-btn sm ghost" onClick={() => act(r.id, 'reject')}>Reject</button></div>
              : <b className={'hxi-retstatus ' + (r.status === 'Approved' ? 'hxi-ok' : 'hxi-bad')}>{r.status === 'Approved' ? (r.mode === 'Replacement' ? 'Replacement sent' : 'Refunded ' + fmt(r.refund)) : 'Rejected'}</b>}
          </div>
        ))}
      </div>
    </div>
  );
}
