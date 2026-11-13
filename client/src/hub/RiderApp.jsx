import { useCallback, useEffect, useRef, useState } from 'react';
import { hubApi as hub } from '../admin/adminApi.js';
import { FLOW_COLOR } from '../components/LiveTrack.jsx';
import { fmt } from '../api.js';
import { isRiderOnly } from './hubUtils.js';

export default function RiderApp({ staff, reload }) {
  const [riders, setRiders] = useState([]);
  const [riderId, setRiderId] = useState(isRiderOnly(staff) ? staff.id : null);
  const [data, setData] = useState(null);
  const [pod, setPod] = useState(null); // order id with proof-of-delivery open
  const [mode, setMode] = useState('otp');
  const [otp, setOtp] = useState('');
  const [sigName, setSigName] = useState('');
  const [cod, setCod] = useState(false);
  const [err, setErr] = useState('');
  const canvas = useRef(null);
  const signed = useRef(false);

  const loadRiders = useCallback(() => hub.get('/riders').then(r => { setRiders(r); setRiderId(id => id ?? r[0]?.id); }), []);
  const loadMe = useCallback(() => (riderId ? hub.get('/riders/' + riderId).then(setData).catch(e => setErr(e.message)) : Promise.resolve()), [riderId]);
  useEffect(() => { loadRiders(); }, [loadRiders]);
  useEffect(() => { loadMe(); }, [loadMe]);
  const refresh = () => { loadMe(); loadRiders(); reload?.(); };
  const run = async fn => { setErr(''); try { await fn(); refresh(); return true; } catch (e) { setErr(e.message); return false; } };

  const sigRef = el => {
    canvas.current = el;
    if (!el || el._bound) return;
    el._bound = true;
    const ctx = el.getContext('2d');
    let down = false;
    const pt = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) * el.width / r.width, (e.clientY - r.top) * el.height / r.height]; };
    el.onpointerdown = e => { down = true; el.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pt(e)); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0b1631'; };
    el.onpointermove = e => { if (!down) return; ctx.lineTo(...pt(e)); ctx.stroke(); signed.current = true; };
    el.onpointerup = () => { down = false; };
  };
  const clearSig = () => { const el = canvas.current; if (el) el.getContext('2d').clearRect(0, 0, el.width, el.height); signed.current = false; };
  const openPod = j => { signed.current = false; setPod(j.id); setOtp(''); setSigName(j.name); setCod(false); setErr(''); setMode('otp'); };
  const confirm = async j => {
    if (j.cod && !cod) return setErr('Tick cash collection for this COD order.');
    if (mode === 'sig' && !signed.current) return setErr('Ask the receiver to sign in the box.');
    const ok = await run(() => hub.post(`/orders/${j.id}/deliver`, { method: mode, otp, name: sigName, signature: mode === 'sig' ? canvas.current.toDataURL('image/png') : undefined, cod }));
    if (ok) setPod(null);
  };

  if (!data) return err ? <div className="a-msg err">{err}</div> : <span className="spin" />;
  const me = data.rider;
  const cashRows = riders;
  return (
    <>
      {!isRiderOnly(staff) && (
        <div className="rider-tabs">{riders.map(r => <button key={r.id} className={r.id === riderId ? 'on' : ''} onClick={() => { setRiderId(r.id); setPod(null); }}><i>{r.name.split(' ').map(x => x[0]).join('')}</i>{r.name} · {r.jobs}</button>)}</div>
      )}
      <div className="rider-split">
        <div className="phone"><div className="screen">
          <div className="top">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}><span style={{ fontSize: 11, color: '#9fb3d1', fontWeight: 700, letterSpacing: '.06em' }}>RIDER APP</span><b style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 19 }}>{me.name}</b><span style={{ fontSize: 11.5, color: '#c9d4ea' }}>{me.vehicle}</span></div>
              <span style={{ background: 'oklch(0.72 0.15 150)', color: '#05230f', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>● On duty</span>
            </div>
            <div className="kp">{[['Assigned', data.stats.assigned], ['Delivered today', data.stats.doneToday], ['Cash in hand', fmt(data.stats.cash)]].map(([t, v]) => <div key={t}><small>{t}</small><b>{v}</b></div>)}</div>
            {data.stats.cash > 0 && <div style={{ background: '#fff', color: '#0b1631', fontSize: 12.5, padding: 9, borderRadius: 10, fontWeight: 700, textAlign: 'center' }}>Hand {fmt(data.stats.cash)} to the office — they mark it deposited</div>}
          </div>
          <div className="jobs">
            {err && <div className="a-msg err">{err}</div>}
            {!data.jobs.length && <div style={{ textAlign: 'center', color: '#7a8299', fontSize: 13, padding: '40px 10px' }}>No assigned deliveries. Assign this rider from the Dispatch board.</div>}
            {data.jobs.map(j => {
              const open = pod === j.id;
              return (
                <article key={j.id} className={'job' + (open ? ' open' : '')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b className="mono" style={{ fontSize: 12.5 }}>{j.id}</b><span style={{ background: FLOW_COLOR[j.flow], color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999 }}>{j.flow}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><b style={{ fontSize: 14 }}>{j.name}</b><span style={{ fontSize: 12, color: '#56607a', lineHeight: 1.35 }}>{j.address}</span><span style={{ fontSize: 11.5, color: '#7a8299' }}>{j.itemsN} items · from {j.branchName}</span></div>
                    <a href={'tel:' + j.phone} style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: 'oklch(0.94 0.04 150)', color: 'oklch(0.42 0.13 150)', display: 'grid', placeItems: 'center', fontSize: 16 }}>✆</a>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: j.cod ? 'oklch(0.96 0.05 85)' : 'oklch(0.96 0.03 150)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5 }}><b style={{ color: j.cod ? 'oklch(0.45 0.12 70)' : 'oklch(0.4 0.12 150)' }}>{j.cod ? 'Collect cash (COD)' : 'Prepaid — no cash'}</b><b style={{ fontFamily: 'var(--disp)', fontSize: 16, color: '#0b1631' }}>{fmt(j.total)}</b></div>
                  {j.flow === 'Packed' && <button className="hbtn" onClick={() => run(() => hub.put(`/orders/${j.id}/flow`, { flow: 'Out for delivery', note: 'Picked up by ' + me.name }))}>Pick up &amp; start trip →</button>}
                  {j.flow === 'Out for delivery' && !open && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 6 }}>
                      <button className="hbtn green" onClick={() => openPod(j)}>Deliver · OTP / signature</button>
                      <button className="hbtn ghost" onClick={() => { const r = window.prompt('Reason for failed attempt', 'Customer not reachable'); if (r) run(() => hub.post(`/orders/${j.id}/fail`, { reason: r })); }}>Failed</button>
                    </div>
                  )}
                  {j.flow === 'Out for delivery' && open && (
                    <div style={{ borderTop: '1px dashed #d5ddeb', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 4, background: '#eef2f8', borderRadius: 999, padding: 3, alignSelf: 'flex-start' }}>{[['otp', 'OTP'], ['sig', 'Signature']].map(([k, t]) => <button key={k} onClick={() => { setMode(k); setErr(''); }} style={{ border: 0, background: mode === k ? '#0b1631' : 'transparent', color: mode === k ? '#fff' : '#3a4256', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 800 }}>{t}</button>)}</div>
                      {mode === 'otp' && <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} placeholder="Enter 4-digit OTP from customer" style={{ border: '1.5px solid #d5ddeb', borderRadius: 10, padding: 11, fontSize: 18, letterSpacing: '.4em', textAlign: 'center', fontFamily: 'var(--mono)', outline: 0 }} />}
                      {mode === 'sig' && (
                        <>
                          <input value={sigName} onChange={e => setSigName(e.target.value)} placeholder="Receiver name" style={{ border: '1.5px solid #d5ddeb', borderRadius: 10, padding: '9px 11px', fontSize: 13, outline: 0 }} />
                          <div style={{ position: 'relative' }}>
                            <canvas ref={sigRef} width={360} height={130} style={{ width: '100%', height: 130, background: '#fff', border: '1.5px dashed #b9c5da', borderRadius: 10, touchAction: 'none', display: 'block' }} />
                            <span style={{ position: 'absolute', left: 10, bottom: 6, fontSize: 10.5, color: '#9aa3b8', pointerEvents: 'none' }}>Sign here</span>
                            <button onClick={clearSig} style={{ position: 'absolute', right: 6, top: 6, border: 0, background: '#eef2f8', borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '3px 8px' }}>Clear</button>
                          </div>
                        </>
                      )}
                      {j.cod && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: '#0b1631' }}><input type="checkbox" checked={cod} onChange={e => setCod(e.target.checked)} style={{ width: 17, height: 17 }} />Collected {fmt(j.total)} cash</label>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 6 }}><button className="hbtn" onClick={() => confirm(j)}>Confirm delivery</button><button className="hbtn ghost" onClick={() => { setPod(null); setErr(''); }}>Back</button></div>
                      <span style={{ fontSize: 11, color: '#7a8299' }}>Demo OTP for this order: <b className="mono">{j.otp}</b> (customer sees it on the tracking page)</span>
                    </div>
                  )}
                  {j.attempts.length > 0 && <span style={{ fontSize: 11.5, color: 'oklch(0.5 0.15 50)' }}>⚠ {j.attempts.length} failed attempt(s) · last: {j.attempts[j.attempts.length - 1].reason}</span>}
                </article>
              );
            })}
          </div>
        </div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="hcard">
            <h4>COD cash with riders</h4>
            {cashRows.map(c => <div key={c.id} className="hrow"><b>{c.name}</b><span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><b style={{ color: c.cash ? 'oklch(0.45 0.12 70)' : '#7a8299' }}>{fmt(c.cash)}</b>{c.cash > 0 && <button className="a-btn sm ghost" onClick={() => run(() => hub.post(`/riders/${c.id}/deposit`))}>Mark deposited</button>}</span></div>)}
          </div>
          <div className="hcard" style={{ fontSize: 13, lineHeight: 1.5, color: '#3a4256', gap: 8 }}>
            <h4>Proof of delivery rules</h4>
            <span>• OTP is generated when the rider starts the trip and is shown only to the customer.</span>
            <span>• Use signature when the customer can't access the OTP (office reception, elderly).</span>
            <span>• COD orders can't be closed until cash collection is ticked.</span>
            <span>• Failed attempts are logged; 3 failures auto-flags the order for a call-back.</span>
          </div>
        </div>
      </div>
    </>
  );
}
