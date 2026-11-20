import { useState } from 'react';
import { Modal, alertBox } from '../../../ui.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { postJson, trServer } from '../seoModel.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

const cut = v => { const s = v == null ? '' : String(v); return s.length > 60 ? s.slice(0, 57) + '…' : s; };

/** Preview of an uploaded CSV (counts, errors, changes) with the Apply button. `pre` is { csv, data } from the preview call. */
export function ImportModal({ pre, onClose, onDone }) {
  const tr = useT();
  const [busy, run] = useBusy();
  const [res, setRes] = useState(null);
  const { counts, rows = [], note } = pre.data;
  const bad = rows.filter(r => r.errors?.length);
  const changes = rows.flatMap(r => (r.changes || []).map(c => ({ ...c, id: r.id, name: r.name })));
  const apply = () => run(async () => {
    const r = await postJson('/seo/import/apply', { csv: pre.csv, token: pre.data.token });
    if (!r.ok) { await alertBox(trServer(tr, r.error)); return; }
    setRes(r.data); onDone();
  });
  const footer = res ? <button type="button" className="a-btn grad" onClick={onClose}>{tr('Close')}</button> : (
    <>
      <button type="button" className="a-btn ghost" onClick={onClose}>{tr('Cancel')}</button>
      <button type="button" className="a-btn grad" disabled={busy || !counts.valid || !changes.length} onClick={apply}>{busy ? tr('Applying…') : tr('Apply {n} changes', { n: counts.changed })}</button>
    </>
  );
  return (
    <Modal kicker={tr('Import CSV')} title={tr('Import preview')} onClose={onClose} onSubmit={e => e.preventDefault()} footer={footer}>
      <div className="adpt-imp">
        <p className="adpt-counts"><b>{counts.total}</b> {tr('rows')} · <b>{counts.valid}</b> {tr('valid')} · <b>{counts.invalid}</b> {tr('invalid')} · <b>{counts.changed}</b> {tr('changed')} · <b>{counts.unchanged}</b> {tr('unchanged')}</p>
        {note && <p className="adpt-hint">{trServer(tr, note)}</p>}
        {counts.invalid > 0 && <p className="adpt-warn">{tr('{n} invalid rows will be skipped.', { n: counts.invalid })}</p>}
        {res && <p className="adpt-ok" role="status">{tr('Applied {a}, failed {f}.', { a: res.applied, f: res.failed })}{(res.errors || []).map(e => <small key={e.line + '-' + e.id}>{tr('Line {line}, {id}: {error}', { line: e.line, id: e.id, error: trServer(tr, e.error) })}</small>)}</p>}
        {bad.length > 0 && (
          <div className="adpt-scroll"><table className="adpt-t"><thead><tr><th>{tr('Line')}</th><th>ID</th><th>{tr('Problem')}</th></tr></thead><tbody>
            {bad.map(r => <tr key={r.line}><td>{r.line}</td><td>{r.id}</td><td>{r.errors.map(x => trServer(tr, x)).join('; ')}</td></tr>)}
          </tbody></table></div>
        )}
        {changes.length > 0 && (
          <div className="adpt-scroll"><table className="adpt-t"><thead><tr><th>ID</th><th>{tr('Name')}</th><th>{tr('Field')}</th><th>{tr('Change')}</th></tr></thead><tbody>
            {changes.map((c, i) => <tr key={i}><td>{c.id}</td><td title={c.name}>{cut(c.name)}</td><td>{c.field}</td><td title={`${c.from ?? ''} → ${c.to ?? ''}`}>{cut(c.from)} → {cut(c.to)}</td></tr>)}
          </tbody></table></div>
        )}
      </div>
    </Modal>
  );
}
