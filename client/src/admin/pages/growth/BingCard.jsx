import { useState } from 'react';
import { confirmBox } from '../../ui.jsx';
import { useBusy } from '../../hooks/useBusy.js';
import { Msg, Note, Section } from './parts.jsx';
import { NO_CONNECT_NOTE, run } from './growthModel.js';

const siteName = x => (typeof x === 'string' ? x : x?.Url || x?.url || x?.siteUrl || JSON.stringify(x));

export default function BingCard({ s, reload, canConn }) {
  const b = s.bing || {};
  const [key, setKey] = useState('');
  const [busy, doit] = useBusy();
  const [m, setM] = useState(null);
  const [sites, setSites] = useState(null);
  const act = fn => doit(async () => { setM(null); await fn(); });
  const save = () => act(async () => {
    const r = await run('POST', '/growth/bing/key', { apiKey: key.trim() });
    setM(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error });
    if (r.ok) { setKey(''); reload(); }
  });
  const test = () => act(async () => {
    const r = await run('POST', '/growth/bing/test');
    setSites(r.ok && r.data.ok ? r.data.sites || [] : null);
    setM(!r.ok ? { ok: false, text: r.error } : r.data.ok ? { ok: true, text: 'Bing answered. ' + (r.data.sites?.length || 0) + ' site(s) found.' } : { ok: false, text: r.data.error || 'Bing did not accept the key.' });
    reload();
  });
  const off = async () => {
    if (!(await confirmBox('Remove the Bing API key? This console stops sending anything to Bing.', { danger: true, confirmLabel: 'Disconnect' }))) return;
    act(async () => { const r = await run('POST', '/growth/bing/disconnect'); setM(r.ok ? { ok: true, text: 'Bing disconnected.' } : { ok: false, text: r.error }); reload(); });
  };
  return (
    <Section id="adgr-bing" title="Bing Webmaster" what="Lets this console send your sitemap to Bing and read back how Bing sees the site."
      steps={['Generate an API key in Bing Webmaster Tools (see the help above).', 'Paste it here and press Save.', 'Press Test to check it works.']}>
      <Msg m={m} />
      {!canConn && <Note>{NO_CONNECT_NOTE}</Note>}
      <label className="a-lbl">API key<input className="a-in" type="password" value={key} disabled={!canConn} onChange={e => setKey(e.target.value)} autoComplete="new-password" placeholder={b.apiKey?.set ? 'saved (ends …' + (b.apiKey.last4 || '') + ')' : 'Paste the key'} /></label>
      <div className="adgr-acts">
        {canConn && <button type="button" className="a-btn sm" disabled={busy || !key.trim()} onClick={save}>{busy ? 'Working…' : 'Save'}</button>}
        <button type="button" className="a-btn ghost sm" disabled={busy || !b.apiKey?.set} onClick={test}>Test</button>
        {canConn && <button type="button" className="a-btn ghost sm" disabled={busy || !b.apiKey?.set} onClick={off}>Disconnect</button>}
        {busy && <span className="spin" />}
      </div>
      {sites && <ul className="adgr-sites">{sites.length ? sites.map((x, i) => <li key={i}>{siteName(x)}</li>) : <li>No sites in this Bing account yet.</li>}</ul>}
    </Section>
  );
}
