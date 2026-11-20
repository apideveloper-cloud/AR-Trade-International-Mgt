import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Modal, Pill } from '../../ui.jsx';
import { QUICK } from './constants.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';
import './salesInline.css';

/** Asks for the remarks every order status change needs, then saves it. Used by the order drawer and the Deliveries queue. */
export function StatusDialog({ id, from, to, onClose, onSaved }) {
  const tr = useT();
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    const text = remarks.trim();
    if (text.length < 3) { setErr(tr('Write the remarks first (at least 3 characters).')); return; }
    setBusy(true); setErr('');
    try { onSaved(await adm.put(`/orders/${id}/status`, { status: to, remarks: text })); } catch (x) { setErr(tr(x.message)); setBusy(false); }
  };
  const cancelling = to === 'Cancelled';
  return (
    <Modal narrow kicker={tr('Order progress')} title={tr('Move {id} to {to}', { id, to: tr(to) })} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>{tr('Cancel')}</button><button className={'a-btn ' + (cancelling ? 'sinl-cancelbtn' : 'grad')} disabled={busy}>{busy ? tr('Saving…') : cancelling ? tr('Cancel the order') : tr('Set to {to}', { to: tr(to) })}</button></>}>
      <div className="sinl-col">
        <div className="od-move"><Pill s={from} /><span>→</span><Pill s={to} /></div>
        {cancelling && <div className="a-msg err sinl-fs125">{tr('Cancelling puts the stock back and closes the order.')}</div>}
        <label className="a-lbl"><span>{tr('Remarks')} <b className="sinl-req">*</b> <small className="sinl-reqhint">{tr('required')}</small></span>
          <textarea className="a-input" rows={3} autoFocus required maxLength={255} value={remarks} onChange={e => { setRemarks(e.target.value); setErr(''); }} placeholder={tr('Why is the order moving to this status? Your team will see this on the timeline.')} />
        </label>
        <div className="od-quick">{(QUICK[to] || []).map(q => <button key={q} type="button" onClick={() => { setRemarks(tr(q)); setErr(''); }}>{tr(q)}</button>)}</div>
        {err && <div className="a-msg err">{err}</div>}
      </div>
    </Modal>
  );
}
