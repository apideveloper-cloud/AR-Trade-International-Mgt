import { DAYS } from './bzApi.js';

/** Opening hours editor: 7 days, times and a closed box. */
export default function BzHours({ hours, onChange, disabled }) {
  const set = (i, patch) => onChange(hours.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const copy = () => onChange(hours.map(h => ({ ...hours[0], day: h.day })));
  return (
    <div className="adbz-hours">
      <div className="adbz-row"><b>Opening hours</b>
        <button type="button" className="a-btn" disabled={disabled} onClick={copy}>Copy {DAYS[0]} to all days</button>
      </div>
      {hours.map((h, i) => (
        <div key={h.day} className="adbz-day">
          <b>{h.day}</b>
          <input className="a-in" type="time" aria-label={h.day + ' opens'} disabled={disabled || h.closed} value={h.opens} onChange={e => set(i, { opens: e.target.value })} />
          <input className="a-in" type="time" aria-label={h.day + ' closes'} disabled={disabled || h.closed} value={h.closes} onChange={e => set(i, { closes: e.target.value })} />
          <label><input type="checkbox" disabled={disabled} checked={h.closed} onChange={e => set(i, { closed: e.target.checked })} /> Closed</label>
        </div>
      ))}
    </div>
  );
}
