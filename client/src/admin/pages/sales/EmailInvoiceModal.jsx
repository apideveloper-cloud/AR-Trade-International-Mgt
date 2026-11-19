import { useState } from 'react';
import { adm, fmtMoney } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import './salesInline.css';

export function EmailInvoiceModal({ id, o, docNo, docOrder, onClose, onSent }) {
  const [mail, setMail] = useState({ to: o.customer.email || '', message: '' }); // { to, message, busy, err, done }
  const submit = async e => {
    e.preventDefault();
    setMail(m => ({ ...m, busy: true, err: '' }));
    try { const r = await adm.post(`/orders/${id}/invoice/email`, { to: mail.to, message: mail.message }); setMail(m => ({ ...m, busy: false, done: r.to })); onSent(); }
    catch (x) { setMail(m => ({ ...m, busy: false, err: x.message })); }
  };
  return (
    <Modal kicker={docOrder ? 'Sales order' : 'Sales invoice'} title={'Email ' + docNo + ' to the customer'} onClose={onClose} onSubmit={submit}
      footer={mail.done
        ? <button type="button" className="a-btn" onClick={onClose}>Close</button>
        : <><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={mail.busy}>{mail.busy ? 'Sending…' : '✉ Send invoice'}</button></>}>
      {mail.done ? (
        <div className="a-msg ok sinl-fs14">✓ The invoice PDF was sent to <b>{mail.done}</b>.</div>
      ) : (
        <div className="sinl-col">
          <span className="sinl-note14">The PDF invoice for order <b>{id}</b> ({fmtMoney(o.total)}) is attached to the email automatically.</span>
          <label className="a-lbl">Customer email<input className="a-input" type="email" required value={mail.to} onChange={e => setMail(m => ({ ...m, to: e.target.value }))} placeholder="customer@example.com" /></label>
          <label className="a-lbl">Message (optional)<textarea className="a-input" rows={3} value={mail.message} onChange={e => setMail(m => ({ ...m, message: e.target.value }))} placeholder="A short note that appears above the order summary" /></label>
          {mail.err && <div className="a-msg err">{mail.err}</div>}
        </div>
      )}
    </Modal>
  );
}
