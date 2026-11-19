import { Modal } from '../../../ui.jsx';
import { Facts } from '../../../fieldKit.jsx';
import { Av, Chip, ago, dayTime, hhmm, osm, STATE } from '../shared.jsx';

/** Details popup of one team member; "Show on map" picks them on the map and closes the popup. */
export function MemberModal({ who, onShow, onClose }) {
  return (
    <Modal kicker="Team member" title={who.name} narrow cls="att-modal" onClose={onClose}
      footer={<>{who.lat != null && <button type="button" className="a-btn ghost" onClick={() => onShow(who.id)}>Show on map</button>}<button type="button" className="a-btn" onClick={onClose}>Close</button></>}>
      <div className="att-hd"><Av name={who.name} /><div><b>{who.name}{who.me && ' (you)'}</b><small>{who.roleLabel}</small></div><Chip tone={STATE[who.status] || 'off'}>{who.status}</Chip></div>
      <Facts items={[['Mobile', who.phone || '—'], ['Email', who.email || '—'], ['Clock-in today', who.clockIn ? hhmm(who.clockIn) : 'Not clocked in'], ['Distance today', who.km + ' km'], ['Visits done / planned', who.visits ? who.visits.done + ' / ' + who.visits.total : '—'], ['Last signal', who.online ? ago(who.ageSec) : who.seenAt ? 'Last seen ' + dayTime(who.seenAt) : 'None yet'], ['Position', who.place || (who.lat != null ? 'Position known' : 'No position yet'), true]]} />
      <div className="att-call">
        {who.phone && <a className="a-mini" href={'tel:' + who.phone}>Call</a>}{who.phone && <a className="a-mini" href={'sms:' + who.phone}>Message</a>}
        {who.email && <a className="a-mini" href={'mailto:' + who.email}>Email</a>}{who.lat != null && <a className="a-mini" href={osm(who.lat, who.lng)} target="_blank" rel="noreferrer">Open map ↗</a>}
      </div>
    </Modal>
  );
}
