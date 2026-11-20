import { useState } from 'react';
import { confirmBox } from '../../../ui.jsx';
import { fDateTime } from '../../../fieldKit.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { postJson, trServer } from '../seoModel.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';
import { AuBlock, AuMsg, AuPill, AuRow } from './parts.jsx';

function reason(i, tr = s => s) {
  if (!i.enabled) return tr('The IndexNow switch is off (turn it on above and Save).');
  if (!i.keySet) return tr('No key yet. Press Generate key.');
  if (!i.host) return tr('No Preferred domain set in General.');
  return '';
}

export function IndexNowBlock({ i, reload }) {
  const tr = useT();
  const [genBusy, runGen] = useBusy();
  const [testBusy, runTest] = useBusy();
  const [allBusy, runAll] = useBusy();
  const [all, setAll] = useState(null);
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState(null);
  const st = i.state || {};
  const why = reason(i, tr);
  const gen = async () => {
    const replace = i.keySet;
    if (replace && !(await confirmBox(tr('Replace the IndexNow key? The old key file stops working at once, and the new key is used from now on.'), { danger: true, confirmLabel: tr('Replace key') }))) return;
    runGen(async () => {
      setMsg(null);
      const r = await postJson('/seo/automation/indexnow/generate-key', replace ? { replace: true } : {});
      if (r.ok) { setMsg({ ok: true, text: tr('New key created.') }); reload(); } else setMsg({ ok: false, text: trServer(tr, r.error) });
    });
  };
  const ping = () => runTest(async () => {
    setTest(null);
    const r = await postJson('/seo/automation/indexnow/test', {});
    if (!r.ok) setTest({ ok: false, text: trServer(tr, r.error) });
    else setTest({ ok: !!r.data.ok, text: r.data.ok ? tr('Ping accepted (HTTP {s}).', { s: r.data.status }) : tr('Ping failed') + (r.data.status ? ' (HTTP ' + r.data.status + ')' : '') + (r.data.error ? ': ' + r.data.error : '.') });
    reload();
  });
  const submitAll = async () => {
    if (!(await confirmBox(tr('Send every page address of the site (products, categories, brands, blog, pages) to IndexNow now? Bing and the other IndexNow search engines will then crawl them. It can be done once every 10 minutes.'), { confirmLabel: tr('Send all pages') }))) return;
    runAll(async () => {
      setAll(null);
      const r = await postJson('/seo/automation/indexnow/submit-all', {});
      if (!r.ok) setAll({ ok: false, text: trServer(tr, r.error) });
      else setAll({ ok: !!r.data.ok, text: r.data.ok ? tr('{n} page addresses accepted (HTTP {s}).', { n: r.data.submitted, s: r.data.status }) : tr('{a} of {b} failed', { a: r.data.failed, b: r.data.total }) + (r.data.status ? ' (HTTP ' + r.data.status + ')' : '') + (r.data.error ? ': ' + r.data.error : '.') });
      reload();
    });
  };
  return (
    <AuBlock title="IndexNow" pill={i.ready ? <AuPill tone="ok">{tr('Ready')}</AuPill> : <AuPill tone="warn">{tr('Not ready')}</AuPill>}>
      {!i.ready && <div className="adau-why">{why}</div>}
      <AuRow k={tr('Key file')}>{i.keyLocation ? <a href={i.keyLocation} target="_blank" rel="noreferrer">{i.keyLocation}</a> : tr('No key')}</AuRow>
      <AuRow k={tr('Last ping')}>{st.lastPing ? fDateTime(st.lastPing) + ' · ' + (st.ok ? 'OK' : tr('failed')) + (st.status ? ' (HTTP ' + st.status + ')' : '') : tr('Never')}</AuRow>
      <AuRow k={tr('URLs sent')}>{st.count ?? 0}</AuRow>
      <AuRow k={tr('In queue')}>{st.queued ?? 0}</AuRow>
      {st.error && <div className="adau-msg adau-msg-err">{tr('Last error: {e}', { e: st.error })}</div>}
      <div className="adau-acts">
        <button type="button" className="a-btn sm" disabled={genBusy} onClick={gen}>{genBusy ? tr('Working…') : tr('Generate key')}</button>
        <button type="button" className="a-btn ghost sm" disabled={testBusy} onClick={ping}>{testBusy ? tr('Sending…') : tr('Send test ping')}</button>
        <button type="button" className="a-btn sm" disabled={allBusy || !i.ready} title={i.ready ? tr('Send every page address to IndexNow') : why} onClick={submitAll}>{allBusy ? tr('Sending…') : tr('Submit all pages')}</button>
      </div>
      <AuMsg m={msg} /><AuMsg m={test} /><AuMsg m={all} />
    </AuBlock>
  );
}
