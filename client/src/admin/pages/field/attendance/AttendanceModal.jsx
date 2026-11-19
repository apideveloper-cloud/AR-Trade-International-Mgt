import { Modal } from '../../../ui.jsx';
import { Facts } from '../../../fieldKit.jsx';
import { Av, Chip, hhmm, hours, osm } from '../shared.jsx';

/** Chip tone per attendance status. */
export const ATT = { Present: 'ok', 'On duty': 'blue', 'On leave': 'violet', Absent: 'bad', 'Weekly off': 'off', '—': 'off' };

/** Popup with one person's day: totals, call shortcuts and the clock-in / clock-out log with locations. */
export function AttendanceModal({ sel, date, onClose }) {
  return (
    <Modal kicker="Attendance" title={sel.name} narrow cls="att-modal" onClose={onClose} footer={<button type="button" className="a-btn" onClick={onClose}>Close</button>}>
      <div className="att-hd"><Av name={sel.name} /><div><b>{sel.name}</b><small>{sel.roleLabel} · {date}</small></div><Chip tone={ATT[sel.status] || 'off'}>{sel.status}</Chip></div>
      <Facts cols="att-facts" items={[['Clock in', hhmm(sel.firstIn)], ['Clock out', hhmm(sel.lastOut)], ['Hours', hours(sel.minutes)], ['Days this month', sel.monthDays]]} />
      {sel.phone && <div className="att-call"><a className="a-mini" href={'tel:' + sel.phone}>Call {sel.phone}</a><a className="a-mini" href={'sms:' + sel.phone}>Message</a></div>}
      <h4 className="att-h4">Clock-in and clock-out on {date}</h4>
      {sel.punches.length ? (
        <ol className="att-log">{sel.punches.map((p, i) => (
          <li key={i} className={p.type === 'Clocked In' ? 'in' : 'out'}><b>{hhmm(p.at)}</b><span>{p.type}</span>{p.lat != null ? <a href={osm(p.lat, p.lng)} target="_blank" rel="noreferrer">Location ↗</a> : <em>no location</em>}</li>
        ))}</ol>
      ) : <p className="fd-sub">{sel.status === 'On leave' ? 'On approved leave this day.' : 'No clock-in or clock-out this day.'}</p>}
    </Modal>
  );
}
