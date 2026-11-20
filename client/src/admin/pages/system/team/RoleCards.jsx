import { Link } from 'react-router-dom';
import { ROLE_HUE } from '../../../ui.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/system.js';
import './team.css';

const hue = r => ROLE_HUE[r] ?? 250;

/** The "User roles" card: one tile per main role with its member avatars and permission ring. */
export function RoleCards({ me, rows, roles }) {
  const tr = useT();
  const canManage = me.perms?.includes('roles.manage');
  const total = Math.max(...roles.map(x => x.perms), 1);
  return (
    <div className="a-card xteam-flush">
      <div className="mk-hd xteam-hd"><b>{tr('User roles')}</b><span className="xteam-grow" />{canManage ? <Link to="/admin/roles" className="a-btn sm grad">{tr('Open the role matrix →')}</Link> : <span className="muted">{tr('What each role can do is set by the Master Admin')}</span>}</div>
      <div className="rl2-grid">
        {roles.filter(r => !r.legacy).map(r => {
          const mem = rows.filter(x => x.role === r.name);
          const body = (
            <>
              <div className="rl2-top"><span className="rl2-ic">{r.icon}</span><em title={tr('{n} member(s)', { n: mem.length })}>{mem.length}</em></div>
              <b>{tr(r.name)}</b>
              <span className="rl2-desc">{tr(r.desc)}</span>
              <div className="rl2-ring" style={{ '--p': Math.round(r.perms / total * 100) }} title={tr('{n} of {total} permissions', { n: r.perms, total })}><i>{r.perms}<small>/ {total}</small></i></div>
              <div className="rl2-av">
                {mem.slice(0, 3).map(m => <span key={m.id} title={m.name}>{m.name[0]}</span>)}
                {mem.length > 3 && <span className="more">+{mem.length - 3}</span>}
                {!mem.length && <small>{tr('No members yet')}</small>}
              </div>
            </>
          );
          return canManage
            ? <Link key={r.name} to="/admin/roles" className="rl2" style={{ '--h': hue(r.name) }} title={tr('Open the role matrix')}>{body}</Link>
            : <div key={r.name} className="rl2" style={{ '--h': hue(r.name) }}>{body}</div>;
        })}
      </div>
    </div>
  );
}
