/** List | Grid switch for the cart items. The choice is remembered by the parent. */
export default function ViewSwitch({ view, onChange }) {
  const btn = (v, label, icon) => (
    <button type="button" className={view === v ? 'on' : ''} aria-pressed={view === v} aria-label={label + ' view'} title={label + ' view'} onClick={() => onChange(v)}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg><span className="vl">{label}</span>
    </button>
  );
  return (
    <div className="vsw" role="group" aria-label="Cart view">
      {btn('list', 'List', <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />)}
      {btn('grid', 'Grid', <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />)}
    </div>
  );
}
