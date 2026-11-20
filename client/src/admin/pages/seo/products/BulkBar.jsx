import { ACTIONS } from './useBulk.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

/** Buttons that act on the selected products, plus the always-visible recalculate-all and the last result. */
export function BulkBar({ count, bulk, onAction, onAll }) {
  const tr = useT();
  return (
    <div className="adpt-bulk">
      {count > 0 && (
        <div className="adpt-bar">
          <b>{tr('{n} selected', { n: count })}</b>
          {ACTIONS.map(([k, l]) => <button key={k} type="button" className="a-btn ghost sm" disabled={bulk.busy} onClick={() => onAction(k, l)}>{tr(l)}</button>)}
        </div>
      )}
      <div className="adpt-bar">
        <button type="button" className="a-btn sm" disabled={bulk.busy} onClick={onAll}>{tr('Recalculate ALL scores')}</button>
        {bulk.busy && <span className="spin" />}
        {bulk.result && <span className="adpt-res" role="status">{bulk.result}</span>}
      </div>
    </div>
  );
}
