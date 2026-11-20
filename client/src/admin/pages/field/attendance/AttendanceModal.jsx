import { Modal } from '../../../ui.jsx';
import { Facts } from '../../../fieldKit.jsx';
import { Av, Chip, hhmm, hours, osm } from '../shared.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/field.js';

/** Chip tone per attendance status. */
export const ATT = { Present: 'ok', 'On duty': 'blue', 'On leave': 'violet', Absent: 'bad', 'Weekly off': 'off', '—': 'off' };

/** Popup with one person's day: totals, call shortcuts and the clock-in / clock-out log with locations. */
export function AttendanceModal({ sel, date, onClose }) {
  const tr = useT();
  return (
    <Modal kicker={tr('Attendance')} title={sel.name} narrow cls="att-modal" onClose={onClose} footer={<button type="button" className="a-btn" onClick={onClose}>{tr('Close')}</button>}>
      <div className="att-hd"><Av name={sel.name} /><div><b>{sel.name}</b><small>{tr(sel.roleLabel)} · {date}</small></div><Chip tone={ATT[sel.status] || 'off'}>{tr(sel.status)}</Chip></div>
      <Facts cols="att-facts" items={[[tr('Clock in'), hhmm(sel.firstIn)], [tr('Clock out'), hhmm(sel.lastOut)], [tr('Hours'), hours(sel.minutes)], [tr('Days this month'), sel.monthDays]]} />
      {sel.phone && <div className="att-call"><a className="a-mini" href={'tel:' + sel.phone}>{tr('Call {phone}', { phone: sel.phone })}</a><a className="a-mini" href={'sms:' + sel.phone}>{tr('Message')}</a></div>}
      <h4 className="att-h4">{tr('Clock-in and clock-out on {date}', { date })}</h4>
      {sel.punches.length ? (
        <ol className="att-log">{sel.punches.map((p, i) => (
          <li key={i} className={p.type === 'Clocked In' ? 'in' : 'out'}><b>{hhmm(p.at)}</b><span>{tr(p.type)}</span>{p.lat != null ? <a href={osm(p.lat, p.lng)} target="_blank" rel="noreferrer">{tr('Location')} ↗</a> : <em>{tr('no location')}</em>}</li>
        ))}</ol>
      ) : <p className="fd-sub">{sel.status === 'On leave' ? tr('On approved leave this day.') : tr('No clock-in or clock-out this day.')}</p>}
    </Modal>
  );
}
