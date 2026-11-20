import { useState } from 'react';
import { putJson } from '../pages/seo/seoModel.js';
import { confirmBox } from '../ui.jsx';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/catalog.js';

/** The page's URL slug. Editable for products, blogs and pages; changing it makes the old address 301-redirect. */
export function SlugEditor({ type, id, slug, onDone }) {
  const tr = useT();
  const [val, setVal] = useState(slug?.value || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!slug) return null;
  if (!slug.editable) return <div className="adsi-sec"><span className="adsi-lbl">{tr('URL slug')}</span><code className="adsi-code">{slug.value}</code></div>;
  const same = val.trim() === slug.value;
  const change = async () => {
    if (busy || same) return;
    const ok = await confirmBox(tr('Change the URL to "{slug}"? The old address will keep working and 301-redirect to the new one.', { slug: val.trim() }));
    if (!ok) return;
    setBusy(true); setMsg(null);
    const r = await putJson(`/seo/${type}/${id}/slug`, { slug: val.trim() });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: tr(r.errors[0]) }); return; }
    setMsg({ ok: true, text: tr('URL changed. The old address now redirects.') });
    onDone?.(r.data);
  };
  return (
    <div className="adsi-sec">
      <label className="a-lbl">{tr('URL slug')}
        <span className="adsi-row"><input className="a-input adsi-grow" value={val} maxLength={120} onChange={e => { setVal(e.target.value); setMsg(null); }} />
          <button type="button" className="a-btn" disabled={busy || same || !val.trim()} onClick={change}>{busy ? tr('Changing…') : tr('Change URL')}</button></span></label>
      {msg && <div className={'a-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</div>}
    </div>
  );
}
