import { ACTIONS } from './useBulk.jsx';

/** Buttons that act on the selected products, plus the always-visible recalculate-all and the last result. */
export function BulkBar({ count, bulk, onAction, onAll }) {
  return (
    <div className="adpt-bulk">
      {count > 0 && (
        <div className="adpt-bar">
          <b>{count} selected</b>
          {ACTIONS.map(([k, l]) => <button key={k} type="button" className="a-btn ghost sm" disabled={bulk.busy} onClick={() => onAction(k, l)}>{l}</button>)}
        </div>
      )}
      <div className="adpt-bar">
        <button type="button" className="a-btn sm" disabled={bulk.busy} onClick={onAll}>Recalculate ALL scores</button>
        {bulk.busy && <span className="spin" />}
        {bulk.result && <span className="adpt-res" role="status">{bulk.result}</span>}
      </div>
    </div>
  );
}
