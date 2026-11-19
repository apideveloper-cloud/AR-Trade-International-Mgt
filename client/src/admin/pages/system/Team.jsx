import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Summary } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { MemberModal, blankMember } from './team/MemberModal.jsx';
import { RoleCards } from './team/RoleCards.jsx';
import { TeamAccounts } from './team/TeamAccounts.jsx';
import { TransferModal } from './team/TransferModal.jsx';

/** Team page: summary, role tiles, the account list and the add / details / hand-over dialogs. */
export function Team({ me }) {
  const [add, setAdd] = useState(null); // null | member form state (see MemberModal)
  const [transferFor, setTransferFor] = useState(null);
  const staffQ = useApiData(() => adm.get('/staff'), [], []);
  const rolesQ = useApiData(() => adm.get('/staff/roles'), [], []);
  const rows = staffQ.data, roles = rolesQ.data, load = staffQ.reload;
  const [err, setErr] = useState('');
  const act = async (id, body) => { try { await adm.put('/staff/' + id, body); setErr(''); load(); } catch (e) { setErr(e.message); } };
  const pending = rows.filter(r => r.status === 'Pending').length;
  return (
    <>
      {transferFor && <TransferModal to={transferFor} onClose={() => setTransferFor(null)} />}
      <Summary items={[
        ['Team members', rows.length, rows.filter(r => r.status === 'Active').length + ' active', 'blue', 'users'],
        ['Waiting for approval', pending, pending ? 'Open the list below to approve' : 'Nobody is waiting', 'amber', 'clock'],
        ['Roles in use', new Set(rows.map(r => r.role)).size, roles.filter(r => !r.legacy).length + ' main roles available', 'violet', 'tag'],
        ['Disabled', rows.filter(r => r.status === 'Disabled').length, 'Cannot sign in', 'red', 'alert']
      ]} />
      <RoleCards me={me} rows={rows} roles={roles} />
      {(err || staffQ.error || rolesQ.error) && <div className="a-msg err">{err || staffQ.error || rolesQ.error}</div>}
      <TeamAccounts me={me} rows={rows} roles={roles} act={act} onAdd={() => setAdd(blankMember(roles))} onDetails={setAdd} onTransfer={setTransferFor} />
      {add && <MemberModal add={add} setAdd={setAdd} roles={roles} onSaved={load} />}
    </>
  );
}
