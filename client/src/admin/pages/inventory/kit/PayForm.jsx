import { useState } from 'react';
import { invApi } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import { Notice, fDate, taka, todayBd } from '../../../fieldKit.jsx';
import { useInv } from './useInv.js';
import { useSaveForm } from './useSaveForm.js';
import { Foot, METHODS, VendorSelect, num } from './invKit.jsx';

/** Pay a vendor (used from the vendor drawer, a purchase and the payments page). */
export function PayForm({ vendors, vendor, receipt, due, onClose, onSaved }) {
  const [f, setF] = useState({ vendorId: vendor || '', receiptId: receipt || '', amount: due || '', method: 'Cash', reference: '', date: todayBd(), note: '' });
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  const bills = useInv(f.vendorId ? '/receipts?vendor=' + f.vendorId : null);
  const open = (bills.data?.items || []).filter(b => b.due > 0 && (b.status === 'Approved' || b.status === 'Stocked'));
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  return (
    <Modal narrow kicker="Vendor payment" title="Pay vendor" onClose={onClose} onSubmit={submit(() => invApi.post('/payments', { ...f, amount: num(f.amount) }))} footer={<Foot onClose={onClose} busy={busy} label="Save payment" />}>
      <div className="iv-form">
        <Notice err={err} />
        <label className="a-lbl">Vendor<VendorSelect vendors={vendors} value={f.vendorId} onChange={v => setF(x => ({ ...x, vendorId: v, receiptId: '' }))} /></label>
        <label className="a-lbl">Against purchase <small>(optional, leave empty for an advance or part payment on the account)</small>
          <select className="a-input" value={f.receiptId} onChange={e => { const b = open.find(x => x.id === e.target.value); setF(x => ({ ...x, receiptId: e.target.value, amount: b ? b.due : x.amount })); }} disabled={!f.vendorId}>
            <option value="">On account</option>{open.map(b => <option key={b.id} value={b.id}>{b.id} · {b.invoiceNo || fDate(b.date)} · due {taka(b.due)}</option>)}
          </select></label>
        <div className="a-fields">
          <label className="a-lbl">Amount ৳<input className="a-input" type="number" min="1" required value={f.amount} onChange={set('amount')} /></label>
          <label className="a-lbl">Date<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
          <label className="a-lbl">Method<select className="a-input" value={f.method} onChange={set('method')}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="a-lbl">Reference <small>(txn / cheque no.)</small><input className="a-input" value={f.reference} onChange={set('reference')} /></label>
        </div>
        <label className="a-lbl">Note<input className="a-input" value={f.note} onChange={set('note')} /></label>
      </div>
    </Modal>
  );
}
