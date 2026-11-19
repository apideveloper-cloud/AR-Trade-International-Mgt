import { fmt, fmtTime } from '../../api.js';
import { FLOW, FLOW_COLOR } from './flow.js';

/** Six-step progress stepper with the time each step was reached. */
function Stepper({ idx, atOf }) {
  return (
    <div className="lt-steps">
      {FLOW.map((t, i) => (
        <div key={t} className={'lt-step' + (idx >= i && idx >= 0 ? ' on' : '')} style={{ '--c': FLOW_COLOR[t] }}>
          <span className="lt-bar" />
          <span className="lt-dot">{i + 1}</span>
          <span className="lt-name">{t}</span>
          <span className="lt-at">{atOf(t)}</span>
        </div>
      ))}
    </div>
  );
}

/** Rider position strip with ETA while the order is on its way. */
function LiveStrip({ d }) {
  return (
    <div className="lt-live">
      <div className="lt-live-row"><span>⌂ {d.branchName}</span><b>ETA {d.live.etaMin} min</b><span>⌖ Your address</span></div>
      <div className="lt-track" style={{ '--pct': d.live.pct + '%' }}>
        <div className="lt-rail" />
        <div className="lt-done" />
        <div className="lt-rider">➤</div>
        <div className="lt-goal" />
      </div>
      <span className="lt-live-note">{d.rider.name} picked up your parcel {d.live.sinceMin} min ago · location updates every few seconds</span>
    </div>
  );
}

/** Text shown for the proof-of-delivery method. */
function podText(pod) {
  const how = pod.method === 'otp' ? 'OTP verified' : pod.method === 'courier' ? 'confirmed by ' + pod.name : 'signed by ' + (pod.name || 'receiver');
  return `✓ Delivered ${fmtTime(pod.at)} · ${how}${pod.cash ? ' · cash ' + fmt(pod.cash) + ' collected' : ''}`;
}

/** Main status card: headline, stepper, live strip, courier and proof of delivery. */
export default function StatusCard({ d, headline, idx, atOf }) {
  return (
    <div className="lt-box lt-main">
      <div className="lt-head">
        <div className="lt-head-t"><span className="mono lt-id">{d.id}</span><span className="lt-headline">{headline}</span></div>
        <span className="lt-pill" style={{ background: FLOW_COLOR[d.flow] || '#7a869f' }}>{d.flow}</span>
      </div>
      <Stepper idx={idx} atOf={atOf} />
      {d.live && <LiveStrip d={d} />}
      {d.courier && (
        <div className="lt-courier">
          <div className="lt-courier-l">
            <span className="lt-courier-id" style={{ background: d.courier.color }}>{d.courier.id}</span>
            <div className="lt-courier-tn"><span className="lt-muted12">Tracking no.</span><b className="mono">{d.courier.tn}</b></div>
          </div>
          <span className="lt-courier-eta">Delivery in {d.courier.eta}</span>
        </div>
      )}
      {d.pod && <div className="lt-pod">{podText(d.pod)}</div>}
    </div>
  );
}
