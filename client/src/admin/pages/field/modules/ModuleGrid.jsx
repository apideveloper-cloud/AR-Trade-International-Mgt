import { Switch } from '../../../ui.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/field.js';


export const ROLES = [['manager', 'Manager'], ['accountant', 'Accountant'], ['purchase', 'Purchase'], ['rm', 'RM'], ['field', 'Field Officer']];
const ROLE_H = { manager: 160, accountant: 300, purchase: 45, rm: 20, field: 195 };
const MOD_GROUPS = [
  ['Attendance and tracking', 230, ['attendance', 'tracking', 'team', 'leave']],
  ['Sales and customers', 160, ['customers', 'visits', 'sales', 'delivery', 'collection']],
  ['Money and approvals', 75, ['expenses', 'approvals', 'purchase', 'reports']],
  ['Communication', 300, ['notifications', 'contacts']]
];
const MOD_ICON = { attendance: '⏱', tracking: '📍', team: '🗺', leave: '🌴', notifications: '🔔', expenses: '🧾', approvals: '✅', customers: '👥', visits: '📅', sales: '🛒', delivery: '🚚', collection: '💵', purchase: '📦', reports: '📊', contacts: '📞' };

/** The module-by-role switch grid. `onSave(module, patch)` saves a change; `onToggleRole(module, role)` flips one tick. */
export function ModuleGrid({ modules, onSave, onToggleRole }) {
  const tr = useT();
  return (
  <div className="fm" role="table" aria-label={tr('Which role sees which module')}>
    <div className="fm-head" role="row"><span>{tr('Module')}</span><span>{tr('On')}</span>{ROLES.map(([k, l]) => <span key={k} style={{ '--h': ROLE_H[k] }}>{tr(l)}</span>)}<span className="fm-end">{tr('Quick set')}</span></div>
    {MOD_GROUPS.map(([gname, hue, keys]) => {
      const rows = modules.filter(m => keys.includes(m.key));
      if (!rows.length) return null;
      return (
        <div key={gname} className="fm-grp" style={{ '--g': hue }}>
          <div className="fm-gh"><b>{tr(gname)}</b><small>{tr('{n} of {m} on', { n: rows.filter(m => m.enabled).length, m: rows.length })}</small></div>
          {rows.map(m => (
            <div key={m.key} className={'fm-row' + (m.enabled ? '' : ' off')} role="row">
              <span className="fm-name"><i>{MOD_ICON[m.key] || '•'}</i><span><b>{tr(m.label)}</b><small>{m.bn}</small></span></span>
              <span><Switch on={m.enabled} onChange={on => onSave(m, { enabled: on })} title={m.enabled ? tr('Turn off for everyone') : tr('Turn on')} /></span>
              {ROLES.map(([k, l]) => (
                <span key={k} className="fm-c" style={{ '--h': ROLE_H[k] }}>
                  <button type="button" disabled={!m.enabled} className={'fm-cb' + (m.roles.includes(k) ? ' on' : '')} aria-pressed={m.roles.includes(k)} aria-label={tr('{role} can use {module}', { role: tr(l), module: tr(m.label) })} title={tr(m.roles.includes(k) ? '{role}: can use {module}' : '{role}: cannot use {module}', { role: tr(l), module: tr(m.label) })} onClick={() => onToggleRole(m, k)}>{m.roles.includes(k) ? '✓' : ''}</button>
                </span>
              ))}
              <span className="fm-end"><button type="button" className="fm-q" disabled={!m.enabled} onClick={() => onSave(m, { roles: ROLES.map(r => r[0]) })}>{tr('All')}</button><button type="button" className="fm-q" disabled={!m.enabled} onClick={() => onSave(m, { roles: [] })}>{tr('None')}</button></span>
            </div>
          ))}
        </div>
      );
    })}
  </div>
  );
}
