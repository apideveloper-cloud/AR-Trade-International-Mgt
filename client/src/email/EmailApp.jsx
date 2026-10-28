import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Login } from '../admin/AdminApp.jsx';
import { AdminFooter, TopBar } from '../admin/AdminChrome.jsx';
import { adm, can, getAdminToken, mktApi as api, setAdminToken, setUnauthorizedHandler } from '../admin/adminApi.js';
import { fmt, fmtDate, fmtTime } from '../api.js';

const card = { background: '#fff', borderRadius: 18, boxShadow: '0 1px 2px rgba(11,22,49,.05),0 10px 24px -18px rgba(11,22,49,.3)' };
const inp = { border: '1px solid #d3d8e3', borderRadius: 12, padding: '11px 13px', fontSize: 14, background: '#fff', width: '100%', fontFamily: 'inherit' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#56607a' };
const pct = (a, b) => (b && a != null ? Math.round(a / b * 1000) / 10 : null);
const dash = '—';
const TABS = [['reports', 'Reports'], ['automations', 'Automations'], ['campaigns', 'Campaigns'], ['templates', 'Templates'], ['audience', 'Audience & preferences'], ['setup', 'Sending & compliance']];
const TAG = { Eid: ['oklch(0.94 0.05 165)', 'oklch(0.38 0.1 165)'], Puja: ['oklch(0.95 0.05 45)', 'oklch(0.45 0.14 35)'], Boishakh: ['oklch(0.95 0.05 25)', 'oklch(0.48 0.17 25)'], 'Health tip': ['oklch(0.95 0.03 220)', 'oklch(0.42 0.1 230)'], Offer: ['oklch(0.95 0.04 255)', 'oklch(0.42 0.15 258)'] };
const Switch = ({ on, onClick }) => <button type="button" onClick={onClick} style={{ width: 44, height: 26, borderRadius: 999, border: 0, background: on ? 'oklch(0.58 0.14 150)' : '#cfd5e1', position: 'relative', padding: 0, flexShrink: 0 }}><span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} /></button>;
const Note = ({ children }) => <span style={{ fontSize: 12, color: '#7a8090' }}>{children}</span>;
const NoProvider = ({ connected }) => (connected ? null : (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'oklch(0.97 0.04 85)', border: '1px solid oklch(0.88 0.08 80)', borderRadius: 16, padding: '12px 16px', fontSize: 13, color: '#4a3b10' }}>
    <span style={{ width: 30, height: 30, borderRadius: 9, background: 'oklch(0.82 0.13 85)', color: '#16181d', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>!</span>
    <span><b>No email provider is connected.</b> Campaigns and automations are recorded and counted, but nothing is delivered until you connect one in <Link to="/email/setup" style={{ fontWeight: 700 }}>Sending &amp; compliance</Link>.</span>
  </div>
));

