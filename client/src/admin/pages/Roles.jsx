import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/toplevel.js';
import '../i18n/dict/system.js';
import { dateTimeF } from '../adminApi.js';
import { RoleMatrixTable } from './roles/RoleMatrixTable.jsx';
import { downloadRoleCsv } from './roles/roleCsv.js';
import { useRoleMatrix } from './roles/useRoleMatrix.js';
import './roles/roles.css';

// <u>underlined</u> pieces inside one translated sentence
const U = ({ text }) => <>{String(text).split(/(<u>.*?<\/u>)/g).map((p, i) => (p.startsWith('<u>') ? <u key={i}>{p.slice(3, -4)}</u> : p))}</>;

/** The role matrix: one column per role, one row per permission. Only the Master Admin sees this page. */
export function Roles() {
  const tr = useT();
  const m = useRoleMatrix();
  const { data, draft, roles, changed } = m;
  if (!data) return m.err ? <div className="a-msg err">{tr(m.err)}</div> : <span className="spin" />;
  return (
    <>
      <div className="rm-hero">
        <span className="rm-hero-ic">🔐</span>
        <div>
          <b>{tr('Role matrix')}</b>
          <span><U text={tr("Tick what each role may do. <u>Master Admin</u> always has full access and is the only role that can open this page. <u>Admin</u> has limited access: exactly the ticks you set below. Changes apply on the person's next click, no sign-out needed.")} /></span>
        </div>
        <div className="rm-hero-act">
          <label className="rm-legacy"><input type="checkbox" checked={m.showLegacy} onChange={e => m.setShowLegacy(e.target.checked)} />{tr('Show existing roles')}</label>
          <button type="button" className="a-btn sm" onClick={() => downloadRoleCsv(roles, data.perms, draft)}>{tr('⤓ Download CSV')}</button>
        </div>
      </div>
      {m.err && <div className="a-msg err">{tr(m.err)}</div>}
      {m.msg && <div className="a-msg xroles-ok">{tr(m.msg)}</div>}

      <RoleMatrixTable data={data} roles={roles} groups={m.groups} draft={draft} toggle={m.toggle} setAll={m.setAll} reset={m.reset} />

      <div className="a-save"><span>{changed.length ? <b>{tr(changed.length === 1 ? '{n} role with unsaved changes: {names}' : '{n} roles with unsaved changes: {names}', { n: changed.length, names: changed.map(x => tr(x)).join(', ') })}</b> : tr('No unsaved changes.')}</span>
        <span className="xroles-btns">
          {changed.length > 0 && <button className="a-btn ghost" onClick={m.discard}>{tr('Discard')}</button>}
          <button className="a-btn xroles-save" disabled={!changed.length || m.busy} onClick={m.save}>{m.busy ? tr('Saving…') : tr('Save role matrix')}</button>
        </span>
      </div>

      <div className="a-card xroles-log">
        <h3>{tr('Recent changes')}</h3>
        {!data.log.length && <span className="xroles-none">{tr('No changes yet.')}</span>}
        {data.log.map((l, i) => <div key={i} className="xroles-entry"><b>{tr(l.role)}</b> · {tr(l.what)} <span className="xroles-by">— {l.by}, {dateTimeF(l.at)}</span></div>)}
      </div>
    </>
  );
}
