import { GROUP_HUE, GROUP_ICON, editable, hue } from './rolesMeta.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';
import './roles.css';

/** One permission group: a heading row, then a row per permission with a checkbox per role. */
export function GroupRows({ group, perms, roles, draft, toggle }) {
  const tr = useT();
  return (
    <>
      <tr className="rm-grp" style={{ '--h': GROUP_HUE[group] ?? 250 }}>
        <td colSpan={roles.length + 1}><span className="rm-gic">{GROUP_ICON[group] || '•'}</span><b>{tr(group)}</b><em>{perms.length === 1 ? tr('1 permission') : tr('{n} permissions', { n: perms.length })}</em></td>
      </tr>
      {perms.map(p => (
        <tr key={p.key} className="rm-row">
          <td className="rm-perm xroles-sticky xroles-perm">
            <span className="rm-pl">{tr(p.label)}</span>
            <code>{p.key}</code>
          </td>
          {roles.map(r => {
            const on = !!(r.locked || draft[r.name]?.has(p.key));
            const fixed = r.locked || !editable(p.key);
            return (
              <td key={r.name} className={'rm-td' + (on && !fixed ? ' on' : '')} style={{ '--h': hue(r.name) }}>
                {!editable(p.key) && !r.locked ? <span className="rm-lock" title={tr('Master Admin only')}>🔒</span> : (
                  <label className={'rm-cell' + (fixed ? ' fixed' : '')} title={fixed ? tr('Always allowed for the Master Admin') : (on ? tr('Allowed. Click to remove') : tr('Not allowed. Click to allow'))}>
                    <input type="checkbox" checked={on} disabled={fixed} onChange={() => toggle(r.name, p.key)} aria-label={`${tr(r.name)}: ${tr(p.label)}`} />
                    <span className="rm-box"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
                  </label>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
