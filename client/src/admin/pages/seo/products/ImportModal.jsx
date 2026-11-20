import { useState } from 'react';
import { Modal, alertBox } from '../../../ui.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { postJson } from '../seoModel.js';

const cut = v => { const s = v == null ? '' : String(v); return s.length > 60 ? s.slice(0, 57) + '…' : s; };

/** Preview of an uploaded CSV (counts, errors, changes) with the Apply button. `pre` is { csv, data } from the preview call. */
export function ImportModal({ pre, onClose, onDone }) {
  const [busy, run] = useBusy();
  const [res, setRes] = useState(null);
  const { counts, rows = [], note } = pre.data;
  const bad = rows.filter(r => r.errors?.length);
  const changes = rows.flatMap(r => (r.changes || []).map(c => ({ ...c, id: r.id, name: r.name })));
  const apply = () => run(async () => {
    const r = await postJson('/seo/import/apply', { csv: pre.csv, token: pre.data.token });
    if (!r.ok) { await alertBox(r.error); return; }
    setRes(r.data); onDone();
  });
  const footer = res ? <button type="button" className="a-btn grad" onClick={onClose}>Close</button> : (
    <>
      <button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="a-btn grad" disabled={busy || !counts.valid || !changes.length} onClick={apply}>{busy ? 'Applying…' : `Apply ${counts.changed} changes`}</button>
    </>
  );
  return (
    <Modal kicker="Import CSV" title="Import preview" onClose={onClose} onSubmit={e => e.preventDefault()} footer={footer}>
      <div className="adpt-imp">
        <p className="adpt-counts"><b>{counts.total}</b> rows · <b>{counts.valid}</b> valid · <b>{counts.invalid}</b> invalid · <b>{counts.changed}</b> changed · <b>{counts.unchanged}</b> unchanged</p>
        {note && <p className="adpt-hint">{note}</p>}
        {counts.invalid > 0 && <p className="adpt-warn">{counts.invalid} invalid rows will be skipped.</p>}
        {res && <p className="adpt-ok" role="status">Applied {res.applied}, failed {res.failed}.{(res.errors || []).map(e => <small key={e.line + '-' + e.id}>Line {e.line}, {e.id}: {e.error}</small>)}</p>}
        {bad.length > 0 && (
          <div className="adpt-scroll"><table className="adpt-t"><thead><tr><th>Line</th><th>ID</th><th>Problem</th></tr></thead><tbody>
            {bad.map(r => <tr key={r.line}><td>{r.line}</td><td>{r.id}</td><td>{r.errors.join('; ')}</td></tr>)}
          </tbody></table></div>
        )}
        {changes.length > 0 && (
          <div className="adpt-scroll"><table className="adpt-t"><thead><tr><th>ID</th><th>Name</th><th>Field</th><th>Change</th></tr></thead><tbody>
            {changes.map((c, i) => <tr key={i}><td>{c.id}</td><td title={c.name}>{cut(c.name)}</td><td>{c.field}</td><td title={`${c.from ?? ''} → ${c.to ?? ''}`}>{cut(c.from)} → {cut(c.to)}</td></tr>)}
          </tbody></table></div>
        )}
      </div>
    </Modal>
  );
}
