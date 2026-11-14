import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { Note } from './EmailParts.jsx';
import { act, card, inp, lbl } from './emailShared.js';

const RULES = [['✓', 'Double opt-in only', 'Nobody is added until they click the confirmation link.'], ['✓', 'One-click unsubscribe', 'Every email carries unsubscribe and preference links; it takes effect immediately.'], ['✓', 'Preferences respected', 'Campaigns only reach people who allow that type of email.'], ['✓', 'Consent is logged', 'Date, time, source and IP are kept for every signup.'], ['✓', 'No sharing or selling', 'The list is never shared or sold.'], ['!', 'Authenticate your domain', 'SPF, DKIM and DMARC keep your emails out of spam.']];

export default function Setup() {
  const [d, setD] = useState(null);
  const [saved, setSaved] = useState('');
  const [checking, setChecking] = useState(false);
  const load = () => api.get('/setup').then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return <span className="spin" />;
  const pick = n => act(() => api.put('/setup', { provider: n }), load);
  const save = async e => {
    e.preventDefault();
    const form = e.currentTarget, f = Object.fromEntries(new FormData(form).entries());
    try { await api.put('/setup', f); setSaved('✓ Saved'); form.apiKey.value = ''; load(); } catch (er) { setSaved(er.message); }
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
