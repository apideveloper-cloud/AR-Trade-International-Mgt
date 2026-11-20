import { useHistory, useRevert } from './useHistory.js';
import { EntryRow } from '../pages/seo/activity/EntryRow.jsx';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/catalog.js';
import './history.css';

/** Collapsible change history of one item (loads when first opened). Props: type, id, onReverted. */
export function HistoryPanel({ type, id, onReverted }) {
  const tr = useT();
  const h = useHistory(type, id);
  const { revert, busyId } = useRevert(() => { h.reload(); onReverted?.(); });
  return (
    <details className="adsi-sec adsi-det adsh" onToggle={e => { if (e.currentTarget.open && !h.loaded && !h.loading) h.reload(); }}>
      <summary><b>{tr('History')}</b>{h.loaded && <small className="adsi-note"> {h.total === 1 ? tr('{n} change', { n: h.total }) : tr('{n} changes', { n: h.total })}</small>}</summary>
      <div className="adsh-bar">
        <button type="button" className="a-btn ghost sm" disabled={h.loading} onClick={h.reload}>{h.loading ? tr('Loading…') : tr('Refresh')}</button>
      </div>
      {h.err && <div className="a-msg err">{tr(h.err)}</div>}
      {h.loaded && !h.rows.length && <div className="adsi-muted">{tr('No changes recorded yet.')}</div>}
      <div className="adsh-list">{h.rows.map(e => <EntryRow key={e.id} e={e} onRevert={revert} busy={busyId === e.id} />)}</div>
      {h.rows.length < h.total && <button type="button" className="a-btn ghost sm adsh-more" disabled={h.loading} onClick={h.more}>{tr('Load more')}</button>}
    </details>
  );
}