function Reports() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/reports').then(setD); }, []);
  if (!d) return <span className="spin" />;
  const T = d.totals;
  const kpis = [['Emails sent', T.sent.toLocaleString('en-US'), `${d.campaignsSent} campaigns sent`], ['Open rate', d.hasTracking ? pct(T.opens, T.sent) + '%' : dash, d.hasTracking ? T.opens + ' opens' : 'Needs provider tracking'], ['Click rate', d.hasTracking ? pct(T.clicks, T.sent) + '%' : dash, d.hasTracking ? T.clicks + ' clicks' : 'Needs provider tracking'], ['Unsubscribes', String(d.unsubscribed), 'Recorded in the preference log'], ['Revenue from email', T.revenue ? fmt(T.revenue) : dash, 'From results you enter']];
  const exportCsv = () => {
    const rows = [['name', 'type', 'sent', 'opens', 'clicks', 'unsubscribes', 'revenue_bdt'], ...d.rows.map(r => [r.name, r.kind, r.sent, r.opens ?? '', r.clicks ?? '', r.unsubs, r.revenue ?? ''])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(x => x.map(y => '"' + String(y).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' })); a.download = 'ar-email-report.csv'; a.click();
  };
  const bar = (v, max, c) => (v == null ? <span style={{ color: '#a0a5b1' }}>{dash}</span> : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1, height: 7, borderRadius: 999, background: '#eef1f6', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.min(100, v * max) + '%', background: c, borderRadius: 999 }} /></span><b style={{ fontSize: 12.5, width: 44, textAlign: 'right' }}>{v}%</b></div>
  ));
  return (
    <>
      <NoProvider connected={d.connected} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
        {kpis.map(([l, v, s]) => <div key={l} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 12, fontWeight: 700, color: '#6b7080' }}>{l}</span><b style={{ fontFamily: 'var(--disp)', fontSize: 28, letterSpacing: '-.02em', color: '#0b1631', whiteSpace: 'nowrap' }}>{v}</b><span style={{ fontSize: 11.5, color: '#8a8f9b' }}>{s}</span></div>)}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}><b style={{ fontSize: 15 }}>Performance by campaign &amp; automation</b><button onClick={exportCsv} style={{ border: '1px solid #d3d8e3', background: '#fff', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontWeight: 700 }}>Export CSV</button></div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead style={{ background: '#f7f8fb' }}><tr>{['Name', 'Sent', 'Open rate', 'Click rate', 'Unsubs', 'Revenue'].map((h, i) => <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 || i === 2 || i === 3 ? 'left' : 'right', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7080', width: i === 2 || i === 3 ? 200 : undefined }}>{h}</th>)}</tr></thead>
            <tbody>
              {!d.rows.length && <tr><td colSpan={6} style={{ padding: 20, color: '#6b7080' }}>Nothing sent yet.</td></tr>}
              {d.rows.map(r => (
                <tr key={r.name + r.kind}>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid #f1f2f6' }}><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><b style={{ fontSize: 13.5 }}>{r.name}</b><span style={{ fontSize: 11.5, color: '#6b7080' }}>{r.kind} · {r.when ? fmtDate(r.when) : r.running ? 'Running' : 'Paused'}{r.queued ? ` · ${r.queued} queued` : ''}</span></div></td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid #f1f2f6', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{r.sent.toLocaleString('en-US')}</td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid #f1f2f6' }}>{bar(pct(r.opens, r.sent), 1, 'linear-gradient(90deg,oklch(0.7 0.12 230),oklch(0.5 0.16 254))')}</td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid #f1f2f6' }}>{bar(pct(r.clicks, r.sent), 3, 'linear-gradient(90deg,oklch(0.78 0.12 160),oklch(0.55 0.13 160))')}</td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid #f1f2f6', textAlign: 'right', fontSize: 13 }}>{r.unsubs}</td>
                  <td style={{ padding: '12px 16px', borderTop: '1px solid #f1f2f6', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#0b1631', whiteSpace: 'nowrap' }}>{r.revenue != null ? fmt(r.revenue) : dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Note>Opens, clicks and revenue come from your email provider. Enter them on a sent campaign (Campaigns tab) until a provider is connected.</Note>
    </>
  );
}

function Automations() {
  const [rows, setRows] = useState(null);
  const load = () => api.get('/automations').then(setRows);
  useEffect(() => { load(); }, []);
  const toggle = async a => { await api.put('/automations/' + a.id, { active: !a.active }); load(); };
  if (!rows) return <span className="spin" />;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16 }}>
        {rows.map(a => (
          <div key={a.id} style={{ ...card, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><b style={{ fontFamily: 'var(--disp)', fontSize: 19, color: '#0b1631' }}>{a.name}</b><span style={{ fontSize: 12.5, color: '#6b7080' }}>Trigger: {a.trigger}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: a.active ? 'oklch(0.42 0.12 150)' : '#8a8f9b' }}>{a.active ? 'ON' : 'PAUSED'}<Switch on={a.active} onClick={() => toggle(a)} /></div>
            </div>
            <div style={{ borderLeft: '2px dashed #d3dbea', marginLeft: 8, paddingLeft: 16 }}>
              {a.steps.map(([w, t]) => (
                <div key={w} style={{ position: 'relative', padding: '6px 0', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ position: 'absolute', left: -23, top: 11, width: 12, height: 12, borderRadius: '50%', background: '#fff', border: '3px solid oklch(0.55 0.15 250)' }} />
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.48 0.16 254)', minWidth: 70 }}>{w}</span><span style={{ fontSize: 13.5, color: '#2b2e36' }}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, background: '#f6f8fc', borderRadius: 14, padding: 12 }}>
              {[['Queued now', a.live ? a.queued : dash], ['Sent', a.sent || dash], ['Wiring', a.live ? 'Live' : 'Needs provider events']].map(([k, v]) => <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 11, color: '#6b7080' }}>{k}</span><b style={{ fontSize: 14 }}>{v}</b></div>)}
            </div>
          </div>
        ))}
      </div>
      <Note>The welcome series is live: confirming a subscription queues its steps. The other automations switch on here, but need cart, order or stock events from the connected provider. They only email confirmed subscribers who allow that type.</Note>
    </>
  );
}

function ResultsForm({ c, onDone }) {
  const [open, setOpen] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    await api.put(`/campaigns/${c.id}/results`, d); setOpen(false); onDone();
  };
  if (!open) return <button onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start', border: '1px solid #d3d8e3', background: '#fff', borderRadius: 999, padding: '7px 13px', fontSize: 12.5, fontWeight: 700 }}>Enter results from provider</button>;
  return (
    <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, alignItems: 'end' }}>
      {[['opens', 'Opens'], ['clicks', 'Clicks'], ['unsubs', 'Unsubs'], ['revenue', 'Revenue ৳']].concat(c.subjB ? [['abA', 'Open % · A'], ['abB', 'Open % · B']] : []).map(([k, l]) => <label key={k} style={{ ...lbl, fontSize: 11 }}>{l}<input name={k} type="number" min="0" defaultValue={{ opens: c.opens, clicks: c.clicks, unsubs: c.unsubs, revenue: c.revenue, abA: c.ab?.[0], abB: c.ab?.[1] }[k] ?? ''} style={{ ...inp, padding: '8px 10px' }} /></label>)}
      <button style={{ border: 0, background: '#0b1631', color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, fontWeight: 800 }}>Save</button>
    </form>
  );
}

