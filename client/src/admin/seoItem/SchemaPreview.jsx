import { useState } from 'react';
import { adm } from '../adminApi.js';
import { liveUrl } from './useSeoItem.js';

/** Collapsible read-only JSON-LD, loaded on demand, with the Rich Results test link. */
export function SchemaPreview({ base, url }) {
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const abs = liveUrl(url);
  const load = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try { setOut(await adm.get(base + '/schema')); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <details className="adsi-sec adsi-det" onToggle={e => { if (e.currentTarget.open && !out) load(); }}>
      <summary><b>JSON-LD preview</b></summary>
      <div className="adsi-row">
        <button type="button" className="a-btn ghost sm" disabled={busy} onClick={load}>{busy ? 'Loading…' : 'Refresh'}</button>
        <a className="adsi-link" target="_blank" rel="noreferrer" href={'https://search.google.com/test/rich-results?url=' + encodeURIComponent(abs)}>Validate</a>
        <a className="adsi-link" target="_blank" rel="noreferrer" href={abs}>View live page</a>
      </div>
      {err && <div className="a-msg err">{err}</div>}
      {out && <pre className="adsi-pre">{JSON.stringify(out.ld, null, 2)}</pre>}
    </details>
  );
}
