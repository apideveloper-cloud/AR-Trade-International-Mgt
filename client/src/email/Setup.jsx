import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { Note, PanelHead, Pill } from './EmailParts.jsx';
import { act } from './emailShared.js';

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
      <div className="em-setup-layout">
        <div className="em-card em-card-lg em-setup-card">
          <b className="em-setup-title">Email service provider</b>
          <div className="em-providers">
            {d.providers.map(p => <button key={p.n} onClick={() => pick(p.n)} className={'em-provider' + (d.provider === p.n ? ' em-provider--on' : '')}><b className="em-provider-name">{p.n}</b><span className="em-provider-desc">{p.d}</span></button>)}
          </div>
          <form onSubmit={save} className="em-conn-form">
            <label className="em-lbl">API key {d.hasKey && <span className="em-lbl-hint">saved ({d.keyHint}) — enter a new one to replace it</span>}<input name="apiKey" type="password" placeholder="Paste your provider API key" className="em-inp" autoComplete="off" /></label>
            <label className="em-lbl">Sender<input name="from" defaultValue={d.from} className="em-inp" /></label>
            <button className="em-conn-save">Save connection</button>
            {saved && <span className="em-conn-saved">{saved}</span>}
          </form>
          <Note>The key is stored on the server only. Sending through the provider isn't built in yet — this records your connection for when delivery is wired up.</Note>
        </div>
        <div className="em-card em-card-lg em-setup-card em-setup-card--rules">
          <b className="em-setup-title">Rules we enforce</b>
          {RULES.map(([ic, t, ds]) => <div key={t} className="em-rule"><span className={'em-rule-ic em-rule-ic--' + (ic === '✓' ? 'ok' : 'warn')}>{ic}</span><div className="em-col-2"><b className="em-title-sm">{t}</b><span className="em-sub">{ds}</span></div></div>)}
        </div>
      </div>
      <div className="em-card em-card-lg em-card-clip">
        <PanelHead center>
          <div className="em-col-2"><b className="em-panel-title">Domain authentication · {d.domain}</b><span className="em-hint">Add these DNS records at your domain host, then check.</span></div>
          <button onClick={check} disabled={checking} className="em-pill-btn em-pill-btn--grad">{checking ? 'Checking…' : 'Check DNS'}</button>
        </PanelHead>
        <div className="em-scroll-x">
          <table className="em-table em-table--setup">
            <tbody>{d.dns.map(r => (
              <tr key={r.k}>
                <td className="em-dns-cell"><b className="em-title-sm">{r.k}</b><div className="em-dns-cell-sub">{r.type}</div></td>
                <td className="mono em-dns-host">{r.host}</td>
                <td className="mono em-dns-val">{r.val}</td>
                <td className="em-dns-status"><Pill ok={r.ok} className="em-nowrap">{r.ok ? 'Verified' : 'Not found'}</Pill></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
