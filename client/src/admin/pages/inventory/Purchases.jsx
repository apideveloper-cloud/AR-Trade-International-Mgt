import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Chip, Grid, Notice, fDate, taka } from '../../fieldKit.jsx';
import { useInv } from './kit/useInv.js';
import { CsvButton, exportCsv } from './kit/csvExport.jsx';
import { AddBtn, vendorOptions } from './kit/invKit.jsx';
import { Stage } from './purchases/Stage.jsx';
import { ReceiveForm } from './purchases/ReceiveForm.jsx';
import { ReceiptDrawer } from './purchases/ReceiptDrawer.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/inventory.js';

const STAGE_OPTIONS = [{ v: 'Pending', t: 'Waiting approval' }, { v: 'Approved', t: 'Approved, to stock in' }, { v: 'Stocked', t: 'In stock' }, { v: 'Rejected', t: 'Rejected' }];

/** The Due cell: a dash until billed, then the amount due or Paid. */
function DueCell({ x }) {
  const tr = useT();
  return x.status === 'Pending' || x.status === 'Rejected' ? '—' : x.due ? <Chip tone="bad">{taka(x.due)}</Chip> : <Chip tone="ok">{tr('Paid')}</Chip>;
}

/** Purchases page: summary, filters, the purchase grid, the add form and the purchase drawer. */
export function InvPurchases({ staff }) {
  const tr = useT();
  const t = useTable('/receipts', { q: '', vendor: '', stage: '', status: '', from: '', to: '', min: '', max: '' }, [], invApi);
  const vl = useInv('/vendors'); const vendors = vl.data?.items || [];
  const [open, setOpen] = useState(null); const [add, setAdd] = useState(false);
  const canEdit = can(staff, 'inventory.manage'); const canApprove = can(staff, 'inventory.approve');
  const m = t.data.totals || {};
  const download = () => exportCsv('/receipts', t.params, 'purchases.csv', ['Purchase', 'Date', 'Vendor', 'Vendor invoice no.', 'Reference no.', 'Qty', 'Total', 'Paid', 'Due'], x => [x.id, x.date, x.vendor, x.invoiceNo, x.referenceNo, x.pcs, x.total, x.paid, x.due], tr);
  return (
    <>
      <Summary items={[
        [tr('Purchases'), m.bills ?? '…', tr('matching your filters'), 'blue', 'cart'],
        [tr('Bought'), taka(m.total), tr('value of these bills'), 'violet', 'box'],
        [tr('Unpaid'), taka(m.due), tr(m.dueCount === 1 ? '{n} bill with a balance' : '{n} bills with a balance', { n: m.dueCount ?? 0 }), 'amber', 'clock'],
        [tr('Needs action'), (m.pending ?? 0) + (m.approved ?? 0), tr('{a} to approve · {b} to stock in', { a: m.pending ?? 0, b: m.approved ?? 0 }), 'green', 'check']
      ]} />
      <ListFilter t={t} noun="purchase" title="Search purchases" search={{ placeholder: 'Purchase no., invoice or reference no., vendor or PO' }}
        selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }, { key: 'stage', label: 'Stage', all: 'Every stage', icon: 'status', options: STAGE_OPTIONS }, { key: 'status', label: 'Payment', all: 'Paid & unpaid', icon: 'card', options: [{ v: 'due', t: 'Unpaid' }, { v: 'paid', t: 'Paid' }] }]}
        range={{ label: 'Received' }} amount={{ label: 'Bill total' }} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error && tr(t.error)} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>{tr('Purchases')}</h3><small className="fd-sub">{tr("Add → approve → stock in. Stock and the vendor's account change only after approval")}</small></div>
          <div className="bk-acts"><CsvButton onClick={download} disabled={!t.data.total} />{canEdit && <AddBtn onClick={() => setAdd(true)}>{tr('＋ Add purchase')}</AddBtn>}</div></div>
        <Grid server={t} cols="44px 100px minmax(170px,1.4fr) 100px 110px 60px 110px 130px 110px" head={['SL', 'Purchase', 'Vendor', 'Date', 'Invoice', 'Qty', 'Total', 'Stage', 'Due'].map(h => tr(h))} onRow={x => setOpen(x.id)} empty={tr('No purchase matches. Press Add purchase when goods are bought.')}
          rows={t.data.rows.map((x, i) => ({ key: x.id, item: x, cells: [slNo(t, i), <b key="i" className="mono">{x.id}</b>, x.vendor, fDate(x.date), <span key="inv" className="pu-inv"><span className="mono">{x.invoiceNo || '—'}</span>{x.referenceNo && <small>{tr('Ref {n}', { n: x.referenceNo })}</small>}</span>, x.pcs, taka(x.total), <Stage key="s" s={x.status} />, <DueCell key="d" x={x} />] }))} />
      </section>
      {open && <ReceiptDrawer id={open} canEdit={canEdit} canApprove={canApprove} vendors={vendors} onClose={() => setOpen(null)} onChanged={t.reload} />}
      {add && <ReceiveForm vendors={vendors} onVendorAdded={vl.reload} onClose={() => setAdd(false)} onSaved={t.reload} />}
    </>
  );
}
