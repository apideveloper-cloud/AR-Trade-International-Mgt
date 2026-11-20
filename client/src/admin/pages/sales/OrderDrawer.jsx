import { useState } from 'react';
import { adm, can, dateTimeF } from '../../adminApi.js';
import { Drawer, confirmBox } from '../../ui.jsx';
import { PdfPreview } from '../../fieldKit.jsx';
import { StatusDialog } from './StatusDialog.jsx';
import { useStaff } from './staffContext.js';
import { useOrder } from './useOrder.js';
import { OrderHero } from './OrderHero.jsx';
import { OrderProgress } from './OrderProgress.jsx';
import { InvoiceBar } from './InvoiceBar.jsx';
import { InvoiceVatCard } from './InvoiceVatCard.jsx';
import { ContactCard } from './ContactCard.jsx';
import { ItemsCard } from './ItemsCard.jsx';
import { OrderTimeline } from './OrderTimeline.jsx';
import { EmailInvoiceModal } from './EmailInvoiceModal.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';
import './salesInline.css';

/** Order details panel: summary, progress tracker with required remarks, invoice actions, contact, items and the timeline with comments.
 *  `canEdit` (VAT, status, cancel) defaults to the signed-in role's `orders.status` permission, or true when no session is provided. */
export function OrderDrawer({ id, ...rest }) {
  return <OrderDrawerBody key={id} id={id} {...rest} />; // a new id starts with fresh state (dialogs, comment draft, VAT text)
}

function OrderDrawerBody({ id, onClose, onChanged, canDelete, riderOnly, canEdit }) {
  const tr = useT();
  const staff = useStaff();
  const editable = canEdit ?? (staff ? can(staff, 'orders.status') : true);
  const { o, err, setO, setErr, reload } = useOrder(id);
  const [mail, setMail] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [chg, setChg] = useState(null); // the status being moved to: the remarks dialog is open while this is set
  const docOrder = o ? (o.status === 'Pending' || o.status === 'Cancelled') : true; // Sales order until the order is confirmed, then Sales invoice
  const docNo = (docOrder ? 'SO-' : 'INV-') + id.replace(/^\D+/, '');
  const setStatus = status => { if (editable && o && o.status !== status) setChg(status); };
  const del = async () => {
    if (!(await confirmBox(tr('Delete order {id}? This cannot be undone.', { id }), { danger: true, confirmLabel: tr('Delete order') }))) return;
    try { await adm.del('/orders/' + id); onChanged(); onClose(); } catch (x) { setErr(tr(x.message)); }
  };
  return (
    <>
    {showPdf && <PdfPreview url={`/api/admin/orders/${id}/invoice.pdf`} title={docNo} filename={docNo + '.pdf'} onClose={() => setShowPdf(false)} />}
    <Drawer title={id} sub={o ? dateTimeF(o.date) : ''} onClose={onClose}>
      {err && <div className="a-msg err">{tr(err)}</div>}
      {!o ? (err ? null : <span className="spin" />) : (
        <>
          <OrderHero o={o} />
          <OrderProgress o={o} riderOnly={riderOnly} canEdit={editable} onPick={setStatus} />
          {!riderOnly && <InvoiceBar id={id} o={o} docNo={docNo} docOrder={docOrder} onPdf={() => setShowPdf(true)} onEmail={() => setMail(true)} onError={setErr} />}
          {!riderOnly && editable && <InvoiceVatCard id={id} o={o} setO={setO} onChanged={onChanged} />}
          {o.hold && <div className="od-hold">⏸ {o.holdNote}</div>}
          <ContactCard o={o} />
          <ItemsCard o={o} />
          <OrderTimeline id={id} o={o} setO={setO} />
          {canDelete && o.status === 'Cancelled' && <button onClick={del} className="sinl-del">{tr('Delete order')}</button>}
        </>
      )}
      {chg && o && <StatusDialog id={id} from={o.status} to={chg} onClose={() => setChg(null)} onSaved={x => { setO(x); onChanged(); setChg(null); }} />}
      {mail && o && <EmailInvoiceModal id={id} o={o} docNo={docNo} docOrder={docOrder} onClose={() => setMail(false)} onSent={() => { onChanged(); reload(); }} />}
    </Drawer>
    </>
  );
}
