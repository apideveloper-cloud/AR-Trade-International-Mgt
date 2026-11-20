import { DAYS } from './bzApi.js';
import { useT } from '../../i18n/lang.jsx';

/** Opening hours editor: 7 days, times and a closed box. */
export default function BzHours({ hours, onChange, disabled }) {
  const tr = useT();
  const set = (i, patch) => onChange(hours.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const copy = () => onChange(hours.map(h => ({ ...hours[0], day: h.day })));
  return (
    <div className="adbz-hours">
      <div className="adbz-row"><b>{tr('Opening hours')}</b>
        <button type="button" className="a-btn" disabled={disabled} onClick={copy}>{tr('Copy {day} to all days', { day: tr(DAYS[0]) })}</button>
      </div>
      {hours.map((h, i) => (
        <div key={h.day} className="adbz-day">
          <b>{tr(h.day)}</b>
          <input className="a-in" type="time" aria-label={tr('{day} opens', { day: tr(h.day) })} disabled={disabled || h.closed} value={h.opens} onChange={e => set(i, { opens: e.target.value })} />
          <input className="a-in" type="time" aria-label={tr('{day} closes', { day: tr(h.day) })} disabled={disabled || h.closed} value={h.closes} onChange={e => set(i, { closes: e.target.value })} />
          <label><input type="checkbox" disabled={disabled} checked={h.closed} onChange={e => set(i, { closed: e.target.checked })} /> {tr('Closed')}</label>
        </div>
      ))}
    </div>
  );
}
