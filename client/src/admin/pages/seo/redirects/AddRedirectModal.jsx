import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../ui.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { TargetPicker } from './TargetPicker.jsx';
import { REDIRECT_CODES, sendJson } from './redirectModel.js';

/** Result lines shown after a save: warnings and the redirects that were shortened (flattened). */
export function SaveResult({ warnings = [], flattened = [] }) {
  return (<>
    {warnings.map((w, i) => <div key={i} className="adrd-warn">{w}</div>)}
    {flattened.length > 0 && (
      <div className="adrd-note"><b>{flattened.length} older redirect{flattened.length === 1 ? ' was' : 's were'} shortened to skip the middle step:</b>
        {flattened.map(f => <small key={f.id}>{f.source}: {f.from} → {f.to}</small>)}</div>
    )}
  </>);
}

const clean = d => !(d.warnings || []).length && !(d.flattened || []).length;

/** Add (or, with `edit`, change) a redirect. `source` prefills the old address; `focusTarget` puts the cursor in the target box. onSaved() runs after a successful save. */
export function AddRedirectModal({ edit, source = '', target = '', focusTarget, onClose, onSaved }) {
  const [f, setF] = useState({ source: edit?.source || source, target: edit?.target || target, code: edit?.code || 301 });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [busy, run] = useBusy();
  const tgt = useRef(null), src = useRef(null);
  useEffect(() => { (focusTarget || edit ? tgt : src).current?.focus(); }, [focusTarget, edit]);
  const explain = (REDIRECT_CODES.find(c => c[0] === +f.code) || [])[2];
  const submit = e => {
    e.preventDefault();
    if (done) { onClose(); return; }
    run(async () => {
      setErr('');
      const body = { target: f.target.trim(), code: +f.code };
      const r = edit ? await sendJson('PUT', '/seo/redirects/' + edit.id, body) : await sendJson('POST', '/seo/redirects', { source: f.source.trim(), ...body });
      if (!r.ok) { setErr(r.error); return; }
      onSaved?.();
      if (clean(r.data || {})) onClose(); else setDone(r.data);
    });
  };
  return (
    <Modal narrow cls="adrd-modal" kicker="Redirect" title={edit ? 'Edit redirect' : 'Add redirect'} onClose={onClose} onSubmit={submit}
      footer={done ? <button type="submit" className="a-btn grad">Done</button> : <><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy || !f.source.trim() || !f.target.trim()}>{busy ? 'Saving…' : 'Save redirect'}</button></>}>
      {err && <div className="a-msg err">{err}</div>}
      {done && <><div className="a-msg ok">Saved.</div><SaveResult warnings={done.warnings} flattened={done.flattened} /></>}
      {!done && (<div className="adrd-form">
        <label className="adrd-f">Old address (source)
          <input ref={src} className="a-input" value={f.source} readOnly={!!edit} placeholder="/old-address" maxLength={500} onChange={e => setF(v => ({ ...v, source: e.target.value }))} />
          <small>{edit ? 'The source cannot be changed. Delete this redirect and add a new one to use another address.' : 'The address on this site that visitors should be moved away from, like /old-address'}</small>
        </label>
        <div className="adrd-f">Send visitors to (target)
          <TargetPicker ref={tgt} value={f.target} onChange={t => setF(v => ({ ...v, target: t }))} />
          <small>Start typing a product, category or page name, or paste a path.</small>
        </div>
        <label className="adrd-f">Type
          <select className="a-input" value={f.code} onChange={e => setF(v => ({ ...v, code: +e.target.value }))}>{REDIRECT_CODES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
          <small>{explain}</small>
        </label>
      </div>)}
    </Modal>
  );
}
