import { useState } from 'react';
import { invApi } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import { Notice } from '../../../fieldKit.jsx';
import { Foot, num } from '../kit/invKit.jsx';
import { useSaveForm } from '../kit/useSaveForm.js';
import { SellPriceRows, sellRowsOf } from './SellPriceRows.jsx';

/** Rows state with a per-row setter, shared by the approve and stock-in forms. */
function useSellRows(initial) {
  const [rows, setRows] = useState(initial);
  const set = (i, k, v) => setRows(r => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return [rows, set];
}

/** Step 3 of 3: put the approved goods into stock, with each product's selling price and a remark. */
export function StockInForm({ d, onClose, onSaved }) {
  const [rows, set] = useSellRows(() => sellRowsOf(d.lines, l => l.unitCost));
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  const save = () => invApi.post('/receipts/' + d.id + '/stock-in', { lines: rows.map(r => ({ productId: r.productId, salePrice: num(r.salePrice), remarks: r.remarks })) });
  return (
    <Modal side kicker={d.id + ' · step 3 of 3'} title="Stock in" onClose={onClose} onSubmit={submit(save)} footer={<Foot onClose={onClose} busy={busy} label="Add to stock" />}>
      <div className="iv-form">
        <Notice err={err} />
        <div className="iv-flow"><span>1 Add</span><i className="on" /><span>2 Approve</span><i className="on" /><b>3 Stock in</b></div>
        <small className="fd-sub">Set the selling price for each product. It replaces the current price in the product list when you save.</small>
        <SellPriceRows rows={rows} set={set} />
      </div>
    </Modal>
  );
}

/** Step 2 of 3: the approver sets every product's selling price and a remark (both required), then approves. */
export function ApproveForm({ d, onClose, onSaved }) {
  const [rows, set] = useSellRows(() => sellRowsOf(d.lines, l => Math.round((l.qty * l.unitCost - (l.discount || 0)) / l.qty)));
  const [note, setNote] = useState('');
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  const save = () => {
    const bad = rows.find(r => num(r.salePrice) <= 0 || r.remarks.trim().length < 2);
    if (bad) throw new Error(num(bad.salePrice) <= 0 ? `Enter the selling price of "${bad.name}".` : `Write the remarks for "${bad.name}".`);
    return invApi.post('/receipts/' + d.id + '/approve', { note, lines: rows.map(r => ({ productId: r.productId, salePrice: num(r.salePrice), remarks: r.remarks.trim() })) });
  };
  return (
    <Modal side kicker={d.id + ' · step 2 of 3'} title="Approve this purchase" onClose={onClose} onSubmit={submit(save)} footer={<Foot onClose={onClose} busy={busy} label="Approve purchase" />}>
      <div className="iv-form">
        <Notice err={err} />
        <div className="iv-flow"><span>1 Add</span><i className="on" /><b>2 Approve</b><i /><span>3 Stock in</span></div>
        <small className="fd-sub">Set the <b>selling price</b> and write <b>remarks</b> for every product before approving. Both are required. The price goes live in the product list when the goods are stocked in.</small>
        <SellPriceRows rows={rows} set={set} approve />
        <label className="a-lbl">Approval note <small>(optional)</small><textarea className="a-input" rows={2} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Anything the team should know" /></label>
      </div>
    </Modal>
  );
}

/** Reject a pending purchase with a reason. */
export function RejectForm({ id, onClose, onSaved }) {
  const [note, setNote] = useState('');
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  return (
    <Modal narrow kicker={id} title="Reject this purchase" onClose={onClose} onSubmit={submit(() => invApi.post('/receipts/' + id + '/reject', { note }))} footer={<Foot onClose={onClose} busy={busy} label="Reject purchase" />}>
      <div className="iv-form"><Notice err={err} />
        <label className="a-lbl">Reason<textarea className="a-input" rows={3} required maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Why is this purchase being rejected?" /></label>
      </div>
    </Modal>
  );
}
