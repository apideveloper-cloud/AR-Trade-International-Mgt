import { STATUS_COLORS } from '../../adminApi.js';
import { STATUSES } from './constants.js';

/** Progress tracker. Steps are buttons only when the role may change the status; Cancel is hidden for riders and read-only roles. */
export function OrderProgress({ o, riderOnly, canEdit, onPick }) {
  const cancelled = o.status === 'Cancelled';
  return (
    <div className="od-track">
      <div className="od-track-h"><small>Order progress</small>{cancelled && <em>Cancelled</em>}</div>
      <div className="od-steps">
        {STATUSES.filter(s => s !== 'Cancelled' && (!riderOnly || ['Shipped', 'Delivered'].includes(s))).map((s, i, a) => {
          const cur = STATUSES.indexOf(o.status), n = STATUSES.indexOf(s);
          const state = cancelled ? 'off' : n < cur ? 'done' : n === cur ? 'now' : 'next';
          const inner = (
            <>
              <span className="od-dot">{state === 'done' ? '✓' : i + 1}</span><span className="od-lab">{s}</span>
              {i < a.length - 1 && <span className="od-line" />}
            </>
          );
          const style = { '--c': STATUS_COLORS[s][1] };
          const current = state === 'now' ? 'step' : undefined;
          return canEdit
            ? <button key={s} type="button" className={'od-step ' + state} onClick={() => onPick(s)} style={style} title={'Set status to ' + s} aria-current={current}>{inner}</button>
            : <div key={s} className={'od-step ro ' + state} style={style} aria-current={current}>{inner}</div>;
        })}
      </div>
      {canEdit && !riderOnly && <button type="button" className={'od-cancel' + (cancelled ? ' on' : '')} onClick={() => onPick('Cancelled')}>✕ Cancel this order</button>}
    </div>
  );
}
