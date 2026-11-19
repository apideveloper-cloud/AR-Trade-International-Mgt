import { dateTimeF } from '../adminApi.js';
import { RoleMatrixTable } from './roles/RoleMatrixTable.jsx';
import { downloadRoleCsv } from './roles/roleCsv.js';
import { useRoleMatrix } from './roles/useRoleMatrix.js';
import './roles/roles.css';

/** The role matrix: one column per role, one row per permission. Only the Master Admin sees this page. */
export function Roles() {
  const m = useRoleMatrix();
  const { data, draft, roles, changed } = m;
  if (!data) return m.err ? <div className="a-msg err">{m.err}</div> : <span className="spin" />;
  return (
    <>
      <div className="rm-hero">
        <span className="rm-hero-ic">🔐</span>
        <div>
          <b>Role matrix</b>
          <span>Tick what each role may do. <u>Master Admin</u> always has full access and is the only role that can open this page. <u>Admin</u> has limited access: exactly the ticks you set below. Changes apply on the person's next click, no sign-out needed.</span>
        </div>
        <div className="rm-hero-act">
          <label className="rm-legacy"><input type="checkbox" checked={m.showLegacy} onChange={e => m.setShowLegacy(e.target.checked)} />Show existing roles</label>
          <button type="button" className="a-btn sm" onClick={() => downloadRoleCsv(roles, data.perms, draft)}>⤓ Download CSV</button>
        </div>
      </div>
      {m.err && <div className="a-msg err">{m.err}</div>}
      {m.msg && <div className="a-msg xroles-ok">{m.msg}</div>}

      <RoleMatrixTable data={data} roles={roles} groups={m.groups} draft={draft} toggle={m.toggle} setAll={m.setAll} reset={m.reset} />

      <div className="a-save"><span>{changed.length ? <b>{changed.length} role{changed.length === 1 ? '' : 's'} with unsaved changes: {changed.join(', ')}</b> : 'No unsaved changes.'}</span>
        <span className="xroles-btns">
          {changed.length > 0 && <button className="a-btn ghost" onClick={m.discard}>Discard</button>}
          <button className="a-btn xroles-save" disabled={!changed.length || m.busy} onClick={m.save}>{m.busy ? 'Saving…' : 'Save role matrix'}</button>
        </span>
      </div>

      <div className="a-card xroles-log">
        <h3>Recent changes</h3>
        {!data.log.length && <span className="xroles-none">No changes yet.</span>}
        {data.log.map((l, i) => <div key={i} className="xroles-entry"><b>{l.role}</b> · {l.what} <span className="xroles-by">— {l.by}, {dateTimeF(l.at)}</span></div>)}
      </div>
    </>
  );
}
