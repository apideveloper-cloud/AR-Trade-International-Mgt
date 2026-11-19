import { useState } from 'react';
import { adm } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import './team.css';

/** The one-way hand-over of the Master Admin role: the person must type TRANSFER to confirm. */
export function TransferModal({ to, onClose }) {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    if (word.trim().toUpperCase() !== 'TRANSFER' || busy) return;
    setBusy(true); setErr('');
    try { await adm.post('/staff/' + to.id + '/make-master', { confirm: 'TRANSFER' }); window.location.reload(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal narrow kicker="Master Admin" title="Hand over the Master Admin role" onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn danger" disabled={word.trim().toUpperCase() !== 'TRANSFER' || busy}>{busy ? 'Transferring…' : 'Transfer role'}</button></>}>
      <p className="pwm-note xteam-note">There is only one Master Admin. This makes <b>{to.name}</b> the Master Admin and turns <b>you</b> into an Admin. You can't undo it yourself; only the new Master Admin can hand it back.</p>
      <label className="a-lbl"><span>Type <b>TRANSFER</b> to confirm</span>
        <input className="a-input" value={word} onChange={e => setWord(e.target.value)} placeholder="TRANSFER" autoFocus autoComplete="off" />
      </label>
      {err && <div className="a-msg err">{err}</div>}
    </Modal>
  );
}
