import { useState } from 'react';
import { Modal } from '../../../ui.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { TargetPicker } from './TargetPicker.jsx';
import { SaveResult } from './AddRedirectModal.jsx';
import { sendJson } from './redirectModel.js';

/** Shown after something was deleted: offers to send visitors of the old address somewhere. onClose() runs on Skip, or after the result is read. */
export function DeleteRedirectModal({ source, what, onClose }) {
  const [target, setTarget] = useState('/shop/all');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [busy, run] = useBusy();
  const submit = e => {
    e.preventDefault();
    if (done) { onClose(); return; }
    run(async () => {
      setErr('');
      const r = await sendJson('POST', '/seo/redirects', { source, target: target.trim(), code: 301 });
      if (!r.ok) { setErr(r.error); return; }
      const d = r.data || {};
      if (!(d.warnings || []).length && !(d.flattened || []).length) onClose(); else setDone(d);
    });
  };
  return (
    <Modal narrow cls="adrd-modal" kicker={what || 'Deleted'} title="Send visitors somewhere?" onClose={onClose} onSubmit={submit}
      footer={done ? <button type="submit" className="a-btn grad">Done</button> : <><button type="button" className="a-btn ghost" onClick={onClose}>Skip</button><button className="a-btn grad" disabled={busy || !target.trim()}>{busy ? 'Saving…' : 'Create redirect'}</button></>}>
      {err && <div className="a-msg err">{err}</div>}
      {done && <><div className="a-msg ok">Redirect created.</div><SaveResult warnings={done.warnings} flattened={done.flattened} /></>}
      {!done && (<div className="adrd-form">
        <p className="adrd-p">The old address <code>{source}</code> no longer exists. Visitors and Google who still use it will see a 404 page. Send them to a page that still exists instead.</p>
        <label className="adrd-f">Old address<input className="a-input" value={source} readOnly /></label>
        <div className="adrd-f">Send visitors to<TargetPicker value={target} onChange={setTarget} /></div>
      </div>)}
    </Modal>
  );
}
