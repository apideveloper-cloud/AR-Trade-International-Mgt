import { Modal } from '../../../ui.jsx';
import { Facts } from '../../../fieldKit.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/field.js';
import { Av, Chip, ago, dayTime, hhmm, osm, STATE } from '../shared.jsx';

/** Details popup of one team member; "Show on map" picks them on the map and closes the popup. */
export function MemberModal({ who, onShow, onClose }) {
  const tr = useT();
  return (
    <Modal kicker={tr('Team member')} title={who.name} narrow cls="att-modal" onClose={onClose}
      footer={<>{who.lat != null && <button type="button" className="a-btn ghost" onClick={() => onShow(who.id)}>{tr('Show on map')}</button>}<button type="button" className="a-btn" onClick={onClose}>{tr('Close')}</button></>}>
      <div className="att-hd"><Av name={who.name} /><div><b>{who.name}{who.me && ' (' + tr('you') + ')'}</b><small>{tr(who.roleLabel)}</small></div><Chip tone={STATE[who.status] || 'off'}>{tr(who.status)}</Chip></div>
      <Facts items={[[tr('Mobile'), who.phone || '—'], [tr('Email'), who.email || '—'], [tr('Clock-in today'), who.clockIn ? hhmm(who.clockIn) : tr('Not clocked in')], [tr('Distance today'), who.km + ' km'], [tr('Visits done / planned'), who.visits ? who.visits.done + ' / ' + who.visits.total : '—'], [tr('Last signal'), who.online ? ago(who.ageSec, tr) : who.seenAt ? tr('Last seen {time}', { time: dayTime(who.seenAt) }) : tr('None yet')], [tr('Position'), who.place || (who.lat != null ? tr('Position known') : tr('No position yet')), true]]} />
      <div className="att-call">
        {who.phone && <a className="a-mini" href={'tel:' + who.phone}>{tr('Call')}</a>}{who.phone && <a className="a-mini" href={'sms:' + who.phone}>{tr('Message')}</a>}
        {who.email && <a className="a-mini" href={'mailto:' + who.email}>{tr('Email')}</a>}{who.lat != null && <a className="a-mini" href={osm(who.lat, who.lng)} target="_blank" rel="noreferrer">{tr('Open map')} ↗</a>}
      </div>
    </Modal>
  );
}
