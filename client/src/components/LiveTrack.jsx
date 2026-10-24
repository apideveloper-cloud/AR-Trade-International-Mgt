import { useState } from 'react';
import { api, fmt, fmtTime } from '../api.js';

export const FLOW = ['Placed', 'Verification', 'Confirmed', 'Packed', 'Out for delivery', 'Delivered'];
export const FLOW_COLOR = { Placed: '#7a869f', Verification: 'oklch(0.72 0.14 75)', Confirmed: 'oklch(0.55 0.16 255)', Packed: 'oklch(0.52 0.17 295)', 'Out for delivery': 'oklch(0.6 0.12 200)', Delivered: 'oklch(0.58 0.15 150)', Cancelled: 'oklch(0.58 0.19 20)', Returned: 'oklch(0.6 0.18 350)', 'Attempt failed': 'oklch(0.7 0.15 55)' };


/** Customer-facing live tracking (also embedded in the Delivery Hub). `d` is the /api/live payload. */
export default function LiveTrack({ d, phone, onChanged }) {
  const [reason, setReason] = useState(d.returnReasons?.[0] || '');
  const [msg, setMsg] = useState('');
  const idx = FLOW.indexOf(d.flow);
  const atOf = t => { const h = [...d.history].reverse().find(x => x.s === t); return h ? fmtTime(h.at) : ''; };
  const headline = d.flow === 'Delivered' ? 'Delivered' : d.flow === 'Cancelled' ? 'Order cancelled' : d.flow === 'Returned' ? 'Returned & refunded' : d.live ? 'On the way to you' : d.courier && d.flow === 'Out for delivery' ? 'With ' + d.courier.id : 'Preparing your order';
  const canReturn = d.flow === 'Delivered' && !d.ret;
  const eligible = reason !== 'Changed my mind';
  const why = eligible ? 'Eligible — full refund or replacement after inspection.' : 'Opened toner, ink and consumables are non-returnable unless damaged, wrong, defective or expired.';

  const ask = async () => {
    setMsg('');
    try { await api.post('/live/return', { id: d.id, phone, reason }); onChanged?.(); } catch (e) { setMsg(e.message); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div style={{ ...box, gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{d.id}</span><span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 22, color: '#0b1631' }}>{headline}</span></div>
            <span style={{ background: FLOW_COLOR[d.flow] || '#7a869f', color: '#fff', fontWeight: 800, fontSize: 12, padding: '6px 12px', borderRadius: 999 }}>{d.flow}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 4 }}>
            {FLOW.map((t, i) => {
              const on = idx >= i && idx >= 0;
              return (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center' }}>
                  <span style={{ width: '100%', height: 5, borderRadius: 999, background: on ? FLOW_COLOR[t] : '#e3e8f2' }} />
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: on ? FLOW_COLOR[t] : '#fff', border: on ? 0 : '1px solid #e3e8f2', color: on ? '#fff' : '#9aa3b8', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: on ? '#0b1631' : '#9aa3b8', lineHeight: 1.25 }}>{t}</span>
                  <span style={{ fontSize: 10, color: '#7a8299' }}>{atOf(t)}</span>
                </div>
              );
            })}
          </div>
          {d.live && (
            <div style={{ background: 'linear-gradient(135deg,#0b1631,oklch(0.38 0.15 258))', borderRadius: 14, padding: 16, color: '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#c9d4ea' }}><span>⌂ {d.branchName}</span><span style={{ fontWeight: 800, color: '#fff' }}>ETA {d.live.etaMin} min</span><span>⌖ Your address</span></div>
              <div style={{ position: 'relative', height: 30 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 13, height: 4, borderRadius: 999, background: 'repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 8px,transparent 8px 14px)' }} />
                <div style={{ position: 'absolute', left: 0, top: 13, height: 4, borderRadius: 999, background: 'oklch(0.75 0.14 220)', width: d.live.pct + '%', transition: 'width 1.5s linear' }} />
                <div style={{ position: 'absolute', top: 3, left: `calc(${d.live.pct}% - 12px)`, width: 24, height: 24, borderRadius: '50%', background: '#fff', color: '#0b1631', display: 'grid', placeItems: 'center', fontSize: 13, transition: 'left 1.5s linear' }}>➤</div>
                <div style={{ position: 'absolute', right: -4, top: 5, width: 20, height: 20, borderRadius: '50%', background: 'oklch(0.72 0.15 150)', border: '3px solid #fff' }} />
              </div>
              <span style={{ fontSize: 12, color: '#c9d4ea' }}>{d.rider.name} picked up your parcel {d.live.sinceMin} min ago · location updates every few seconds</span>
            </div>
          )}
          {d.courier && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: '#eef2f8', borderRadius: 12, padding: '12px 14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ background: d.courier.color, color: '#fff', fontWeight: 800, fontSize: 12, padding: '6px 10px', borderRadius: 8 }}>{d.courier.id}</span><div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}><span style={{ fontSize: 12, color: '#56607a' }}>Tracking no.</span><b className="mono">{d.courier.tn}</b></div></div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0b1631' }}>Delivery in {d.courier.eta}</span>
            </div>
          )}
          {d.pod && <div style={{ background: 'oklch(0.96 0.04 150)', color: 'oklch(0.35 0.11 150)', borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 700 }}>✓ Delivered {fmtTime(d.pod.at)} · {d.pod.method === 'otp' ? 'OTP verified' : d.pod.method === 'courier' ? 'confirmed by ' + d.pod.name : 'signed by ' + (d.pod.name || 'receiver')}{d.pod.cash ? ' · cash ' + fmt(d.pod.cash) + ' collected' : ''}</div>}
        </div>
        <div style={{ ...box, gap: 2 }}>
          <b style={{ fontSize: 14, color: '#0b1631', marginBottom: 8 }}>Timeline</b>
          {[...d.history].reverse().map((h, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px minmax(0,1fr) auto', gap: 10, padding: '8px 0', borderTop: '1px solid #eef2f8', fontSize: 13, alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: FLOW_COLOR[h.s] || '#7a869f' }} />
              <span><b>{h.s}</b>{h.note && <span style={{ color: '#56607a' }}> — {h.note}</span>}</span>
              <span style={{ fontSize: 11.5, color: '#7a8299', whiteSpace: 'nowrap' }}>{fmtTime(h.at)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {d.rider && (d.flow === 'Out for delivery' || d.flow === 'Packed') && (
          <div style={{ ...box, padding: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#56607a' }}>YOUR RIDER</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,oklch(0.62 0.15 230),oklch(0.45 0.17 258))', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{d.rider.name.split(' ').map(x => x[0]).join('')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, flex: 1, minWidth: 0 }}><b style={{ fontSize: 15 }}>{d.rider.name}</b><span style={{ fontSize: 12, color: '#56607a' }}>{d.rider.vehicle}</span><span style={{ fontSize: 12, color: 'oklch(0.55 0.13 80)', fontWeight: 700 }}>★ {d.rider.rating}</span></div>
              <a href={'tel:' + d.rider.phone} style={{ background: '#0b1631', color: '#fff', borderRadius: 999, padding: '9px 14px', fontSize: 12.5, fontWeight: 800 }}>Call</a>
            </div>
          </div>
        )}
        {d.otp && (
          <div style={{ ...box, border: '2px solid oklch(0.62 0.16 250)', alignItems: 'center', textAlign: 'center', gap: 6, padding: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#56607a' }}>DELIVERY OTP</span>
            <span className="mono" style={{ fontWeight: 700, fontSize: 34, letterSpacing: '.3em', color: '#0b1631' }}>{d.otp}</span>
            <span style={{ fontSize: 12, color: '#56607a' }}>Share only after you receive and check the parcel.</span>
          </div>
        )}
        <div style={{ ...box, gap: 8, padding: 16, fontSize: 13 }}>
          <b style={{ fontSize: 14, color: '#0b1631' }}>Order</b>
          {d.items.map(i => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: '#3a4256', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.qty} × {i.name}</span><b style={{ whiteSpace: 'nowrap' }}>{fmt(i.price * i.qty)}</b></div>)}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eef2f8', paddingTop: 8, fontWeight: 800 }}><span>Total · {d.payment}</span><span>{fmt(d.total)}</span></div>
          <span style={{ color: '#56607a', fontSize: 12 }}>Deliver to: {d.address}</span>
        </div>
        {canReturn && phone && (
          <div style={{ ...box, padding: 16 }}>
            <b style={{ fontSize: 14, color: '#0b1631' }}>Return or replace</b>
            <select value={reason} onChange={e => setReason(e.target.value)} style={{ border: '1px solid #d5ddeb', borderRadius: 10, padding: 9, fontSize: 13, background: '#fff' }}>{d.returnReasons.map(r => <option key={r}>{r}</option>)}</select>
            <span style={{ fontSize: 12, lineHeight: 1.45, borderRadius: 10, padding: '8px 10px', background: eligible ? 'oklch(0.96 0.04 150)' : 'oklch(0.96 0.03 25)', color: eligible ? 'oklch(0.38 0.11 150)' : 'oklch(0.45 0.15 25)', fontWeight: 600 }}>{why}</span>
            {msg && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.5 0.18 25)' }}>{msg}</span>}
            <button className="btn btn-pill" disabled={!eligible} onClick={ask} style={{ background: eligible ? '#0b1631' : '#b6bfd0', padding: 10 }}>Request return</button>
          </div>
        )}
        {d.ret && <div style={{ background: 'oklch(0.97 0.03 350)', border: '1px solid oklch(0.88 0.06 350)', borderRadius: 14, padding: '12px 14px', fontSize: 13, color: 'oklch(0.4 0.14 350)', fontWeight: 700 }}>Return {d.ret.status.toLowerCase()}{d.ret.mode ? ' (' + d.ret.mode.toLowerCase() + ')' : ''} · {d.ret.reason}</div>}
      </div>
    </div>
  );
}
