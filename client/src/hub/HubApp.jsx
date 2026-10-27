import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './hub.css';
import { Login } from '../admin/AdminApp.jsx';
import { adm, can, getAdminToken, hubApi as hub, setAdminToken, setUnauthorizedHandler } from '../admin/adminApi.js';
import LiveTrack, { FLOW, FLOW_COLOR } from '../components/LiveTrack.jsx';
import { fmt, fmtTime } from '../api.js';

/** Can run own deliveries but has no dispatch board: shown the rider app only. */
const isRiderOnly = staff => !can(staff, 'hub.view') && can(staff, 'hub.deliver');

const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
const DONE = ['Delivered', 'Cancelled', 'Returned'];


function Dispatch({ board, reload }) {
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

function RiderApp({ staff, reload }) {
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

function TrackPage({ board }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const orders = board.orders;
  const pick = id || (orders.find(o => o.flow === 'Out for delivery') || orders[0])?.id;
  const o = orders.find(x => x.id === pick);
  const load = useCallback(() => (o ? fetch(`/api/live/live?id=${o.id}&phone=${encodeURIComponent(o.phone)}`).then(r => r.json()).then(setD) : Promise.resolve()), [o?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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

function Returns() {
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

function Branches() {
  const [d, setD] = useState(null);
  useEffect(() => { hub.get('/branches').then(setD); }, []);
  if (!d) return <span className="spin" />;
  return (
    <>
      <div className="hbr">{d.branches.map(b => <div key={b.id}><b style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 16, color: '#0b1631' }}>⌂ {b.name}</b><span style={{ fontSize: 12.5, color: '#56607a' }}>{b.area}</span><b style={{ fontSize: 12, color: 'oklch(0.45 0.15 255)' }}>{b.riders} riders · {b.active} active orders</b></div>)}</div>
      <div className="hcard" style={{ gap: 4, overflowX: 'auto' }}>
        <h4>Stock routing — nearest branch that has every item</h4>
        <span style={{ fontSize: 12, color: '#7a8299', marginBottom: 6 }}>Matched from the delivery address; falls back to the next branch with full stock, then HQ.</span>
        {!d.routing.length && <span style={{ color: '#7a8299' }}>No active orders to route.</span>}
        {d.routing.map(r => (
          <div key={r.id} className="route">
            <b className="mono">{r.id}</b><span style={{ color: '#56607a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.address}</span><b style={{ color: r.fallback ? 'oklch(0.5 0.16 40)' : 'oklch(0.45 0.15 255)' }}>→ {r.pick}</b>
            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{r.stock.map(s => <span key={s.name} style={{ fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 6, background: s.ok ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.03 25)', color: s.ok ? 'oklch(0.4 0.12 150)' : 'oklch(0.48 0.15 25)' }}>{s.name}{s.ok ? ' ✓' : ' ✕'}{s.nearest ? ' (nearest)' : ''}</span>)}</span>
          </div>
        ))}
      </div>
      <div className="hbr">{d.couriers.map(c => <div key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><span style={{ background: c.color, color: '#fff', fontWeight: 800, fontSize: 13, padding: '8px 12px', borderRadius: 10 }}>{c.id}</span><div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.35, fontSize: 12.5 }}><b>{c.eta} · {fmt(c.fee)}</b><span style={{ color: '#56607a' }}>{c.used} orders handed over · API: demo</span></div></div>)}</div>
    </>
  );
}

export default function HubApp() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
  const { board, err, load } = useBoard(staff);
  const loc = useLocation();

  const logout = useCallback(() => { setAdminToken(null); setStaff(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!getAdminToken()) { setReady(true); return; }
    adm.get('/me').then(r => setStaff(r.staff)).catch(() => setAdminToken(null)).finally(() => setReady(true));
  }, []);

  if (!ready) return <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;
  if (!staff) return <Login onDone={setStaff} />;
  const rider = isRiderOnly(staff);
  if (!rider && !can(staff, 'hub.view')) return <div style={{ padding: 40 }}><div className="a-msg err">Your role cannot open the Delivery Hub.</div></div>;

  const active = board?.orders.filter(o => !DONE.includes(o.flow)) || [];
  const nav = rider ? [['rider', 'Rider app', 0]] : [['dispatch', 'Dispatch board', active.length], ['rider', 'Rider app', board?.orders.filter(o => o.rider && o.flow === 'Out for delivery').length || 0], ['track', 'Live tracking', 0], ['returns', 'Returns & refunds', board?.returnsPending || 0], ['branches', 'Branches & couriers', 0]];
  const cur = loc.pathname.split('/')[2] || nav[0][0];
  const title = (nav.find(n => n[0] === cur) || nav[0])[1];
  const stats = board ? [['Active', active.length], ['Out for delivery', board.orders.filter(o => o.flow === 'Out for delivery').length], ['COD with riders', fmt(board.codWithRiders)], ['Returns pending', board.returnsPending]] : [];

  return (
    <div className="hub">
      <aside className="hub-side">
        <div className="brand"><img src="/ar-icon-round.png" alt="AR Trade" /><div><b>Delivery Hub</b><small>AR TRADE · OPS</small></div></div>
        <nav>{nav.map(([k, t, n]) => <NavLink key={k} to={'/hub/' + k} className={({ isActive }) => (isActive ? 'on' : '')}><span>{t}</span>{n > 0 && <em>{n}</em>}</NavLink>)}</nav>
        <div className="foot">{!rider && <Link to="/admin">← Admin console</Link>}<Link to="/">Storefront ↗</Link><button onClick={logout}>Sign out ({staff.name.split(' ')[0]})</button></div>
      </aside>
      <main className="hub-main">
        <div className="hub-head">
          <div><small>Order &amp; delivery</small><h1>{title}</h1></div>
          {!rider && <div className="hub-stats">{stats.map(([t, v]) => <div key={t}><b>{v}</b><span>{t}</span></div>)}</div>}
        </div>
        {err && !board && <div className="a-msg err">{err}</div>}
        {(rider || board) && (
          <Routes>
            <Route path="dispatch" element={rider ? <Navigate to="/hub/rider" replace /> : <Dispatch board={board} reload={load} />} />
            <Route path="rider" element={<RiderApp staff={staff} reload={load} />} />
            <Route path="track" element={rider ? <Navigate to="/hub/rider" replace /> : <TrackPage board={board} />} />
            <Route path="track/:id" element={rider ? <Navigate to="/hub/rider" replace /> : <TrackPage board={board} />} />
            <Route path="returns" element={rider ? <Navigate to="/hub/rider" replace /> : <Returns />} />
            <Route path="branches" element={rider ? <Navigate to="/hub/rider" replace /> : <Branches />} />
            <Route path="*" element={<Navigate to={'/hub/' + nav[0][0]} replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

/** The board is only loaded for office staff; riders only need their own jobs. */
function useBoard(staff) {
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const office = staff && can(staff, 'hub.view');
  const load = useCallback(() => (office ? hub.get('/board').then(b => { setBoard(b); setErr(''); }).catch(e => setErr(e.message)) : Promise.resolve()), [office]);
  useEffect(() => {
    if (!office) return undefined;
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [office, load]);
  return { board, err, load };
}
