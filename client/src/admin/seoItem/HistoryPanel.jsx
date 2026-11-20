import { useHistory, useRevert } from './useHistory.js';
import { EntryRow } from '../pages/seo/activity/EntryRow.jsx';
import './history.css';

/** Collapsible change history of one item (loads when first opened). Props: type, id, onReverted. */
export function HistoryPanel({ type, id, onReverted }) {
  const h = useHistory(type, id);
  const { revert, busyId } = useRevert(() => { h.reload(); onReverted?.(); });
  return (
    <details className="adsi-sec adsi-det adsh" onToggle={e => { if (e.currentTarget.open && !h.loaded && !h.loading) h.reload(); }}>
      <summary><b>History</b>{h.loaded && <small className="adsi-note"> {h.total} change{h.total === 1 ? '' : 's'}</small>}</summary>
      <div className="adsh-bar">
        <button type="button" className="a-btn ghost sm" disabled={h.loading} onClick={h.reload}>{h.loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {h.err && <div className="a-msg err">{h.err}</div>}
      {h.loaded && !h.rows.length && <div className="adsi-muted">No changes recorded yet.</div>}
      <div className="adsh-list">{h.rows.map(e => <EntryRow key={e.id} e={e} onRevert={revert} busy={busyId === e.id} />)}</div>
      {h.rows.length < h.total && <button type="button" className="a-btn ghost sm adsh-more" disabled={h.loading} onClick={h.more}>Load more</button>}
    </details>
  );
}
