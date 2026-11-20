import { GroupRows } from './GroupRows.jsx';
import { hue } from './rolesMeta.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';
import './roles.css';

/** The matrix itself: a header cell per role (progress, all / none / reset) and the grouped permission rows. */
export function RoleMatrixTable({ data, roles, groups, draft, toggle, setAll, reset }) {
  const tr = useT();
  const total = data.perms.length;
  return (
    <div className="a-table mx xroles-wrap">
      <table className="rm-table xroles-table">
        <colgroup><col className="xroles-c0" />{roles.map(r => <col key={r.name} />)}</colgroup>
        <thead>
          <tr>
            <th className="rm-th0 xroles-th xroles-sticky"><span>{tr('PERMISSION')}</span><small>{tr('{n} permissions, grouped', { n: total })}</small></th>
            {roles.map(r => {
              const n = r.locked ? total : (draft[r.name]?.size || 0);
              return (
                <th key={r.name} className="rm-th xroles-th" style={{ '--h': hue(r.name) }}>
                  <span className="rm-ic">{r.icon}</span>
                  <b>{tr(r.name)}</b>
                  <small title={tr(r.desc)}>{r.members === 1 ? tr('1 member') : tr('{n} members', { n: r.members })}</small>
                  <span className="rm-prog" title={tr('{n} of {total} permissions', { n, total })}><i style={{ width: Math.round(n / total * 100) + '%' }} /></span>
                  <em>{r.locked ? tr('Full access') : n + ' / ' + total}</em>
                  {!r.locked && (
                    <span className="rm-act">
                      <button type="button" onClick={() => setAll(r.name, true)}>{tr('all')}</button>
                      <button type="button" onClick={() => setAll(r.name, false)}>{tr('none')}</button>
                      <button type="button" onClick={() => reset(r.name)}>{tr('reset')}</button>
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map(([g, perms]) => <GroupRows key={g} group={g} perms={perms} roles={roles} draft={draft} toggle={toggle} />)}
        </tbody>
      </table>
    </div>
  );
}
