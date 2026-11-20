import { useState } from 'react';
import { invApi } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import { Chip, Notice, taka, todayBd } from '../../../fieldKit.jsx';
import { useInv } from '../kit/useInv.js';
import { useSaveForm } from '../kit/useSaveForm.js';
import { Lines } from '../kit/Lines.jsx';
import { Foot, VendorSelect, balText, balTone, linesBody, lineTotal, num } from '../kit/invKit.jsx';
import { VendorForm } from '../vendors/VendorForm.jsx';
import { initials } from '../vendors/vendorInitials.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/inventory.js';

/** Read-only card of the chosen vendor under the purchase details. */
function VendorInfo({ sel }) {
  const tr = useT();
  return (
    <div className="pu-vinfo">
      <span className="vd-av sm" aria-hidden="true">{initials(sel.name)}</span>
      <div className="pu-vmain">
        <b>{sel.name}</b>
        <span className="pu-vtags"><i className="vd-id mono">{sel.code || '—'}</i><Chip tone={sel.vtype === 'Foreign' ? 'blue' : 'ok'}>{tr(sel.vtype)}</Chip>{!sel.active && <Chip tone="off">{tr('Inactive')}</Chip>}{sel.kind && <em>{sel.kind}</em>}</span>
        <Chip tone={balTone(sel.balance)}>{balText(sel.balance, tr)}</Chip>
      </div>
      <dl className="pu-vdl">
        <div><dt>{tr('PIC')}</dt><dd>{[sel.contact, sel.picDesig].filter(Boolean).join(' · ') || '—'}</dd></div>
        <div><dt>{tr('PIC mobile')}</dt><dd>{sel.picPhone || '—'}</dd></div>
        <div><dt>{tr('Phone')}</dt><dd>{sel.phone || '—'}</dd></div>
        <div><dt>{tr('Email')}</dt><dd>{sel.email || '—'}</dd></div>
        <div className="wide"><dt>{tr('Address')}</dt><dd>{sel.address || '—'}</dd></div>
      </dl>
    </div>
  );
}

/** Right-hand column: running total, note and the three-step explainer. */
function SideColumn({ lines, total, discount, note, onNote }) {
  const tr = useT();
  return (
    <aside className="pu-side">
      <div className="pu-sum">
        <small>{tr('Purchase total')}</small>
        <b>{taka(total)}</b>
        <div className="pu-sum-row"><span>{tr('Products')}</span><em>{lines.length}</em></div>
        {discount > 0 && <div className="pu-sum-row"><span>{tr('Discount given')}</span><em>−{taka(discount)}</em></div>}
        <div className="pu-sum-row"><span>{tr('Units')}</span><em>{lines.reduce((t, l) => t + num(l.qty), 0)}</em></div>
      </div>
      <label className="a-lbl">{tr('Note')}<textarea className="a-input" rows={3} maxLength={300} value={note} onChange={onNote} placeholder={tr('Challan no., condition on arrival…')} /></label>
      <ol className="pu-steps">
        <li className="now"><i>1</i><div><b>{tr('Add')}</b><small>{tr('You are here. Save the purchase.')}</small></div></li>
        <li><i>2</i><div><b>{tr('Approve')}</b><small>{tr("A Master Admin or Admin approves it. It becomes a bill on the vendor's account.")}</small></div></li>
        <li><i>3</i><div><b>{tr('Stock in')}</b><small>{tr('Set each selling price and remarks, then add to stock.')}</small></div></li>
      </ol>
    </aside>
  );
}

/** Step 1 of 3: record the purchase. Nothing touches stock or the vendor's account until it is approved and stocked in. */
export function ReceiveForm({ vendors, onVendorAdded, onClose, onSaved }) {
  const tr = useT();
  const [f, setF] = useState({ vendorId: '', poId: '', referenceNo: '', date: todayBd(), note: '' });
  const nextNo = useInv('/next-invoice?date=' + f.date);
  const sel = vendors.find(v => String(v.id) === String(f.vendorId));
  const [lines, setLines] = useState([]);
  const [newVendor, setNewVendor] = useState(false);
  const { busy, err, setErr, submit } = useSaveForm(onSaved, onClose);
  const pos = useInv('/open-orders');
  const orders = pos.data?.items || [];
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const pickPo = async id => {
    const po = orders.find(p => p.id === id);
    setF(v => ({ ...v, poId: id, vendorId: po ? String(po.vendorId) : v.vendorId }));
    if (!po) return;
    try { const r = await invApi.get('/open-orders/' + id); setLines(r.lines.map(l => ({ ...l, stock: '—' }))); } catch (e) { setErr(e.message); }
  };
  const total = lines.reduce((t, l) => t + lineTotal(l), 0);
  const discount = lines.reduce((t, l) => t + Math.min(num(l.discount), num(l.qty) * num(l.unitCost)), 0);
  const save = () => invApi.post('/receipts', { vendorId: f.vendorId, poId: f.poId, referenceNo: f.referenceNo, date: f.date, note: f.note, lines: linesBody(lines) });
  return (
    <>
      <Modal side kicker={tr('Purchase · step 1 of 3')} title={tr('Add a purchase')} onClose={onClose} onSubmit={submit(save)} footer={<Foot onClose={onClose} busy={busy} label="Save purchase" />}>
        <div className="pu-form">
          <div className="pu-main">
            <Notice err={err && tr(err)} />
            {!!orders.length && (
              <label className="a-lbl">{tr('Against an approved purchase order')} <small>{tr('(optional: fills in the vendor and products)')}</small>
                <select className="a-input" value={f.poId} onChange={e => pickPo(e.target.value)}><option value="">{tr('No purchase order')}</option>{orders.map(p => <option key={p.id} value={p.id}>{p.id} · {p.vendor} · {taka(p.total)}</option>)}</select></label>
            )}
            <section className="pu-card">
              <header className="iv-lhd"><b>{tr('Purchase details')}</b><span>{tr('Who sold it, and when')}</span></header>
              <div className="pu-fields">
                <div className="a-lbl">{tr('Vendor')}
                  <span className="iv-paid"><VendorSelect vendors={vendors} value={f.vendorId} onChange={v => setF(x => ({ ...x, vendorId: v }))} /><button type="button" className="a-mini" onClick={() => setNewVendor(true)}>{tr('＋ New')}</button></span></div>
                <label className="a-lbl"><span className="pu-lbl">{tr('Vendor invoice no.')} <i className="pu-auto">{tr('auto')}</i></span><input className="a-input pu-locked" readOnly tabIndex={-1} value={nextNo.data?.invoiceNo || '…'} title={tr('Given automatically when you save')} /></label>
                <label className="a-lbl"><span className="pu-lbl">{tr('Reference no.')} <i className="pu-opt">{tr('optional')}</i></span><input className="a-input" maxLength={60} value={f.referenceNo} onChange={set('referenceNo')} placeholder={tr("Vendor's bill, challan or PO no.")} /></label>
                <label className="a-lbl">{tr('Purchase date')}<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
              </div>
              {sel && <VendorInfo sel={sel} />}
            </section>
            <Lines lines={lines} setLines={setLines} withDiscount newProduct />
          </div>
          <SideColumn lines={lines} total={total} discount={discount} note={f.note} onNote={set('note')} />
        </div>
      </Modal>
      {newVendor && <VendorForm onClose={() => setNewVendor(false)} onSaved={res => { onVendorAdded(String(res?.id || '')); if (res?.id) setF(x => ({ ...x, vendorId: String(res.id) })); }} />}
    </>
  );
}
