import { useState } from 'react';
import { api, fmtTime } from '../api.js';
import { FLOW } from './livetrack/flow.js';
import StatusCard from './livetrack/StatusCard.jsx';
import Timeline from './livetrack/Timeline.jsx';
import { OrderCard, OtpCard, ReturnForm, ReturnStatus, RiderCard } from './livetrack/SidePanels.jsx';
import './livetrack/livetrack.css';

export { FLOW, FLOW_COLOR } from './livetrack/flow.js';

/** Headline text for the current order state. */
function headlineOf(d) {
  if (d.flow === 'Delivered') return 'Delivered';
  if (d.flow === 'Cancelled') return 'Order cancelled';
  if (d.flow === 'Returned') return 'Returned & refunded';
  if (d.live) return 'On the way to you';
  if (d.courier && d.flow === 'Out for delivery') return 'With ' + d.courier.id;
  return 'Preparing your order';
}

/** Customer-facing live tracking (also embedded in the Delivery Hub). `d` is the /api/live payload. */
export default function LiveTrack({ d, phone, onChanged }) {
  const [reason, setReason] = useState(d.returnReasons?.[0] || '');
  const [msg, setMsg] = useState('');
  const atOf = t => { const h = [...d.history].reverse().find(x => x.s === t); return h ? fmtTime(h.at) : ''; };
  const canReturn = d.flow === 'Delivered' && !d.ret;
  const eligible = reason !== 'Changed my mind';
  const why = eligible ? 'Eligible — full refund or replacement after inspection.' : 'Opened toner, ink and consumables are non-returnable unless damaged, wrong, defective or expired.';

  const ask = async () => {
    setMsg('');
    try { await api.post('/live/return', { id: d.id, phone, reason }); onChanged?.(); } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="lt">
      <div className="lt-col">
        <StatusCard d={d} headline={headlineOf(d)} idx={FLOW.indexOf(d.flow)} atOf={atOf} />
        <Timeline history={d.history} />
      </div>
      <div className="lt-col">
        {d.rider && (d.flow === 'Out for delivery' || d.flow === 'Packed') && <RiderCard rider={d.rider} />}
        {d.otp && <OtpCard otp={d.otp} />}
        <OrderCard d={d} />
        {canReturn && phone && <ReturnForm reasons={d.returnReasons} reason={reason} setReason={setReason} eligible={eligible} why={why} msg={msg} onAsk={ask} />}
        {d.ret && <ReturnStatus ret={d.ret} />}
      </div>
    </div>
  );
}
