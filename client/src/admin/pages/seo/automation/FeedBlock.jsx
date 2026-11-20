import { useState } from 'react';
import { adm } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import { fDateTime } from '../../../fieldKit.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { AuBlock, AuPill, AuRow, CopyBtn } from './parts.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

function PreviewModal({ rows, onClose }) {
  const tr = useT();
  return (
    <Modal kicker={tr('Google Merchant feed')} title={tr('First 20 items')} onClose={onClose} cls="adau-modal" footer={<button type="button" className="a-btn" onClick={onClose}>{tr('Close')}</button>}>
      {rows.length === 0 ? <div className="adau-muted">{tr('The feed has no items yet.')}</div> : (
        <div className="adau-scroll"><table className="adau-tbl"><thead><tr><th>ID</th><th>{tr('Title')}</th><th>{tr('Price')}</th><th>{tr('Availability')}</th><th>GTIN / MPN</th></tr></thead>
          <tbody>{rows.map((r, n) => <tr key={r.id ?? n}><td>{r.id}</td><td>{r.title}</td><td>{r.price}</td><td>{r.availability}</td><td>{[r.gtin, r.mpn].filter(Boolean).join(' / ') || '—'}</td></tr>)}</tbody></table></div>
      )}
    </Modal>
  );
}

export function FeedBlock({ f }) {
  const tr = useT();
  const [busy, run] = useBusy();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const open = () => run(async () => {
    setErr('');
    try { setRows((await adm.get('/seo/feed/preview?limit=20')).rows || []); } catch (e) { setErr(e.message ? tr(e.message) : tr('Could not load the preview.')); }
  });
  const skipped = f.skipped || [];
  return (
    <AuBlock title={tr('Google Merchant feed')} pill={f.enabled ? <AuPill tone="ok">{tr('Enabled')}</AuPill> : <AuPill tone="off">{tr('Off')}</AuPill>}>
      <AuRow k={tr('Feed URL')}>{f.url ? <span className="adau-inl"><CopyBtn text={f.url} label="Copy URL" /><a href={f.url} target="_blank" rel="noreferrer">{tr('Open')}</a></span> : tr('Not available')}</AuRow>
      <AuRow k={tr('Items included')}>{f.items ?? 0}</AuRow>
      <AuRow k={tr('Generated')}>{f.generatedAt ? fDateTime(f.generatedAt) : tr('Not yet')}</AuRow>
      {skipped.length > 0 && <ul className="adau-skip">{skipped.map(s => <li key={s.reason}><b>{s.count}</b> {tr('skipped: {reason}', { reason: tr(s.reason) })}</li>)}</ul>}
      <div className="adau-acts"><button type="button" className="a-btn ghost sm" disabled={busy} onClick={open}>{busy ? tr('Loading…') : tr('Preview first 20 items')}</button></div>
      {err && <div className="adau-msg adau-msg-err">{err}</div>}
      {rows && <PreviewModal rows={rows} onClose={() => setRows(null)} />}
    </AuBlock>
  );
}

export function AnalyticsBlock({ a }) {
  const tr = useT();
  return (
    <AuBlock title={tr('Analytics')}>
      <AuRow k="GA4">{a?.ga4 || <span className="adau-muted">{tr('not set')}</span>}</AuRow>
      <AuRow k="GTM">{a?.gtm || <span className="adau-muted">{tr('not set')}</span>}</AuRow>
      <span className="adseo-hint">{tr('Change the IDs in Verification and tracking above.')}</span>
    </AuBlock>
  );
}
