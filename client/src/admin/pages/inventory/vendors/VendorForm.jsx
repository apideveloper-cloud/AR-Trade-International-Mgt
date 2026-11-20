import { useState } from 'react';
import { invApi } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import { Notice } from '../../../fieldKit.jsx';
import { Foot } from '../kit/invKit.jsx';
import { useSaveForm } from '../kit/useSaveForm.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/inventory.js';

/** A titled card of the vendor form. */
function Card({ title, hint, children }) {
  const tr = useT();
  return (
    <section className="pu-card">
      <header className="iv-lhd"><b>{tr(title)}</b><span>{tr(hint)}</span></header>
      {children}
    </section>
  );
}

/** Add a vendor, or (with `vendor`) edit one. onSaved receives the saved vendor. */
export function VendorForm({ vendor, onClose, onSaved }) {
  const tr = useT();
  const [f, setF] = useState({ name: '', vtype: 'Local', kind: '', contact: '', picDesig: '', picPhone: '', phone: '', email: '', address: '', note: '', opening: 0, active: true, ...(vendor || {}) });
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const save = () => (vendor ? invApi.put('/vendors/' + vendor.id, f) : invApi.post('/vendors', f));
  return (
    <Modal side kicker={tr('Vendor / supplier')} title={tr(vendor ? 'Edit vendor' : 'Add vendor')} onClose={onClose} onSubmit={submit(save)} footer={<Foot onClose={onClose} busy={busy} label="Save vendor" />}>
      <div className="vf">
        <Notice err={err && tr(err)} />
        <Card title="Vendor" hint="The company we buy from">
          <div className="vf-grid">
            <div className="iv-top vf-w3">
              <label className="a-lbl">{tr('Vendor name')}<input className="a-input" required value={f.name} onChange={set('name')} placeholder={tr('e.g. Global Toner BD')} /></label>
              <div className="a-lbl">{tr('Vendor type')}
                <div className="iv-seg" role="radiogroup" aria-label={tr('Vendor type')}>
                  {['Local', 'Foreign'].map(v => <button key={v} type="button" role="radio" aria-checked={f.vtype === v} className={f.vtype === v ? 'on' : ''} onClick={() => setF(x => ({ ...x, vtype: v }))}>{tr(v)}</button>)}
                </div>
              </div>
            </div>
            <label className="a-lbl">{tr('Supplies')}<input className="a-input" value={f.kind} onChange={set('kind')} placeholder={tr('Toner, ink, paper…')} /></label>
            <label className="a-lbl">{tr('Phone')}<input className="a-input" value={f.phone} onChange={set('phone')} /></label>
            <label className="a-lbl">{tr('Email')}<input className="a-input" type="email" value={f.email} onChange={set('email')} /></label>
          </div>
        </Card>
        <Card title="Vendor PIC" hint="Person in charge at the vendor">
          <div className="vf-grid">
            <label className="a-lbl">{tr('PIC name')}<input className="a-input" value={f.contact} onChange={set('contact')} placeholder={tr('Who we deal with')} /></label>
            <label className="a-lbl">{tr('Designation')}<input className="a-input" value={f.picDesig} onChange={set('picDesig')} placeholder={tr('e.g. Sales manager')} /></label>
            <label className="a-lbl">{tr('PIC mobile')}<input className="a-input" value={f.picPhone} onChange={set('picPhone')} placeholder="01XXXXXXXXX" /></label>
          </div>
        </Card>
        <Card title="Address & remarks" hint="Where they are, and anything worth remembering">
          <div className="vf-2">
            <label className="a-lbl">{tr('Address')}<textarea className="a-input" rows={3} maxLength={300} value={f.address} onChange={set('address')} placeholder={tr('Street, area, city')} /></label>
            <label className="a-lbl">{tr('Remarks')}<textarea className="a-input" rows={3} maxLength={300} value={f.note} onChange={set('note')} placeholder={tr('Payment terms, delivery time, quality notes…')} /></label>
          </div>
        </Card>
        <Card title="Account" hint="Money we owed before using this system">
          <div className="vf-acc">
            <label className="a-lbl">{tr('Opening balance ৳')} <small>{tr('(negative if they owe us)')}</small><input className="a-input r" type="number" value={f.opening} onChange={set('opening')} /></label>
            <label className="vf-active"><input type="checkbox" checked={f.active} onChange={e => setF(v => ({ ...v, active: e.target.checked }))} /><span><b>{tr('Active')}</b><small>{tr('Shown when choosing a vendor')}</small></span></label>
          </div>
        </Card>
      </div>
    </Modal>
  );
}
