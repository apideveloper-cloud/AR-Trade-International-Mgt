import { fmtTime } from '../../api.js';
import { FLOW_COLOR } from './flow.js';

/** Newest-first list of status changes. */
export default function Timeline({ history }) {
  return (
    <div className="lt-box lt-lines">
      <b className="lt-title lt-gap">Timeline</b>
      {[...history].reverse().map((h, i) => (
        <div key={i} className="lt-event">
          <span className="lt-event-dot" style={{ background: FLOW_COLOR[h.s] || '#7a869f' }} />
          <span><b>{h.s}</b>{h.note && <span className="lt-note"> — {h.note}</span>}</span>
          <span className="lt-event-at">{fmtTime(h.at)}</span>
        </div>
      ))}
    </div>
  );
}
