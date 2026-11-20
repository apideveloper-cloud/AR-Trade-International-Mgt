import { useState } from 'react';
import { confirmBox } from '../../../ui.jsx';
import { fDateTime } from '../../../fieldKit.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { postJson } from '../seoModel.js';
import { AuBlock, AuMsg, AuPill, AuRow } from './parts.jsx';

function reason(i) {
  if (!i.enabled) return 'The IndexNow switch is off (turn it on above and Save).';
  if (!i.keySet) return 'No key yet. Press Generate key.';
  if (!i.host) return 'No Preferred domain set in General.';
  return '';
}

export function IndexNowBlock({ i, reload }) {
  const [genBusy, runGen] = useBusy();
  const [testBusy, runTest] = useBusy();
  const [msg, setMsg] = useState(null);
  const [test, setTest] = useState(null);
  const st = i.state || {};
  const why = reason(i);
  const gen = async () => {
    const replace = i.keySet;
    if (replace && !(await confirmBox('Replace the IndexNow key? The old key file stops working at once, and the new key is used from now on.', { danger: true, confirmLabel: 'Replace key' }))) return;
    runGen(async () => {
      setMsg(null);
      const r = await postJson('/seo/automation/indexnow/generate-key', replace ? { replace: true } : {});
      if (r.ok) { setMsg({ ok: true, text: 'New key created.' }); reload(); } else setMsg({ ok: false, text: r.error });
    });
  };
  const ping = () => runTest(async () => {
    setTest(null);
    const r = await postJson('/seo/automation/indexnow/test', {});
    if (!r.ok) setTest({ ok: false, text: r.error });
    else setTest({ ok: !!r.data.ok, text: r.data.ok ? 'Ping accepted (HTTP ' + r.data.status + ').' : 'Ping failed' + (r.data.status ? ' (HTTP ' + r.data.status + ')' : '') + (r.data.error ? ': ' + r.data.error : '.') });
    reload();
  });
  return (
    <AuBlock title="IndexNow" pill={i.ready ? <AuPill tone="ok">Ready</AuPill> : <AuPill tone="warn">Not ready</AuPill>}>
      {!i.ready && <div className="adau-why">{why}</div>}
      <AuRow k="Key file">{i.keyLocation ? <a href={i.keyLocation} target="_blank" rel="noreferrer">{i.keyLocation}</a> : 'No key'}</AuRow>
      <AuRow k="Last ping">{st.lastPing ? fDateTime(st.lastPing) + ' · ' + (st.ok ? 'OK' : 'failed') + (st.status ? ' (HTTP ' + st.status + ')' : '') : 'Never'}</AuRow>
      <AuRow k="URLs sent">{st.count ?? 0}</AuRow>
      <AuRow k="In queue">{st.queued ?? 0}</AuRow>
      {st.error && <div className="adau-msg adau-msg-err">Last error: {st.error}</div>}
      <div className="adau-acts">
        <button type="button" className="a-btn sm" disabled={genBusy} onClick={gen}>{genBusy ? 'Working…' : 'Generate key'}</button>
        <button type="button" className="a-btn ghost sm" disabled={testBusy} onClick={ping}>{testBusy ? 'Sending…' : 'Send test ping'}</button>
      </div>
      <AuMsg m={msg} /><AuMsg m={test} />
    </AuBlock>
  );
}
