import { GroupRows } from './GroupRows.jsx';
import { hue } from './rolesMeta.js';
import './roles.css';

/** The matrix itself: a header cell per role (progress, all / none / reset) and the grouped permission rows. */
export function RoleMatrixTable({ data, roles, groups, draft, toggle, setAll, reset }) {
  const total = data.perms.length;
  return (
    <div className="a-table mx xroles-wrap">
      <table className="rm-table xroles-table">
        <colgroup><col className="xroles-c0" />{roles.map(r => <col key={r.name} />)}</colgroup>
        <thead>
          <tr>
            <th className="rm-th0 xroles-th xroles-sticky"><span>PERMISSION</span><small>{total} permissions, grouped</small></th>
            {roles.map(r => {
              const n = r.locked ? total : (draft[r.name]?.size || 0);
              return (
                <th key={r.name} className="rm-th xroles-th" style={{ '--h': hue(r.name) }}>
                  <span className="rm-ic">{r.icon}</span>
                  <b>{r.name}</b>
                  <small title={r.desc}>{r.members} member{r.members === 1 ? '' : 's'}</small>
                  <span className="rm-prog" title={n + ' of ' + total + ' permissions'}><i style={{ width: Math.round(n / total * 100) + '%' }} /></span>
                  <em>{r.locked ? 'Full access' : n + ' / ' + total}</em>
                  {!r.locked && (
                    <span className="rm-act">
                      <button type="button" onClick={() => setAll(r.name, true)}>all</button>
                      <button type="button" onClick={() => setAll(r.name, false)}>none</button>
                      <button type="button" onClick={() => reset(r.name)}>reset</button>
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
