import { useState } from 'react';
import { confirmBox } from '../../ui.jsx';
import { useBusy } from '../../hooks/useBusy.js';
import { Msg, Note, Section } from './parts.jsx';
import { NO_CONNECT_NOTE, run } from './growthModel.js';

const siteName = x => (typeof x === 'string' ? x : x?.siteUrl || x?.url || JSON.stringify(x));

export default function GoogleCard({ s, reload, canConn, banner }) {
  const g = s.google || {};
  const [clientId, setClientId] = useState(g.clientId || '');
  const [secret, setSecret] = useState('');
  const [busy, doit] = useBusy();
  const [m, setM] = useState(banner || null);
  const [sites, setSites] = useState(null);
  const connected = g.status === 'connected';
  const act = fn => doit(async () => { setM(null); await fn(); });
  const save = () => act(async () => {
    const r = await run('POST', '/growth/google/credentials', { clientId: clientId.trim(), clientSecret: secret });
    setM(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error });
    if (r.ok) { setSecret(''); reload(); }
  });
  const connect = () => act(async () => {
    const r = await run('GET', '/growth/google/connect');
    if (r.ok && r.data?.url) { window.location.href = r.data.url; return; }
    setM({ ok: false, text: r.error || 'Could not start the Google sign-in. Save the client ID and secret first.' });
  });
  const test = () => act(async () => {
    const r = await run('POST', '/growth/google/test');
    setSites(r.ok && r.data.ok ? r.data.sites || [] : null);
    setM(!r.ok ? { ok: false, text: r.error } : r.data.ok ? { ok: true, text: 'Google answered. ' + (r.data.sites?.length || 0) + ' site(s) found.' } : { ok: false, text: r.data.error || 'Google did not accept the connection.' });
    reload();
  });
  const verify = () => act(async () => {
    const r = await run('POST', '/growth/google/verify');
    setM(!r.ok ? { ok: false, text: r.error } : r.data.ok ? { ok: true, text: 'Google verified the site.' + (r.data.fileUrl ? ' File: ' + r.data.fileUrl : '') } : { ok: false, text: r.data.error || 'Google could not verify the site.' });
    reload();
  });
  const off = async () => {
    if (!(await confirmBox('Disconnect Google? The site stays listed in Google, but this console stops sending it anything.', { danger: true, confirmLabel: 'Disconnect' }))) return;
    act(async () => { const r = await run('POST', '/growth/google/disconnect'); setM(r.ok ? { ok: true, text: 'Google disconnected.' } : { ok: false, text: r.error }); reload(); });
  };
  return (
    <Section id="adgr-google" title="Google Search Console" what="Lets this console tell Google about your sitemap and check that Google can see the site."
      steps={['Save the client ID and secret from Google Cloud (see the help above).', 'Press Connect Google and allow access.', 'Press Test connection to check it works.']}>
      <Msg m={m} />
      {!canConn && <Note>{NO_CONNECT_NOTE}</Note>}
      <div className="a-fields">
        <label className="a-lbl">Client ID<input className="a-in" value={clientId} disabled={!canConn} onChange={e => setClientId(e.target.value)} autoComplete="off" /></label>
        <label className="a-lbl">Client secret<input className="a-in" type="password" value={secret} disabled={!canConn} onChange={e => setSecret(e.target.value)} autoComplete="new-password" placeholder={g.clientSecret?.set ? 'saved (ends …' + (g.clientSecret.last4 || '') + ')' : 'Paste the secret'} /></label>
      </div>
      <div className="adgr-acts">
        {canConn && <button type="button" className="a-btn sm" disabled={busy || !clientId.trim() || (!secret && !g.clientSecret?.set)} onClick={save}>{busy ? 'Working…' : 'Save'}</button>}
        {canConn && <button type="button" className="a-btn sm" disabled={busy || !g.clientIdSet} onClick={connect}>{connected ? 'Reconnect Google' : 'Connect Google'}</button>}
        <button type="button" className="a-btn ghost sm" disabled={busy || !g.refreshToken?.set} onClick={test}>Test connection</button>
        <button type="button" className="a-btn ghost sm" disabled={busy || !connected} onClick={verify}>Verify site by HTML file</button>
        {canConn && <button type="button" className="a-btn ghost sm" disabled={busy || !g.refreshToken?.set} onClick={off}>Disconnect</button>}
        {busy && <span className="spin" />}
      </div>
      {sites && <ul className="adgr-sites">{sites.length ? sites.map((x, i) => <li key={i}>{siteName(x)}</li>) : <li>No sites in this Google account yet.</li>}</ul>}
    </Section>
  );
}
