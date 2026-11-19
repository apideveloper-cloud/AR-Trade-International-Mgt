import { useState } from 'react';
import { invApi } from '../../../adminApi.js';
import { Drawer, alertBox, confirmBox } from '../../../ui.jsx';
import { IconBtn } from '../../../IconBtn.jsx';
import { Chip, Skeleton, fDate, taka } from '../../../fieldKit.jsx';
import { useInv } from '../kit/useInv.js';
import { PayForm } from '../kit/PayForm.jsx';
import { balText, balTone } from '../kit/invKit.jsx';
import { VendorForm } from './VendorForm.jsx';
import { initials } from './vendorInitials.js';

const sumOf = (items, pick, key) => items.filter(pick).reduce((t, r) => t + r[key], 0);

/** Phone / email value that is a link when present. */
const Contact = ({ scheme, value }) => (value ? <a href={scheme + value}>{value}</a> : '—');

/** Statement of one vendor: balance, contact card, actions and the account ledger. */
export function VendorDrawer({ id, canEdit, onClose, onChanged, vendors }) {
  const led = useInv('/vendors/' + id + '/ledger');
  const [pay, setPay] = useState(false); const [edit, setEdit] = useState(false);
  const d = led.data;
  const after = () => { led.reload(); onChanged(); };
  const remove = async () => {
    if (!(await confirmBox(`Delete ${d.vendor.name}? Only vendors with no purchases or payments can be deleted.`, { danger: true, confirmLabel: 'Delete' }))) return;
    try { await invApi.del('/vendors/' + id); onChanged(); onClose(); } catch (e) { alertBox(e.message); }
  };
  return (
    <Drawer title={d?.vendor.name || 'Vendor'} sub={d ? balText(d.balance) : 'Loading…'} onClose={onClose}>
      {!d ? <Skeleton rows={6} /> : (
        <>
          <div className="vd-top">
            <span className="vd-av" aria-hidden="true">{initials(d.vendor.name)}</span>
            <div className="vd-chips">
              <span className="vd-id mono" title="Vendor profile ID">{d.vendor.code || '—'}</span>
              <Chip tone={d.vendor.vtype === 'Foreign' ? 'blue' : 'ok'}>{d.vendor.vtype}</Chip>
              <Chip tone={d.vendor.active ? 'ok' : 'off'}>{d.vendor.active ? 'Active' : 'Inactive'}</Chip>
              {d.vendor.kind && <span className="vd-kind">{d.vendor.kind}</span>}
            </div>
          </div>
          <div className="vd-stats">
            <div><small>Bills</small><b>{taka(sumOf(d.items, () => true, 'credit'))}</b></div>
            <div><small>Returned</small><b>{taka(sumOf(d.items, r => r.type === 'Return', 'debit'))}</b></div>
            <div><small>Paid</small><b>{taka(sumOf(d.items, r => r.type === 'Payment', 'debit'))}</b></div>
            <div className={'vd-bal ' + balTone(d.balance)}><small>Balance</small><b>{balText(d.balance)}</b></div>
          </div>
          <section className="vd-card">
            <header className="iv-lhd"><b>Contact</b><span>{d.vendor.picDesig || 'Vendor details'}</span></header>
            <dl className="vd-dl">
              <div><dt>PIC</dt><dd>{d.vendor.contact || '—'}</dd></div>
              <div><dt>PIC mobile</dt><dd><Contact scheme="tel:" value={d.vendor.picPhone} /></dd></div>
              <div><dt>Phone</dt><dd><Contact scheme="tel:" value={d.vendor.phone} /></dd></div>
              <div><dt>Email</dt><dd><Contact scheme="mailto:" value={d.vendor.email} /></dd></div>
              <div className="wide"><dt>Address</dt><dd>{d.vendor.address || '—'}</dd></div>
              {d.vendor.note && <div className="wide"><dt>Remarks</dt><dd>{d.vendor.note}</dd></div>}
            </dl>
          </section>
          {canEdit && (
            <div className="vd-acts">
              <button type="button" className="a-btn sm grad" onClick={() => setPay(true)}>Pay vendor</button>
              <span className="vd-sp" />
              <IconBtn icon="edit" tone="pri" title="Edit this vendor" onClick={() => setEdit(true)} />
              <IconBtn icon="trash" tone="bad" title="Delete this vendor" onClick={remove} />
            </div>
          )}
          <section className="vd-card">
            <header className="iv-lhd"><b>Account statement</b><span>{d.items.length} entr{d.items.length === 1 ? 'y' : 'ies'}</span></header>
            <div className="vd-led">
              <div className="vd-lrow head"><span>Date</span><span>Entry</span><span>Bill</span><span>Paid / returned</span><span>Balance</span></div>
              {!!d.opening && <div className="vd-lrow"><span>—</span><span><b>Opening balance</b></span><span>{taka(d.opening)}</span><span /><b>{taka(d.opening)}</b></div>}
              {d.items.map(r => <div key={r.ref} className="vd-lrow"><span>{fDate(r.d)}</span><span><b>{r.type}</b> <span className="mono">{r.ref}</span><small>{r.text}</small></span><span>{r.credit ? taka(r.credit) : ''}</span><span className="pd">{r.debit ? taka(r.debit) : ''}</span><b>{taka(r.balance)}</b></div>)}
              {!d.items.length && !d.opening && <div className="iv-lempty">No purchases or payments yet.</div>}
            </div>
          </section>
        </>
      )}
      {pay && <PayForm vendors={vendors} vendor={id} onClose={() => setPay(false)} onSaved={after} />}
      {edit && d && <VendorForm vendor={{ ...d.vendor, opening: d.opening }} onClose={() => setEdit(false)} onSaved={after} />}
    </Drawer>
  );
}