function Campaigns() {
  const [camps, setCamps] = useState(null);
  const [tpls, setTpls] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const load = () => api.get('/campaigns').then(setCamps);
  useEffect(() => { load(); api.get('/templates').then(setTpls); }, []);
  const create = async e => {
    e.preventDefault(); setErr(''); setMsg('');
    const f = e.target;
    const d = Object.fromEntries(new FormData(f).entries());
    try {
      const c = await api.post('/campaigns', d);
      setMsg(c.status === 'Sent' ? `✓ Recorded for ${c.sent} subscriber${c.sent === 1 ? '' : 's'}${c.subjB ? ' · A/B subjects saved' : ''}` : '✓ Scheduled for ' + fmtTime(c.at));
      f.reset(); load();
    } catch (er) { setErr(er.message); }
  };
  const tpl = id => tpls.find(t => t.id === id);
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <form onSubmit={create} style={{ ...card, borderRadius: 20, flex: '1 1 360px', maxWidth: 460, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <b style={{ fontFamily: 'var(--disp)', fontSize: 20, color: '#0b1631' }}>New campaign</b>
        <label style={lbl}>Campaign name<input name="name" required placeholder="e.g. Victory Day toner sale" style={inp} /></label>
        <label style={lbl}>Template<select name="tpl" style={inp}>{tpls.map(t => <option key={t.id} value={t.id}>{t.name} · {t.kind}</option>)}</select></label>
        <label style={lbl}>Subject line A<input name="subjA" required placeholder="Eid Mubarak: office restock, 18% off" style={inp} /></label>
        <label style={lbl}>Subject line B <span style={{ fontWeight: 500, color: '#8a8f9b' }}>Optional — for an A/B test; enter the winner's open rates after sending</span><input name="subjB" placeholder="Your Eid toner deal is inside" style={inp} /></label>
        <label style={lbl}>Audience<select name="aud" style={inp}><option value="offers">Subscribers who want offers</option><option value="festivals">Subscribers who want festival campaigns</option><option value="tips">Subscribers who want health tips</option><option value="all">All confirmed subscribers</option></select></label>
        <label style={lbl}>Schedule <span style={{ fontWeight: 500, color: '#8a8f9b' }}>Leave empty to send now</span><input name="when" type="datetime-local" style={inp} /></label>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.42 0.12 150)' }}>{msg}</span>}{err && <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.5 0.18 25)' }}>{err}</span>}
        <button style={{ border: 0, background: 'linear-gradient(135deg,oklch(0.6 0.14 240),oklch(0.46 0.16 256))', color: '#fff', borderRadius: 999, padding: 14, fontSize: 14.5, fontWeight: 800 }}>Schedule / send campaign</button>
        <Note>Unsubscribe and preference links are added to the footer automatically.</Note>
      </form>
      <div style={{ flex: '999 1 520px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        {camps && !camps.length && <div style={{ ...card, padding: 28, textAlign: 'center', color: '#6b7080' }}>No campaigns yet. Create the first one.</div>}
        {camps?.map(c => {
          const [tb, tf] = TAG[c.tag] || TAG.Offer;
          const sent = c.status === 'Sent';
          const win = c.ab ? (c.ab[1] > c.ab[0] ? 'B' : 'A') : null;
          const subjects = [['A', c.subjA], ...(c.subjB ? [['B', c.subjB]] : [])];
          return (
            <div key={c.id} style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: tb, color: tf }}>{c.tag}</span>
                <b style={{ fontSize: 15, flex: 1, minWidth: 160, color: '#0b1631' }}>{c.name}</b>
                <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: sent ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 85)', color: sent ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.1 70)' }}>{c.status}</span>
                <span style={{ fontSize: 12, color: '#6b7080' }}>{sent ? 'Sent ' : 'Sends '}{fmtTime(c.at)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {subjects.map(([k, t]) => (
                  <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, background: win === k ? 'oklch(0.97 0.03 150)' : '#f6f8fc', borderRadius: 10, padding: '8px 10px' }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: '#6b7080' }}>{k}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</span>
                    {c.ab && <b style={{ fontSize: 12 }}>{c.ab[k === 'A' ? 0 : 1]}% open</b>}{win === k && <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'oklch(0.9 0.08 150)', color: 'oklch(0.36 0.12 150)' }}>WINNER</span>}
                  </div>
                ))}
              </div>
              {tpl(c.template) && <span style={{ fontSize: 12, color: '#6b7080' }}>Template: {tpl(c.template).name}</span>}
              {sent && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 8, fontSize: 12 }}>
                    {[['Recipients', c.sent.toLocaleString('en-US')], ['Open rate', c.opens != null ? pct(c.opens, c.sent) + '%' : dash], ['Click rate', c.clicks != null ? pct(c.clicks, c.sent) + '%' : dash], ['Unsubs', c.unsubs], ['Revenue', c.revenue != null ? fmt(c.revenue) : dash]].map(([k, v]) => <div key={k} style={{ display: 'flex', flexDirection: 'column' }}><span style={{ color: '#6b7080' }}>{k}</span><b style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{v}</b></div>)}
                  </div>
                  <ResultsForm c={c} onDone={load} />
                </>
              )}
              {c.status === 'Scheduled' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={async () => { await api.post(`/campaigns/${c.id}/send`); load(); }} style={{ border: 0, background: '#0b1631', color: '#fff', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontWeight: 700 }}>Send now</button>
                  <button onClick={async () => { await api.del('/campaigns/' + c.id); load(); }} style={{ border: '1px solid #d3d8e3', background: '#fff', borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontWeight: 700 }}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Templates() {
  const [rows, setRows] = useState(null);
  const [pv, setPv] = useState(null);
  useEffect(() => { api.get('/templates').then(setRows); }, []);
  if (!rows) return <span className="spin" />;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14 }}>
        {rows.map(t => (
          <button key={t.id} onClick={() => setPv(t)} style={{ ...card, borderRadius: 20, textAlign: 'left', border: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform .25s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
            <div style={{ height: 118, background: t.hero, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff' }}><span style={{ alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(255,255,255,.18)', padding: '4px 9px', borderRadius: 999 }}>{t.kind}</span><b style={{ fontFamily: 'var(--disp)', fontSize: 20, lineHeight: 1.1 }}>{t.headline}</b></div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}><b style={{ fontSize: 14, color: '#0b1631' }}>{t.name}</b><span style={{ fontSize: 12, color: '#6b7080', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span><span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.48 0.16 254)', marginTop: 4 }}>Preview →</span></div>
          </button>
        ))}
      </div>
      {pv && (
        <div onClick={() => setPv(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(8,14,32,.62)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 20, overflow: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 600, background: '#e9edf4', borderRadius: 22, overflow: 'hidden', boxShadow: '0 40px 90px -30px rgba(0,0,0,.6)' }}>
            <div style={{ background: '#fff', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12.5, color: '#56607a', borderBottom: '1px solid #e3e8f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><b style={{ fontSize: 14.5, color: '#0b1631' }}>{pv.subject}</b><button onClick={() => setPv(null)} style={{ border: 0, background: 'transparent', fontSize: 18, color: '#56607a' }}>×</button></div>
              <span>From: AR Trade International &lt;hello@artradeinternational.com&gt; · {pv.preheader}</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ background: pv.hero, color: '#fff', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}><img src="/ar-icon-round.png" alt="AR Trade" style={{ width: 40, height: 40, borderRadius: '50%' }} /><b style={{ fontFamily: 'var(--disp)', fontSize: 28, lineHeight: 1.1 }}>{pv.headline}</b></div>
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}><span style={{ fontSize: 14.5, lineHeight: 1.65, color: '#2b2e36' }}>{pv.body}</span><a href="/" style={{ alignSelf: 'flex-start', background: '#0b1631', color: '#fff', borderRadius: 999, padding: '12px 22px', fontSize: 14, fontWeight: 800 }}>{pv.cta}</a></div>
                <div style={{ background: '#f6f8fc', padding: '16px 26px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, color: '#6b7080', borderTop: '1px solid #eef0f4' }}>
                  <span>You're receiving this because you subscribed at artradeinternational.com. We never share or sell your email.</span>
                  <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><b>Unsubscribe</b><b>Manage preferences</b><span>AR Trade International · Dhaka, Bangladesh</span></span>
                </div>
              </div>
              <span style={{ display: 'block', marginTop: 10, fontSize: 11.5, color: '#56607a', textAlign: 'center' }}>The footer with unsubscribe + preferences is locked and added to every email.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Audience() {
  const [d, setD] = useState(null);
  const load = () => api.get('/audience').then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <span className="spin" />;
  const CH = [['offers', 'Offers'], ['festivals', 'Festivals'], ['tips', 'Health tips'], ['refill', 'Refill alerts']];
  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'oklch(0.96 0.03 250)', border: '1px solid oklch(0.88 0.05 250)', borderRadius: 16, padding: '14px 18px', fontSize: 13.5, color: '#0b1631' }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: '#0b1631', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>✓</span>
        <span><b>Our list is never shared or sold.</b> Subscribers only get what they chose in their preference center, and an unsubscribe takes effect immediately.</span>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><b style={{ fontSize: 15 }}>Confirmed subscribers · {d.subscribers.length}</b><span style={{ fontSize: 12, color: '#6b7080' }}>Preferences are set by the subscriber, not by staff.</span></div>
        {!d.subscribers.length && <div style={{ padding: '18px 20px', color: '#6b7080', fontSize: 13 }}>No confirmed subscribers yet.</div>}
        {d.subscribers.map(u => (
          <div key={u.email} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #f1f2f6', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 13.5, flex: 1, minWidth: 200 }}>{u.email}</b>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{CH.map(([k, t]) => <span key={k} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, background: u.prefs[k] ? 'oklch(0.95 0.04 250)' : '#f1f2f5', color: u.prefs[k] ? 'oklch(0.42 0.15 256)' : '#a0a5b1' }}>{t}</span>)}</div>
            {u.token && <a href={'/prefs/' + u.token} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700 }}>Preference page ↗</a>}
            <button onClick={async () => { if (window.confirm('Unsubscribe ' + u.email + '?')) { await api.del('/audience/' + encodeURIComponent(u.email)); load(); } }} style={{ border: 0, background: 'transparent', color: 'oklch(0.5 0.18 25)', fontSize: 12.5, fontWeight: 700 }}>Unsubscribe</button>
          </div>
        ))}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4' }}><b style={{ fontSize: 15 }}>Unsubscribe &amp; preference log</b></div>
        {!d.log.length && <div style={{ padding: '18px 20px', fontSize: 13, color: '#6b7080' }}>No changes yet.</div>}
        {d.log.map((l, i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 20px', borderTop: '1px solid #f1f2f6', fontSize: 13, flexWrap: 'wrap' }}><span className="mono" style={{ fontSize: 11.5, color: '#6b7080', minWidth: 130 }}>{fmtTime(l.at)}</span><b>{l.email}</b><span style={{ color: '#56607a' }}>{l.what}</span></div>)}
      </div>
    </>
  );
}

const RULES = [['✓', 'Double opt-in only', 'Nobody is added until they click the confirmation link.'], ['✓', 'One-click unsubscribe', 'Every email carries unsubscribe and preference links; it takes effect immediately.'], ['✓', 'Preferences respected', 'Campaigns only reach people who allow that type of email.'], ['✓', 'Consent is logged', 'Date, time, source and IP are kept for every signup.'], ['✓', 'No sharing or selling', 'The list is never shared or sold.'], ['!', 'Authenticate your domain', 'SPF, DKIM and DMARC keep your emails out of spam.']];

function Setup() {
  const [d, setD] = useState(null);
  const [saved, setSaved] = useState('');
  const [checking, setChecking] = useState(false);
  const load = () => api.get('/setup').then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <span className="spin" />;
  const pick = async n => { await api.put('/setup', { provider: n }); load(); };
  const save = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    try { await api.put('/setup', f); setSaved('✓ Saved'); e.target.key.value = ''; load(); } catch (er) { setSaved(er.message); }
  };
  const check = async () => { setChecking(true); try { await api.post('/setup/check-dns'); await load(); } finally { setChecking(false); } };
  return (
    <>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...card, borderRadius: 20, flex: '1 1 380px', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <b style={{ fontFamily: 'var(--disp)', fontSize: 20, color: '#0b1631' }}>Email service provider</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
            {d.providers.map(p => <button key={p.n} onClick={() => pick(p.n)} style={{ border: '1.5px solid ' + (d.provider === p.n ? 'oklch(0.55 0.15 252)' : '#e3e8f2'), background: d.provider === p.n ? 'oklch(0.97 0.02 250)' : '#fff', borderRadius: 14, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', textAlign: 'left' }}><b style={{ fontSize: 14, color: '#0b1631' }}>{p.n}</b><span style={{ fontSize: 11, color: '#6b7080' }}>{p.d}</span></button>)}
          </div>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={lbl}>API key {d.hasKey && <span style={{ fontWeight: 500, color: '#8a8f9b' }}>saved ({d.keyHint}) — enter a new one to replace it</span>}<input name="apiKey" type="password" placeholder="Paste your provider API key" style={inp} autoComplete="off" /></label>
            <label style={lbl}>Sender<input name="from" defaultValue={d.from} style={inp} /></label>
            <button style={{ alignSelf: 'flex-start', border: 0, background: '#0b1631', color: '#fff', borderRadius: 999, padding: '10px 18px', fontSize: 13, fontWeight: 700 }}>Save connection</button>
            {saved && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'oklch(0.42 0.12 150)' }}>{saved}</span>}
          </form>
          <Note>The key is stored on the server only. Sending through the provider isn't built in yet — this records your connection for when delivery is wired up.</Note>
        </div>
        <div style={{ ...card, borderRadius: 20, flex: '1 1 380px', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <b style={{ fontFamily: 'var(--disp)', fontSize: 20, color: '#0b1631' }}>Rules we enforce</b>
          {RULES.map(([ic, t, ds]) => <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><span style={{ width: 24, height: 24, borderRadius: '50%', background: ic === '✓' ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 85)', color: ic === '✓' ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.1 70)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{ic}</span><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 13.5 }}>{t}</b><span style={{ fontSize: 12.5, color: '#6b7080' }}>{ds}</span></div></div>)}
        </div>
      </div>
      <div style={{ ...card, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 15 }}>Domain authentication · {d.domain}</b><span style={{ fontSize: 12, color: '#6b7080' }}>Add these DNS records at your domain host, then check.</span></div>
          <button onClick={check} disabled={checking} style={{ border: 0, background: 'linear-gradient(135deg,oklch(0.6 0.14 240),oklch(0.46 0.16 256))', color: '#fff', borderRadius: 999, padding: '9px 16px', fontSize: 12.5, fontWeight: 800 }}>{checking ? 'Checking…' : 'Check DNS'}</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <tbody>{d.dns.map(r => (
              <tr key={r.k}>
                <td style={{ padding: '14px 20px', borderTop: '1px solid #f1f2f6', width: 110 }}><b style={{ fontSize: 13.5 }}>{r.k}</b><div style={{ fontSize: 11, color: '#6b7080' }}>{r.type}</div></td>
                <td className="mono" style={{ padding: '14px 12px', borderTop: '1px solid #f1f2f6', fontSize: 12, color: '#56607a', width: 240 }}>{r.host}</td>
                <td className="mono" style={{ padding: '14px 12px', borderTop: '1px solid #f1f2f6', fontSize: 12, wordBreak: 'break-all' }}>{r.val}</td>
                <td style={{ padding: '14px 20px', borderTop: '1px solid #f1f2f6', textAlign: 'right', width: 120 }}><span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: r.ok ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 85)', color: r.ok ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.1 70)', whiteSpace: 'nowrap' }}>{r.ok ? 'Verified' : 'Not found'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function EmailApp() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState(null);
  const loc = useLocation();
  const nav = useNavigate();
  const logout = useCallback(() => { setAdminToken(null); setStaff(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!getAdminToken()) { setReady(true); return; }
    adm.get('/me').then(r => setStaff(r.staff)).catch(() => setAdminToken(null)).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (staff) api.get('/setup').then(setSetup).catch(() => {}); }, [staff, loc.pathname]);

  if (!ready) return <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;
  if (!staff) return <Login onDone={setStaff} />;
  if (!can(staff, 'marketing.manage')) return <div style={{ padding: 40 }}><div className="a-msg err">Your role cannot open the Email Center.</div></div>;
  const cur = loc.pathname.split('/')[2] || 'reports';
  const title = (TABS.find(t => t[0] === cur) || TABS[0])[1];
  const dnsOk = setup?.dns.every(r => r.ok);
  const ICON = { reports: '▦', automations: '⚙', campaigns: '✉', templates: '❏', audience: '☺', setup: '✦' };
  const groups = [['Email Center', TABS.map(([k, l]) => [k, l, ICON[k] || '•', 'marketing.manage'])]];
  const status = setup ? `${setup.provider}${setup.hasKey ? ' · connected' : ' · not connected'}${dnsOk ? ' · domain verified' : ''}` : '…';
  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand logo"><img src="/admin-logo-light.png" alt="AR Trade International" /><small>Email Center</small></div>
        <nav className="adm-nav">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h6>Email</h6>
            {TABS.map(([k, l]) => <NavLink key={k} to={'/email/' + k} className={({ isActive }) => (isActive ? 'on' : '')}><span className="ic">{ICON[k]}</span><span className="tx">{l}</span></NavLink>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h6>Go to</h6>
            <Link to="/admin/marketing"><span className="ic">←</span><span className="tx">Admin console</span></Link>
          </div>
        </nav>
        <div className="em-status"><i className={setup?.hasKey && dnsOk ? 'ok' : 'warn'} />{status}</div>
        <div className="adm-user"><span className="av">{staff.name[0]}</span><div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}><b>{staff.name}</b><small>{staff.role}</small></div><button onClick={logout} title="Sign out">⏻</button></div>
      </aside>
      <main className="adm-main">
        <TopBar staff={staff} groups={groups} page={cur} title={title} go={k => nav('/email/' + k)} logout={logout} />
        <div className="adm-body" key={cur}>
          <Routes>
            <Route path="reports" element={<Reports />} />
            <Route path="automations" element={<Automations />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="templates" element={<Templates />} />
            <Route path="audience" element={<Audience />} />
            <Route path="setup" element={<Setup />} />
            <Route path="*" element={<Navigate to="/email/reports" replace />} />
          </Routes>
        </div>
        <AdminFooter staff={staff} />
      </main>
    </div>
  );
}
