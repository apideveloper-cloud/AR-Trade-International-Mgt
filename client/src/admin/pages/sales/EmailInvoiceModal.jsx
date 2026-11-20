import { useState } from 'react';
import { adm, fmtMoney } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';
import { Rich } from '../growth/parts.jsx';
import './salesInline.css';

export function EmailInvoiceModal({ id, o, docNo, docOrder, onClose, onSent }) {
  const tr = useT();
  const [mail, setMail] = useState({ to: o.customer.email || '', message: '' }); // { to, message, busy, err, done }
  const submit = async e => {
    e.preventDefault();
    setMail(m => ({ ...m, busy: true, err: '' }));
    try { const r = await adm.post(`/orders/${id}/invoice/email`, { to: mail.to, message: mail.message }); setMail(m => ({ ...m, busy: false, done: r.to })); onSent(); }
    catch (x) { setMail(m => ({ ...m, busy: false, err: tr(x.message) })); }
  };
  return (
    <Modal kicker={docOrder ? tr('Sales order') : tr('Sales invoice')} title={tr('Email {doc} to the customer', { doc: docNo })} onClose={onClose} onSubmit={submit}
      footer={mail.done
        ? <button type="button" className="a-btn" onClick={onClose}>{tr('Close')}</button>
        : <><button type="button" className="a-btn ghost" onClick={onClose}>{tr('Cancel')}</button><button className="a-btn grad" disabled={mail.busy}>{mail.busy ? tr('Sending…') : '✉ ' + tr('Send invoice')}</button></>}>
      {mail.done ? (
        <div className="a-msg ok sinl-fs14"><Rich text={'✓ ' + tr('The invoice PDF was sent to <b>{to}</b>.', { to: mail.done })} /></div>
      ) : (
        <div className="sinl-col">
          <span className="sinl-note14"><Rich text={tr('The PDF invoice for order <b>{id}</b> ({total}) is attached to the email automatically.', { id, total: fmtMoney(o.total) })} /></span>
          <label className="a-lbl">{tr('Customer email')}<input className="a-input" type="email" required value={mail.to} onChange={e => setMail(m => ({ ...m, to: e.target.value }))} placeholder="customer@example.com" /></label>
          <label className="a-lbl">{tr('Message (optional)')}<textarea className="a-input" rows={3} value={mail.message} onChange={e => setMail(m => ({ ...m, message: e.target.value }))} placeholder={tr('A short note that appears above the order summary')} /></label>
          {mail.err && <div className="a-msg err">{mail.err}</div>}
        </div>
      )}
    </Modal>
  );
}
