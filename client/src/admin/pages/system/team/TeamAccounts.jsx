import { dateF } from '../../../adminApi.js';
import { Pill, ROLE_HUE } from '../../../ui.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/system.js';
import { memberToForm } from './MemberModal.jsx';
import './team.css';

const hue = r => ROLE_HUE[r] ?? 250;

/** The "Team accounts" list: role picker, approve / disable, details and Master hand-over per member. */
export function TeamAccounts({ me, rows, roles, act, onAdd, onDetails, onTransfer }) {
  const tr = useT();
  return (
    <div className="a-card xteam-flush">
      <div className="mk-hd xteam-hd"><b>{tr('Team accounts')}</b><span className="chip">{rows.length}</span><span className="xteam-grow" /><button type="button" className="a-btn sm grad" onClick={onAdd}>＋ {tr('Add team member')}</button></div>
      {rows.map(a => (
        <div key={a.id} className="tm-row">
          <span className="tm-av" style={{ '--h': hue(a.role) }}>{a.name[0]}</span>
          <div className="tm-who"><b>{a.name}{a.id === me.id && <em>{tr('you')}</em>}</b><span>{a.email} · {tr('since {date}', { date: dateF(a.since) })}</span></div>
          {a.id === me.id && <span className="tm-role" style={{ '--h': hue(a.role) }}>{tr(a.role)}</span>}
          {a.id !== me.id && <select className="a-input xteam-rolesel" value={a.role} onChange={e => act(a.id, { role: e.target.value })}>{roles.filter(r => r.assignable || r.name === a.role).map(r => <option key={r.name} disabled={!r.assignable} value={r.name}>{tr(r.name)}</option>)}</select>}
          <Pill s={a.status === 'Pending' ? 'New' : a.status} label={a.status} />
          <button type="button" className="a-btn sm ghost" onClick={() => onDetails(memberToForm(a))}>{tr('Details')}</button>
          {a.id !== me.id && a.status !== 'Active' && <button className="a-btn sm" onClick={() => act(a.id, { status: 'Active' })}>{tr('Approve')}</button>}
          {me.role === 'Master Admin' && a.id !== me.id && a.status === 'Active' && <button type="button" className="a-btn sm ghost" title={tr('Make this person the Master Admin; you become an Admin')} onClick={() => onTransfer(a)}>★ {tr('Make Master')}</button>}
          {a.id !== me.id && a.status === 'Active' && <button className="a-btn sm ghost" onClick={() => act(a.id, { status: 'Disabled' })}>{tr('Disable')}</button>}
        </div>
      ))}
    </div>
  );
}
