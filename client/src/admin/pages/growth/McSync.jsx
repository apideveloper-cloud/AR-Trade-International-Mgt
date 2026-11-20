import { useEffect, useState } from 'react';
import { confirmBox, Switch } from '../../ui.jsx';
import { Msg, Section } from './parts.jsx';
import { send, mcMsg } from './mcApi.js';
import { when } from './growthModel.js';

const STEPS = [
  'Create a Merchant Center account for your shop and verify the website.',
  'In Merchant Center create an API data source (Data sources > Add > API) and note its number.',
  'Reconnect Google in Search & Growth > Search engines (it now also asks for Merchant Center access).',
  'Enter your Merchant Center account number and the data source number below.',
];

/** E. Google sync through the Merchant API. */
export default function McSync({ data, canConnect, onChanged, go }) {
  const api = data?.api || {}, st = data?.settings || {};
  const [acc, setAcc] = useState('');
  const [ds, setDs] = useState('');
  const [auto, setAuto] = useState(false);
  const [email, setEmail] = useState('');
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { setAcc(st.accountId || api.accountId || ''); setDs(st.dataSourceId || api.dataSourceId || ''); setAuto(!!(st.syncEnabled ?? api.syncEnabled)); }, [st.accountId, st.dataSourceId, st.syncEnabled, api.accountId, api.dataSourceId, api.syncEnabled]);
  const ready = /^\d+$/.test(acc) && /^\d+$/.test(ds);
  const run = async (key, url, body, ok, after) => {
    setBusy(key);
    const r = await send(url, body);
    setBusy('');
    let msg = mcMsg(r, ok);
    if (r.ok && key === 'test' && r.body && r.body.ok === false) msg = { ok: false, text: r.body.error || 'The test did not work.' };
    else if (r.ok && key === 'test') msg = { ok: true, text: 'Connected' + (r.body?.account ? ' to ' + r.body.account : '') + '.' };
    setM(msg);
    if (r.ok) { onChanged(); after?.(); }
  };
  const saveIds = (patch, ok) => run('save', '/growth/merchant/settings', { ...st, accountId: acc, dataSourceId: ds, syncEnabled: auto, ...patch }, ok);
  const full = async () => { if (await confirmBox('Send every product to Google again? This can take a while.', { confirmLabel: 'Yes, sync everything' })) run('full', '/growth/merchant/sync', { full: true }, 'Sync started. Press Refresh Google status in a minute.'); };
  const dis = !canConnect;
  return (
    <Section id="admc-sync" title="Send products to Google automatically" what="Instead of waiting for Google to read the feed, this console can send product changes to Google Merchant Center itself.">
      <ol className="adgr-steps">{STEPS.map((t, i) => <li key={i}>{t}</li>)}</ol>
      {api.merchantScopeOk === false && (
        <div className="admc-warn">Google needs to be reconnected to allow Merchant Center. <button type="button" className="a-btn sm" onClick={() => go('growth')}>Open Search engines</button></div>
      )}
      {dis && <p className="adseo-hint">Only the Master Admin or Admin can change this.</p>}
      <div className="admc-row">
        <label className="admc-f">Merchant Center account number<input className="a-in" inputMode="numeric" disabled={dis} value={acc} onChange={e => setAcc(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="admc-f">Data source number<input className="a-in" inputMode="numeric" disabled={dis} value={ds} onChange={e => setDs(e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <div className="admc-row">
        <Switch on={auto && ready} onChange={v => ready && !dis && setAuto(v)} title="Turn on automatic sync" />
        <span>Turn on automatic sync {!ready && <span className="adgr-dim">(enter both numbers first)</span>}</span>
      </div>
      {!dis && <div className="admc-row">
        <button type="button" className="a-btn" disabled={!!busy} onClick={() => saveIds({}, 'Saved.')}>{busy === 'save' ? 'Saving...' : 'Save'}</button>
        <button type="button" className="a-btn ghost" disabled={!!busy || !ready} onClick={() => run('test', '/growth/merchant/api/test', {})}>{busy === 'test' ? 'Testing...' : 'Test connection'}</button>
      </div>}
      {!dis && <div className="admc-row">
        <label className="admc-f">Your e-mail for Google (one-time registration)<input className="a-in" type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <button type="button" className="a-btn ghost" disabled={!!busy || !email.includes('@')} onClick={() => run('reg', '/growth/merchant/api/register', { developerEmail: email.trim() }, 'This app is registered with Google.')}>Register this app with Google</button>
      </div>}
      {!dis && <p className="adseo-hint">Registering is a one-time step that Google requires before an app can send products. Google may contact this e-mail.</p>}
      <div className="admc-row">
        <button type="button" className="a-btn" disabled={!!busy || !ready} onClick={() => run('sync', '/growth/merchant/sync', { full: false }, 'Sync started.')}>{busy === 'sync' ? 'Syncing...' : 'Sync now'}</button>
        <button type="button" className="a-btn ghost" disabled={!!busy || !ready} onClick={full}>Sync everything again</button>
        <button type="button" className="a-btn ghost" disabled={!!busy} onClick={() => run('refresh', '/growth/merchant/api/status-refresh', {}, 'Google status refreshed.')}>Refresh Google status</button>
      </div>
      <p className="adseo-hint">Last sync: {api.lastSync ? when(api.lastSync) : 'never'}. Waiting: {api.counts?.pending ?? 0}. Synced: {api.counts?.synced ?? 0}. With errors: {api.counts?.errors ?? 0}.</p>
      {api.lastError && <div className="admc-warn">Last problem: {String(api.lastError)}</div>}
      <Msg m={m} />
    </Section>
  );
}
