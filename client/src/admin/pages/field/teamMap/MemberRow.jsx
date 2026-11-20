import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/field.js';
import { Av, Chip, Ic, ICON_CALL, ICON_INFO, ICON_MSG, ICON_PIN, ago, hhmm, osm, STATE, DOT } from '../shared.jsx';

/** One team member in the side list: status, today's figures and call / message / map shortcuts. */
export function MemberRow({ m, selected, onSelect, onInfo }) {
  const tr = useT();
  return (
    <div className={'fd-m' + (selected ? ' sel' : '') + (m.online ? '' : ' idle')} style={{ '--c': DOT[STATE[m.status] || 'off'] }}>
      <button type="button" className="fd-mhead" onClick={onSelect}>
        <Av name={m.name} />
        <span className="fd-mt"><b>{m.name}{m.me && <em> {tr('you')}</em>}</b><small>{tr(m.roleLabel)}</small></span>
        <Chip tone={STATE[m.status] || 'off'}>{tr(m.status)}</Chip>
      </button>
      <div className="fd-mrow">
        <span className="fd-mmeta" onClick={onInfo} title={tr('Click for the details')}>
          <span title={tr('Distance today')}>🛣 {m.km} km</span>
          {m.visits && <span title={tr('Visits done / planned')}>📍 {m.visits.done}/{m.visits.total}</span>}
          <span title={tr('Clock-in time')}>⏱ {m.clockIn ? hhmm(m.clockIn) : '—'}</span>
          {m.online && <span title={tr('Last signal')}>● {ago(m.ageSec, tr)}</span>}
        </span>
        <span className="fd-macts">
          <button type="button" className="fd-ib info" onClick={onInfo} title={tr('Details of {name}', { name: m.name })} aria-label={tr('Details of {name}', { name: m.name })}><Ic d={ICON_INFO} /></button>
          {m.phone && <a className="fd-ib call" href={'tel:' + m.phone} title={tr('Call {name} ({phone})', { name: m.name, phone: m.phone })} aria-label={tr('Call {name}', { name: m.name })}><Ic d={ICON_CALL} /></a>}
          {m.phone && <a className="fd-ib msg" href={'sms:' + m.phone} title={tr('Send {name} a text message', { name: m.name })} aria-label={tr('Message {name}', { name: m.name })}><Ic d={ICON_MSG} /></a>}
          {m.lat != null && <a className="fd-ib pin" href={osm(m.lat, m.lng)} target="_blank" rel="noreferrer" title={tr('Open this position on OpenStreetMap')} aria-label={tr('Open {name} on the map', { name: m.name })}><Ic d={ICON_PIN} /></a>}
        </span>
      </div>
      {m.place && <div className="fd-place">{m.place}</div>}
    </div>
  );
}
