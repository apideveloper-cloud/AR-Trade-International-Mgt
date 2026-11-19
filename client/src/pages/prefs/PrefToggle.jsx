/** One email-preference row with an on/off switch. */
export default function PrefToggle({ title, desc, on, onToggle }) {
  return (
    <button onClick={onToggle} className={'prf-row' + (on ? ' prf-on' : '')}>
      <div className="prf-row-txt"><b className="prf-row-t">{title}</b><span className="prf-row-d">{desc}</span></div>
      <span className="prf-sw"><span className="prf-knob" /></span>
    </button>
  );
}
