import { useState } from 'react';
import { putJson } from '../pages/seo/seoModel.js';
import { confirmBox } from '../ui.jsx';

/** The page's URL slug. Editable for products, blogs and pages; changing it makes the old address 301-redirect. */
export function SlugEditor({ type, id, slug, onDone }) {
  const [val, setVal] = useState(slug?.value || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!slug) return null;
  if (!slug.editable) return <div className="adsi-sec"><span className="adsi-lbl">URL slug</span><code className="adsi-code">{slug.value}</code></div>;
  const same = val.trim() === slug.value;
  const change = async () => {
    if (busy || same) return;
    const ok = await confirmBox(`Change the URL to "${val.trim()}"? The old address will keep working and 301-redirect to the new one.`);
    if (!ok) return;
    setBusy(true); setMsg(null);
    const r = await putJson(`/seo/${type}/${id}/slug`, { slug: val.trim() });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.errors[0] }); return; }
    setMsg({ ok: true, text: 'URL changed. The old address now redirects.' });
    onDone?.(r.data);
  };
  return (
    <div className="adsi-sec">
      <label className="a-lbl">URL slug
        <span className="adsi-row"><input className="a-input adsi-grow" value={val} maxLength={120} onChange={e => { setVal(e.target.value); setMsg(null); }} />
          <button type="button" className="a-btn" disabled={busy || same || !val.trim()} onClick={change}>{busy ? 'Changing…' : 'Change URL'}</button></span></label>
      {msg && <div className={'a-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</div>}
    </div>
  );
}
