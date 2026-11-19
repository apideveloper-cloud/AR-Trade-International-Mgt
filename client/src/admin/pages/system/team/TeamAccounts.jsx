import { dateF } from '../../../adminApi.js';
import { Pill, ROLE_HUE } from '../../../ui.jsx';
import { memberToForm } from './MemberModal.jsx';
import './team.css';

const hue = r => ROLE_HUE[r] ?? 250;

/** The "Team accounts" list: role picker, approve / disable, details and Master hand-over per member. */
export function TeamAccounts({ me, rows, roles, act, onAdd, onDetails, onTransfer }) {
  return (
    <div className="a-card xteam-flush">
      <div className="mk-hd xteam-hd"><b>Team accounts</b><span className="chip">{rows.length}</span><span className="xteam-grow" /><button type="button" className="a-btn sm grad" onClick={onAdd}>＋ Add team member</button></div>
      {rows.map(a => (
        <div key={a.id} className="tm-row">
          <span className="tm-av" style={{ '--h': hue(a.role) }}>{a.name[0]}</span>
          <div className="tm-who"><b>{a.name}{a.id === me.id && <em>you</em>}</b><span>{a.email} · since {dateF(a.since)}</span></div>
          {a.id === me.id && <span className="tm-role" style={{ '--h': hue(a.role) }}>{a.role}</span>}
          {a.id !== me.id && <select className="a-input xteam-rolesel" value={a.role} onChange={e => act(a.id, { role: e.target.value })}>{roles.filter(r => r.assignable || r.name === a.role).map(r => <option key={r.name} disabled={!r.assignable}>{r.name}</option>)}</select>}
          <Pill s={a.status === 'Pending' ? 'New' : a.status} label={a.status} />
          <button type="button" className="a-btn sm ghost" onClick={() => onDetails(memberToForm(a))}>Details</button>
          {a.id !== me.id && a.status !== 'Active' && <button className="a-btn sm" onClick={() => act(a.id, { status: 'Active' })}>Approve</button>}
          {me.role === 'Master Admin' && a.id !== me.id && a.status === 'Active' && <button type="button" className="a-btn sm ghost" title="Make this person the Master Admin; you become an Admin" onClick={() => onTransfer(a)}>★ Make Master</button>}
          {a.id !== me.id && a.status === 'Active' && <button className="a-btn sm ghost" onClick={() => act(a.id, { status: 'Disabled' })}>Disable</button>}
        </div>
      ))}
    </div>
  );
}
