import { Switch } from '../../ui.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';
import './catalogPage.css';

/** The Popular / New toggle chips of a product (read-only people see only the ones that are on). */
export function FlagChips({ p, canWrite, patch }) {
  const tr = useT();
  return (
    <div className="fl-chips">
      {[['popular', 'Popular'], ['isNew', 'New']].filter(([k]) => canWrite || p[k]).map(([k, l]) => <button key={k} type="button" className={'a-chip fl-chip' + (p[k] ? ' is-on' : '')} disabled={!canWrite} onClick={() => patch(p, { [k]: !p[k] })}>{tr(l)}</button>)}
    </div>
  );
}

/** Live / Hidden: a switch for people who may edit, a plain label for everyone else. */
export function LiveSwitch({ p, canWrite, patch }) {
  const tr = useT();
  return canWrite
    ? <Switch on={p.active} onChange={v => patch(p, { active: v })} title={tr('Visible on the store')} />
    : <span className={'ro-live ' + (p.active ? 'on' : '')}>{p.active ? tr('Live') : tr('Hidden')}</span>;
}

/** A number cell: an input that saves on blur when `canWrite`, otherwise the plain value in a `Plain` element (class `plainClass`). `k` is the product field. */
export function NumCell({ p, k, canWrite, patch, Plain = 'span', plainClass = 'ro-val' }) {
  if (!canWrite) return <Plain className={plainClass}>{p[k]}</Plain>;
  return <input className="a-mini" type="number" min="0" defaultValue={p[k]} onBlur={e => { if (+e.target.value !== p[k]) patch(p, { [k]: +e.target.value }); }} />;
}
