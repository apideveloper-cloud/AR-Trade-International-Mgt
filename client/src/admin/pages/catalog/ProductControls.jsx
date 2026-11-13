import { Switch } from '../../ui.jsx';

/** The Popular / New toggle chips of a product (read-only people see only the ones that are on). */
export function FlagChips({ p, canWrite, patch }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {[['popular', 'Popular'], ['isNew', 'New']].filter(([k]) => canWrite || p[k]).map(([k, l]) => <button key={k} type="button" className="a-chip" disabled={!canWrite} style={{ padding: '3px 8px', fontSize: 11, background: p[k] ? 'oklch(0.95 0.04 150)' : '#fff', cursor: canWrite ? 'pointer' : 'default' }} onClick={() => patch(p, { [k]: !p[k] })}>{l}</button>)}
    </div>
  );
}

/** Live / Hidden: a switch for people who may edit, a plain label for everyone else. */
export function LiveSwitch({ p, canWrite, patch }) {
  return canWrite
    ? <Switch on={p.active} onChange={v => patch(p, { active: v })} title="Visible on the store" />
    : <span className={'ro-live ' + (p.active ? 'on' : '')}>{p.active ? 'Live' : 'Hidden'}</span>;
}
