import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Login } from '../admin/AdminApp.jsx';
import { AdminFooter, TopBar } from '../admin/AdminChrome.jsx';
import { adm, can, getAdminToken, mktApi as api, setAdminToken, setUnauthorizedHandler } from '../admin/adminApi.js';
import { fmt, fmtDate, fmtTime } from '../api.js';
import { CampaignForm } from './CampaignForm.jsx';
import './emailInline.css';

const card = { background: '#fff', borderRadius: 18, boxShadow: '0 1px 2px rgba(11,22,49,.05),0 10px 24px -18px rgba(11,22,49,.3)' };
const inp = { border: '1px solid #d3d8e3', borderRadius: 12, padding: '11px 13px', fontSize: 14, background: '#fff', width: '100%', fontFamily: 'inherit' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#56607a' };
const pct = (a, b) => (b && a != null ? Math.round(a / b * 1000) / 10 : null);
const dash = '—';
const TABS = [['reports', 'Reports'], ['automations', 'Automations'], ['campaigns', 'Campaigns'], ['templates', 'Templates'], ['audience', 'Audience & preferences'], ['setup', 'Sending & compliance']];
const TAG = { Eid: ['oklch(0.94 0.05 165)', 'oklch(0.38 0.1 165)'], Puja: ['oklch(0.95 0.05 45)', 'oklch(0.45 0.14 35)'], Boishakh: ['oklch(0.95 0.05 25)', 'oklch(0.48 0.17 25)'], 'Health tip': ['oklch(0.95 0.03 220)', 'oklch(0.42 0.1 230)'], Offer: ['oklch(0.95 0.04 255)', 'oklch(0.42 0.15 258)'] };
const Switch = ({ on, onClick }) => <button type="button" onClick={onClick} style={{ width: 44, height: 26, borderRadius: 999, border: 0, background: on ? 'oklch(0.58 0.14 150)' : '#cfd5e1', position: 'relative', padding: 0, flexShrink: 0 }}><span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} /></button>;
const Note = ({ children }) => <span className="em-s1">{children}</span>;
const NoProvider = ({ connected }) => (connected ? null : (
  <div className="em-s2">
    <span className="em-s3">!</span>
    <span><b>No email provider is connected.</b> Campaigns and automations are recorded and counted, but nothing is delivered until you connect one in <Link to="/email/setup" className="em-s4">Sending &amp; compliance</Link>.</span>
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
  const bar = (v, max, c) => (v == null ? <span className="em-s5">{dash}</span> : (
    <div className="em-s6"><span className="em-s7"><span style={{ display: 'block', height: '100%', width: Math.min(100, v * max) + '%', background: c, borderRadius: 999 }} /></span><b className="em-s8">{v}%</b></div>
  ));
  return (
    <>
      <NoProvider connected={d.connected} />
      <div className="em-s9">
        {kpis.map(([l, v, s]) => <div key={l} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}><span className="em-s10">{l}</span><b className="em-s11">{v}</b><span className="em-s12">{s}</span></div>)}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="em-s13"><b className="em-s14">Performance by campaign &amp; automation</b><button onClick={exportCsv} className="em-s15">Export CSV</button></div>
        <div className="em-s16">
          <table className="em-s17">
            <thead className="em-s18"><tr>{['Name', 'Sent', 'Open rate', 'Click rate', 'Unsubs', 'Revenue'].map((h, i) => <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 || i === 2 || i === 3 ? 'left' : 'right', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7080', width: i === 2 || i === 3 ? 200 : undefined }}>{h}</th>)}</tr></thead>
            <tbody>
              {!d.rows.length && <tr><td colSpan={6} className="em-s19">Nothing sent yet.</td></tr>}
              {d.rows.map(r => (
                <tr key={r.name + r.kind}>
                  <td className="em-s20"><div className="em-s21"><b className="em-s22">{r.name}</b><span className="em-s23">{r.kind} · {r.when ? fmtDate(r.when) : r.running ? 'Running' : 'Paused'}{r.queued ? ` · ${r.queued} queued` : ''}</span></div></td>
                  <td className="em-s24">{r.sent.toLocaleString('en-US')}</td>
                  <td className="em-s20">{bar(pct(r.opens, r.sent), 1, 'linear-gradient(90deg,oklch(0.7 0.12 230),oklch(0.5 0.16 254))')}</td>
                  <td className="em-s20">{bar(pct(r.clicks, r.sent), 3, 'linear-gradient(90deg,oklch(0.78 0.12 160),oklch(0.55 0.13 160))')}</td>
                  <td className="em-s25">{r.unsubs}</td>
                  <td className="em-s26">{r.revenue != null ? fmt(r.revenue) : dash}</td>
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
      <div className="em-s27">
        {rows.map(a => (
          <div key={a.id} style={{ ...card, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="em-s28">
              <div className="em-s29"><b className="em-s30">{a.name}</b><span className="em-s31">Trigger: {a.trigger}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: a.active ? 'oklch(0.42 0.12 150)' : '#8a8f9b' }}>{a.active ? 'ON' : 'PAUSED'}<Switch on={a.active} onClick={() => toggle(a)} /></div>
            </div>
            <div className="em-s32">
              {a.steps.map(([w, t]) => (
                <div key={w} className="em-s33">
                  <span className="em-s34" />
                  <span className="mono em-s35">{w}</span><span className="em-s36">{t}</span>
                </div>
              ))}
            </div>
            <div className="em-s37">
              {[['Queued now', a.live ? a.queued : dash], ['Sent', a.sent || dash], ['Wiring', a.live ? 'Live' : 'Needs provider events']].map(([k, v]) => <div key={k} className="em-s38"><span className="em-s39">{k}</span><b className="em-s40">{v}</b></div>)}
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
  if (!open) return <button onClick={() => setOpen(true)} className="em-s41">Enter results from provider</button>;
  return (
    <form onSubmit={submit} className="em-s42">
      {[['opens', 'Opens'], ['clicks', 'Clicks'], ['unsubs', 'Unsubs'], ['revenue', 'Revenue ৳']].concat(c.subjB ? [['abA', 'Open % · A'], ['abB', 'Open % · B']] : []).map(([k, l]) => <label key={k} style={{ ...lbl, fontSize: 11 }}>{l}<input name={k} type="number" min="0" defaultValue={{ opens: c.opens, clicks: c.clicks, unsubs: c.unsubs, revenue: c.revenue, abA: c.ab?.[0], abB: c.ab?.[1] }[k] ?? ''} style={{ ...inp, padding: '8px 10px' }} /></label>)}
      <button className="em-s43">Save</button>
    </form>
  );
}

function Campaigns() {
  const [camps, setCamps] = useState(null);
  const [tpls, setTpls] = useState([]);
  const load = () => api.get('/campaigns').then(setCamps);
  useEffect(() => { load(); api.get('/templates').then(setTpls); }, []);
  const tpl = id => tpls.find(t => t.id === id);
  return (
    <div className="em-s44">
      <CampaignForm tpls={tpls} onDone={load} />
      <div className="em-s45">
        {camps && !camps.length && <div style={{ ...card, padding: 28, textAlign: 'center', color: '#6b7080' }}>No campaigns yet. Create the first one.</div>}
        {camps?.map(c => {
          const [tb, tf] = TAG[c.tag] || TAG.Offer;
          const sent = c.status === 'Sent';
          const win = c.ab ? (c.ab[1] > c.ab[0] ? 'B' : 'A') : null;
          const subjects = [['A', c.subjA], ...(c.subjB ? [['B', c.subjB]] : [])];
          return (
            <div key={c.id} style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="em-s46">
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: tb, color: tf }}>{c.tag}</span>
                <b className="em-s47">{c.name}</b>
                <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: sent ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 85)', color: sent ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.1 70)' }}>{c.status}</span>
                <span className="em-s48">{sent ? 'Sent ' : 'Sends '}{fmtTime(c.at)}</span>
              </div>
              <div className="em-s49">
                {subjects.map(([k, t]) => (
                  <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, background: win === k ? 'oklch(0.97 0.03 150)' : '#f6f8fc', borderRadius: 10, padding: '8px 10px' }}>
                    <span className="mono em-s50">{k}</span><span className="em-s51">{t}</span>
                    {c.ab && <b className="em-s52">{c.ab[k === 'A' ? 0 : 1]}% open</b>}{win === k && <span className="em-s53">WINNER</span>}
                  </div>
                ))}
              </div>
              {tpl(c.template) && <span className="em-s48">Template: {tpl(c.template).name}</span>}
              {sent && (
                <>
                  <div className="em-s54">
                    {[['Recipients', c.sent.toLocaleString('en-US')], ['Open rate', c.opens != null ? pct(c.opens, c.sent) + '%' : dash], ['Click rate', c.clicks != null ? pct(c.clicks, c.sent) + '%' : dash], ['Unsubs', c.unsubs], ['Revenue', c.revenue != null ? fmt(c.revenue) : dash]].map(([k, v]) => <div key={k} className="em-s55"><span className="em-s56">{k}</span><b className="em-s57">{v}</b></div>)}
                  </div>
                  <ResultsForm c={c} onDone={load} />
                </>
              )}
              {c.status === 'Scheduled' && (
                <div className="em-s58">
                  <button onClick={async () => { await api.post(`/campaigns/${c.id}/send`); load(); }} className="em-s59">Send now</button>
                  <button onClick={async () => { await api.del('/campaigns/' + c.id); load(); }} className="em-s15">Cancel</button>
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
      <div className="em-s60">
        {rows.map(t => (
          <button key={t.id} onClick={() => setPv(t)} style={{ ...card, borderRadius: 20, textAlign: 'left', border: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform .25s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
            <div style={{ height: 118, background: t.hero, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff' }}><span className="em-s61">{t.kind}</span><b className="em-s62">{t.headline}</b></div>
            <div className="em-s63"><b className="em-s64">{t.name}</b><span className="em-s65">{t.subject}</span><span className="em-s66">Preview →</span></div>
          </button>
        ))}
      </div>
      {pv && (
        <div onClick={() => setPv(null)} className="em-s67">
          <div onClick={e => e.stopPropagation()} className="em-s68">
            <div className="em-s69">
              <div className="em-s70"><b className="em-s71">{pv.subject}</b><button onClick={() => setPv(null)} className="em-s72">×</button></div>
              <span>From: AR Trade International &lt;hello@artradeinternational.com&gt; · {pv.preheader}</span>
            </div>
            <div className="em-s73">
              <div className="em-s74">
                <div style={{ background: pv.hero, color: '#fff', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}><img src="/ar-icon-round.png" alt="AR Trade" className="em-s75" /><b className="em-s76">{pv.headline}</b></div>
                <div className="em-s77"><span className="em-s78">{pv.body}</span><a href="/" className="em-s79">{pv.cta}</a></div>
                <div className="em-s80">
                  <span>You're receiving this because you subscribed at artradeinternational.com. We never share or sell your email.</span>
                  <span className="em-s81"><b>Unsubscribe</b><b>Manage preferences</b><span>AR Trade International · Dhaka, Bangladesh</span></span>
                </div>
              </div>
              <span className="em-s82">The footer with unsubscribe + preferences is locked and added to every email.</span>
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
      <div className="em-s83">
        <span className="em-s84">✓</span>
        <span><b>Our list is never shared or sold.</b> Subscribers only get what they chose in their preference center, and an unsubscribe takes effect immediately.</span>
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="em-s85"><b className="em-s14">Confirmed subscribers · {d.subscribers.length}</b><span className="em-s48">Preferences are set by the subscriber, not by staff.</span></div>
        {!d.subscribers.length && <div className="em-s86">No confirmed subscribers yet.</div>}
        {d.subscribers.map(u => (
          <div key={u.email} className="em-s87">
            <b className="em-s88">{u.email}</b>
            <div className="em-s89">{CH.map(([k, t]) => <span key={k} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, background: u.prefs[k] ? 'oklch(0.95 0.04 250)' : '#f1f2f5', color: u.prefs[k] ? 'oklch(0.42 0.15 256)' : '#a0a5b1' }}>{t}</span>)}</div>
            {u.token && <a href={'/prefs/' + u.token} target="_blank" rel="noreferrer" className="em-s90">Preference page ↗</a>}
            <button onClick={async () => { if (window.confirm('Unsubscribe ' + u.email + '?')) { await api.del('/audience/' + encodeURIComponent(u.email)); load(); } }} className="em-s91">Unsubscribe</button>
          </div>
        ))}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="em-s92"><b className="em-s14">Unsubscribe &amp; preference log</b></div>
        {!d.log.length && <div className="em-s93">No changes yet.</div>}
        {d.log.map((l, i) => <div key={i} className="em-s94"><span className="mono em-s95">{fmtTime(l.at)}</span><b>{l.email}</b><span className="em-s96">{l.what}</span></div>)}
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
      <div className="em-s44">
        <div style={{ ...card, borderRadius: 20, flex: '1 1 380px', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <b className="em-s97">Email service provider</b>
          <div className="em-s98">
            {d.providers.map(p => <button key={p.n} onClick={() => pick(p.n)} style={{ border: '1.5px solid ' + (d.provider === p.n ? 'oklch(0.55 0.15 252)' : '#e3e8f2'), background: d.provider === p.n ? 'oklch(0.97 0.02 250)' : '#fff', borderRadius: 14, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', textAlign: 'left' }}><b className="em-s64">{p.n}</b><span className="em-s39">{p.d}</span></button>)}
          </div>
          <form onSubmit={save} className="em-s99">
            <label style={lbl}>API key {d.hasKey && <span className="em-s100">saved ({d.keyHint}) — enter a new one to replace it</span>}<input name="apiKey" type="password" placeholder="Paste your provider API key" style={inp} autoComplete="off" /></label>
            <label style={lbl}>Sender<input name="from" defaultValue={d.from} style={inp} /></label>
            <button className="em-s101">Save connection</button>
            {saved && <span className="em-s102">{saved}</span>}
          </form>
          <Note>The key is stored on the server only. Sending through the provider isn't built in yet — this records your connection for when delivery is wired up.</Note>
        </div>
        <div style={{ ...card, borderRadius: 20, flex: '1 1 380px', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <b className="em-s97">Rules we enforce</b>
          {RULES.map(([ic, t, ds]) => <div key={t} className="em-s103"><span style={{ width: 24, height: 24, borderRadius: '50%', background: ic === '✓' ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 85)', color: ic === '✓' ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.1 70)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{ic}</span><div className="em-s38"><b className="em-s22">{t}</b><span className="em-s31">{ds}</span></div></div>)}
        </div>
      </div>
      <div style={{ ...card, borderRadius: 20, overflow: 'hidden' }}>
        <div className="em-s13">
          <div className="em-s38"><b className="em-s14">Domain authentication · {d.domain}</b><span className="em-s48">Add these DNS records at your domain host, then check.</span></div>
          <button onClick={check} disabled={checking} className="em-s104">{checking ? 'Checking…' : 'Check DNS'}</button>
        </div>
        <div className="em-s16">
          <table className="em-s105">
            <tbody>{d.dns.map(r => (
              <tr key={r.k}>
                <td className="em-s106"><b className="em-s22">{r.k}</b><div className="em-s39">{r.type}</div></td>
                <td className="mono em-s107">{r.host}</td>
                <td className="mono em-s108">{r.val}</td>
                <td className="em-s109"><span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: r.ok ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 85)', color: r.ok ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.1 70)', whiteSpace: 'nowrap' }}>{r.ok ? 'Verified' : 'Not found'}</span></td>
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

  if (!ready) return <div className="em-s110"><span className="spin" /></div>;
  if (!staff) return <Login onDone={setStaff} />;
  if (!can(staff, 'marketing.manage')) return <div className="em-s111"><div className="a-msg err">Your role cannot open the Email Center.</div></div>;
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
          <div className="em-s38">
            <h6>Email</h6>
            {TABS.map(([k, l]) => <NavLink key={k} to={'/email/' + k} className={({ isActive }) => (isActive ? 'on' : '')}><span className="ic">{ICON[k]}</span><span className="tx">{l}</span></NavLink>)}
          </div>
          <div className="em-s38">
            <h6>Go to</h6>
            <Link to="/admin/marketing"><span className="ic">←</span><span className="tx">Admin console</span></Link>
          </div>
        </nav>
        <div className="em-status"><i className={setup?.hasKey && dnsOk ? 'ok' : 'warn'} />{status}</div>
        <div className="adm-user"><span className="av">{staff.name[0]}</span><div className="em-s112"><b>{staff.name}</b><small>{staff.role}</small></div><button onClick={logout} title="Sign out">⏻</button></div>
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
