import { useCallback, useEffect, useRef, useState } from 'react';
import { can, hubApi as hub } from '../admin/adminApi.js';
import { FLOW_COLOR } from '../components/LiveTrack.jsx';
import { fmt } from '../api.js';
import { isRiderOnly } from './hubUtils.js';
import './hubInline.css';

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
  const liveRider = useRef(riderId); // ignore a slow response for a rider tab the user already left

  const loadRiders = useCallback(() => hub.get('/riders').then(r => { setRiders(r); setRiderId(id => id ?? r[0]?.id); }).catch(e => setErr(e.message)), []);
  const loadMe = useCallback(() => (riderId ? hub.get('/riders/' + riderId).then(d => { if (liveRider.current === riderId) setData(d); }).catch(e => setErr(e.message)) : Promise.resolve()), [riderId]);
  liveRider.current = riderId;
  useEffect(() => { loadRiders(); }, [loadRiders]);
  useEffect(() => { loadMe(); }, [loadMe]);
  const refresh = () => { loadMe(); loadRiders(); reload?.(); };
  const run = async fn => { setErr(''); try { await fn(); refresh(); return true; } catch (e) { setErr(e.message); return false; } };

  const sigRef = el => {
    canvas.current = el;
    if (!el || el._bound) return;
    el._bound = true;
    signed.current = false; // a freshly mounted canvas is blank
    const ctx = el.getContext('2d');
    let down = false;
    const pt = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) * el.width / r.width, (e.clientY - r.top) * el.height / r.height]; };
    el.onpointerdown = e => { down = true; el.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pt(e)); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0b1631'; };
    el.onpointermove = e => { if (!down) return; ctx.lineTo(...pt(e)); ctx.stroke(); signed.current = true; };
    el.onpointerup = el.onpointercancel = () => { down = false; };
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
            <div className="hxi-between">
              <div className="hxi-who"><span className="hxi-eyebrow">RIDER APP</span><b className="hxi-ridername">{me.name}</b><span className="hxi-vehicle">{me.vehicle}</span></div>
              <span className="hxi-duty">● On duty</span>
            </div>
            <div className="kp">{[['Assigned', data.stats.assigned], ['Delivered today', data.stats.doneToday], ['Cash in hand', fmt(data.stats.cash)]].map(([t, v]) => <div key={t}><small>{t}</small><b>{v}</b></div>)}</div>
            {data.stats.cash > 0 && <div className="hxi-handcash">Hand {fmt(data.stats.cash)} to the office — they mark it deposited</div>}
          </div>
          <div className="jobs">
            {err && <div className="a-msg err">{err}</div>}
            {!data.jobs.length && <div className="hxi-nojobs">No assigned deliveries. Assign this rider from the Dispatch board.</div>}
            {data.jobs.map(j => {
              const open = pod === j.id;
              return (
                <article key={j.id} className={'job' + (open ? ' open' : '')}>
                  <div className="hxi-between"><b className="mono hxi-jobid">{j.id}</b><span className="hxi-flowpill" style={{ background: FLOW_COLOR[j.flow] }}>{j.flow}</span></div>
                  <div className="hxi-jobmain">
                    <div className="hxi-jobtxt"><b className="hxi-jobname">{j.name}</b><span className="hxi-jobaddr">{j.address}</span><span className="hxi-jobitems">{j.itemsN} items · from {j.branchName}</span></div>
                    <a href={'tel:' + j.phone} className="hxi-call">✆</a>
                  </div>
                  <div className={'hxi-paybar' + (j.cod ? ' hxi-cod' : '')}><b className="hxi-paylabel">{j.cod ? 'Collect cash (COD)' : 'Prepaid — no cash'}</b><b className="hxi-paytotal">{fmt(j.total)}</b></div>
                  {j.flow === 'Packed' && <button className="hbtn" onClick={() => run(() => hub.put(`/orders/${j.id}/flow`, { flow: 'Out for delivery', note: 'Picked up by ' + me.name }))}>Pick up &amp; start trip →</button>}
                  {j.flow === 'Out for delivery' && !open && (
                    <div className="hxi-btnrow">
                      <button className="hbtn green" onClick={() => openPod(j)}>Deliver · OTP / signature</button>
                      <button className="hbtn ghost" onClick={() => { const r = window.prompt('Reason for failed attempt', 'Customer not reachable'); if (r) run(() => hub.post(`/orders/${j.id}/fail`, { reason: r })); }}>Failed</button>
                    </div>
                  )}
                  {j.flow === 'Out for delivery' && open && (
                    <div className="hxi-pod">
                      <div className="hxi-modes">{[['otp', 'OTP'], ['sig', 'Signature']].map(([k, t]) => <button key={k} className={'hxi-mode' + (mode === k ? ' hxi-on' : '')} onClick={() => { setMode(k); setErr(''); }}>{t}</button>)}</div>
                      {mode === 'otp' && <input className="hxi-otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={4} placeholder="Enter 4-digit OTP from customer" />}
                      {mode === 'sig' && (
                        <>
                          <input className="hxi-signame" value={sigName} onChange={e => setSigName(e.target.value)} placeholder="Receiver name" />
                          <div className="hxi-sigwrap">
                            <canvas ref={sigRef} className="hxi-sigcanvas" width={360} height={130} />
                            <span className="hxi-sighint">Sign here</span>
                            <button className="hxi-sigclear" onClick={clearSig}>Clear</button>
                          </div>
                        </>
                      )}
                      {j.cod && <label className="hxi-codtick"><input type="checkbox" className="hxi-codbox" checked={cod} onChange={e => setCod(e.target.checked)} />Collected {fmt(j.total)} cash</label>}
                      <div className="hxi-btnrow"><button className="hbtn" onClick={() => confirm(j)}>Confirm delivery</button><button className="hbtn ghost" onClick={() => { setPod(null); setErr(''); }}>Back</button></div>
                      <span className="hxi-demootp">Demo OTP for this order: <b className="mono">{j.otp}</b> (customer sees it on the tracking page)</span>
                    </div>
                  )}
                  {j.attempts.length > 0 && <span className="hxi-attempts">⚠ {j.attempts.length} failed attempt(s) · last: {j.attempts[j.attempts.length - 1].reason}</span>}
                </article>
              );
            })}
          </div>
        </div></div>
        <div className="hxi-side">
          <div className="hcard">
            <h4>COD cash with riders</h4>
            {cashRows.map(c => <div key={c.id} className="hrow"><b>{c.name}</b><span className="hxi-cashvals"><b className={'hxi-cashamt' + (c.cash ? ' hxi-has' : '')}>{fmt(c.cash)}</b>{c.cash > 0 && can(staff, 'hub.cash') && <button className="a-btn sm ghost" onClick={() => run(() => hub.post(`/riders/${c.id}/deposit`))}>Mark deposited</button>}</span></div>)}
          </div>
          <div className="hcard hxi-rules">
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
