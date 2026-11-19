import { Av, Chip, Ic, ICON_CALL, ICON_INFO, ICON_MSG, ICON_PIN, ago, hhmm, osm, STATE, DOT } from '../shared.jsx';

/** One team member in the side list: status, today's figures and call / message / map shortcuts. */
export function MemberRow({ m, selected, onSelect, onInfo }) {
  return (
    <div className={'fd-m' + (selected ? ' sel' : '') + (m.online ? '' : ' idle')} style={{ '--c': DOT[STATE[m.status] || 'off'] }}>
      <button type="button" className="fd-mhead" onClick={onSelect}>
        <Av name={m.name} />
        <span className="fd-mt"><b>{m.name}{m.me && <em> you</em>}</b><small>{m.roleLabel}</small></span>
        <Chip tone={STATE[m.status] || 'off'}>{m.status}</Chip>
      </button>
      <div className="fd-mrow">
        <span className="fd-mmeta" onClick={onInfo} title="Click for the details">
          <span title="Distance today">🛣 {m.km} km</span>
          {m.visits && <span title="Visits done / planned">📍 {m.visits.done}/{m.visits.total}</span>}
          <span title="Clock-in time">⏱ {m.clockIn ? hhmm(m.clockIn) : '—'}</span>
          {m.online && <span title="Last signal">● {ago(m.ageSec)}</span>}
        </span>
        <span className="fd-macts">
          <button type="button" className="fd-ib info" onClick={onInfo} title={'Details of ' + m.name} aria-label={'Details of ' + m.name}><Ic d={ICON_INFO} /></button>
          {m.phone && <a className="fd-ib call" href={'tel:' + m.phone} title={'Call ' + m.name + ' (' + m.phone + ')'} aria-label={'Call ' + m.name}><Ic d={ICON_CALL} /></a>}
          {m.phone && <a className="fd-ib msg" href={'sms:' + m.phone} title={'Send ' + m.name + ' a text message'} aria-label={'Message ' + m.name}><Ic d={ICON_MSG} /></a>}
          {m.lat != null && <a className="fd-ib pin" href={osm(m.lat, m.lng)} target="_blank" rel="noreferrer" title="Open this position on OpenStreetMap" aria-label={'Open ' + m.name + ' on the map'}><Ic d={ICON_PIN} /></a>}
        </span>
      </div>
      {m.place && <div className="fd-place">{m.place}</div>}
    </div>
  );
}
