import { useEffect, useState } from 'react';
import { Switch } from '../../ui.jsx';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { send, mcMsg, trMsg } from './bzApi.js';
import { Msg, CopyBtn } from './parts.jsx';
import { useT } from '../../i18n/lang.jsx';

/** Section D: weekly summary e-mail. */
export default function BzDigest() {
  const tr = useT();
  const q = useApiData(() => adm.get('/growth/digest'), []);
  const [on, setOn] = useState(false);
  const [to, setTo] = useState('');
  const [m, setM] = useState(null);
  const [pv, setPv] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { if (q.data) { setOn(!!q.data.enabled); setTo(q.data.to || ''); } }, [q.data]);
  const d = q.data;
  const act = async (name, fn) => { setBusy(name); setM(null); await fn(); setBusy(''); };
  const save = () => act('save', async () => setM(mcMsg(await send('/growth/digest', { enabled: on, to: to.trim() }), 'Saved.')));
  const preview = () => act('pv', async () => { const r = await send('/growth/digest/preview', {}); if (r.ok) setPv(r.body); else setM(mcMsg(r)); });
  const test = () => act('test', async () => setM(mcMsg(await send('/growth/digest/test', to.trim() ? { to: to.trim() } : {}), 'Test e-mail sent. Check your inbox in a minute.')));
  return (
    <section className="a-card adbz-card" id="adbz-digest">
      <h3>{tr('Weekly summary e-mail')}</h3>
      <p className="adbz-hint">{tr('Once a week we e-mail you a short summary of how your shop is doing on Google.')}</p>
      {q.error && <Msg m={{ ok: false, text: tr(q.error) }} />}
      {d && (<>
        <div className="adbz-row"><Switch on={on} onChange={setOn} title={tr('Weekly e-mail on or off')} /><b>{on ? tr('Weekly e-mail is on') : tr('Weekly e-mail is off')}</b></div>
        <label className="adbz-field">{tr('Send it to')}
          <input className="a-in" type="email" value={to} placeholder={d.shopEmail || 'name@example.com'} onChange={e => setTo(e.target.value)} />
          <small>{d.shopEmail ? tr('Leave empty to use the shop e-mail ({email}).', { email: d.shopEmail }) : tr('Leave empty to use the shop e-mail.')}</small>
        </label>
        {!d.mailReady && <Msg m={{ ok: false, text: tr('No e-mail is set up on this server yet: use Preview and copy the text instead.') + (d.hint ? ' ' + tr(d.hint) : '') }} />}
        <div className="adbz-row">
          <button type="button" className="a-btn a-btn-primary" disabled={!!busy} onClick={save}>{busy === 'save' ? tr('Saving...') : tr('Save')}</button>
          <button type="button" className="a-btn" disabled={!!busy} onClick={preview}>{busy === 'pv' ? tr('Loading...') : tr('Preview')}</button>
          <button type="button" className="a-btn" disabled={!!busy || !d.mailReady} title={d.mailReady ? '' : d.hint ? tr(d.hint) : tr('E-mail is not set up')} onClick={test}>{busy === 'test' ? tr('Sending...') : tr('Send test e-mail')}</button>
        </div>
        <Msg m={trMsg(tr, m)} />
        {pv && (<>
          <b>{tr('Subject: {subject}', { subject: pv.subject })}</b>
          <pre className="adbz-pre">{pv.text}</pre>
          <div className="adbz-row"><CopyBtn text={pv.text || ''} /><span className="adbz-hint">{tr('Copy the preview text')}</span></div>
          <iframe className="adbz-frame" title={tr('E-mail preview')} sandbox="" srcDoc={pv.html || ''} />
        </>)}
      </>)}
    </section>
  );
}
