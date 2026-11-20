import { useState } from 'react';
import { adm } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import { fDateTime } from '../../../fieldKit.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { AuBlock, AuPill, AuRow, CopyBtn } from './parts.jsx';

function PreviewModal({ rows, onClose }) {
  return (
    <Modal kicker="Google Merchant feed" title="First 20 items" onClose={onClose} cls="adau-modal" footer={<button type="button" className="a-btn" onClick={onClose}>Close</button>}>
      {rows.length === 0 ? <div className="adau-muted">The feed has no items yet.</div> : (
        <div className="adau-scroll"><table className="adau-tbl"><thead><tr><th>ID</th><th>Title</th><th>Price</th><th>Availability</th><th>GTIN / MPN</th></tr></thead>
          <tbody>{rows.map((r, n) => <tr key={r.id ?? n}><td>{r.id}</td><td>{r.title}</td><td>{r.price}</td><td>{r.availability}</td><td>{[r.gtin, r.mpn].filter(Boolean).join(' / ') || '—'}</td></tr>)}</tbody></table></div>
      )}
    </Modal>
  );
}

export function FeedBlock({ f }) {
  const [busy, run] = useBusy();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const open = () => run(async () => {
    setErr('');
    try { setRows((await adm.get('/seo/feed/preview?limit=20')).rows || []); } catch (e) { setErr(e.message || 'Could not load the preview.'); }
  });
  const skipped = f.skipped || [];
  return (
    <AuBlock title="Google Merchant feed" pill={f.enabled ? <AuPill tone="ok">Enabled</AuPill> : <AuPill tone="off">Off</AuPill>}>
      <AuRow k="Feed URL">{f.url ? <span className="adau-inl"><CopyBtn text={f.url} label="Copy URL" /><a href={f.url} target="_blank" rel="noreferrer">Open</a></span> : 'Not available'}</AuRow>
      <AuRow k="Items included">{f.items ?? 0}</AuRow>
      <AuRow k="Generated">{f.generatedAt ? fDateTime(f.generatedAt) : 'Not yet'}</AuRow>
      {skipped.length > 0 && <ul className="adau-skip">{skipped.map(s => <li key={s.reason}><b>{s.count}</b> skipped: {s.reason}</li>)}</ul>}
      <div className="adau-acts"><button type="button" className="a-btn ghost sm" disabled={busy} onClick={open}>{busy ? 'Loading…' : 'Preview first 20 items'}</button></div>
      {err && <div className="adau-msg adau-msg-err">{err}</div>}
      {rows && <PreviewModal rows={rows} onClose={() => setRows(null)} />}
    </AuBlock>
  );
}

export function AnalyticsBlock({ a }) {
  return (
    <AuBlock title="Analytics">
      <AuRow k="GA4">{a?.ga4 || <span className="adau-muted">not set</span>}</AuRow>
      <AuRow k="GTM">{a?.gtm || <span className="adau-muted">not set</span>}</AuRow>
      <span className="adseo-hint">Change the IDs in Verification and tracking above.</span>
    </AuBlock>
  );
}
