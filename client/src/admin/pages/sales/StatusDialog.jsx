import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Modal, Pill } from '../../ui.jsx';
import { QUICK } from './constants.js';
import './salesInline.css';

/** Asks for the remarks every order status change needs, then saves it. Used by the order drawer and the Deliveries queue. */
export function StatusDialog({ id, from, to, onClose, onSaved }) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    const text = remarks.trim();
    if (text.length < 3) { setErr('Write the remarks first (at least 3 characters).'); return; }
    setBusy(true); setErr('');
    try { onSaved(await adm.put(`/orders/${id}/status`, { status: to, remarks: text })); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const cancelling = to === 'Cancelled';
  return (
    <Modal narrow kicker="Order progress" title={`Move ${id} to ${to}`} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className={'a-btn ' + (cancelling ? 'sinl-cancelbtn' : 'grad')} disabled={busy}>{busy ? 'Saving…' : cancelling ? 'Cancel the order' : 'Set to ' + to}</button></>}>
      <div className="sinl-col">
        <div className="od-move"><Pill s={from} /><span>→</span><Pill s={to} /></div>
        {cancelling && <div className="a-msg err sinl-fs125">Cancelling puts the stock back and closes the order.</div>}
        <label className="a-lbl"><span>Remarks <b className="sinl-req">*</b> <small className="sinl-reqhint">required</small></span>
          <textarea className="a-input" rows={3} autoFocus required maxLength={255} value={remarks} onChange={e => { setRemarks(e.target.value); setErr(''); }} placeholder="Why is the order moving to this status? Your team will see this on the timeline." />
        </label>
        <div className="od-quick">{(QUICK[to] || []).map(t => <button key={t} type="button" onClick={() => { setRemarks(t); setErr(''); }}>{t}</button>)}</div>
        {err && <div className="a-msg err">{err}</div>}
      </div>
    </Modal>
  );
}
