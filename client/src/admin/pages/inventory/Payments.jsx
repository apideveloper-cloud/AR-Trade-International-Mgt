import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Summary, Toolbar, alertBox, confirmBox } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Chip, Grid, Notice, Tabs, fDate, taka } from '../../fieldKit.jsx';
import { useInv, AddBtn, PayForm, useVendors, exportCsv, CsvButton, vendorOptions, METHODS } from './shared.jsx';

/** Vendor payments page: payments made and the bills still to pay. */
export function InvPayments({ staff }) {
  const [tab, setTab] = useState('payments');
  const p = useTable('/payments', { q: '', vendor: '', method: '', from: '', to: '', min: '', max: '' }, [], invApi);
  const b = useTable('/receipts', { status: 'due', q: '', vendor: '', from: '', to: '', min: '', max: '' }, [], invApi); // bills still to be paid
  const s = useInv('/summary'); const vendors = useVendors();
  const [pay, setPay] = useState(null);
  const canEdit = can(staff, 'inventory.manage');
  const reload = () => { p.reload(); b.reload(); s.reload(); };
  const t = tab === 'payments' ? p : b;
  const undo = async x => {
    if (!(await confirmBox(`Remove payment ${x.id} of ${taka(x.amount)}? Only payments made in the last 24 hours can be removed.`, { danger: true, confirmLabel: 'Remove' }))) return;
    try { await invApi.del('/payments/' + x.id); reload(); } catch (e) { alertBox(e.message); }
  };
  const download = () => exportCsv('/payments', p.params, 'vendor-payments.csv', ['Payment', 'Date', 'Vendor', 'Method', 'Reference', 'Purchase', 'Amount'], r => [r.id, r.date, r.vendor, r.method, r.reference, r.receiptId, r.amount]);
  return (
    <>
      <Summary items={[
        ['We owe vendors', taka(s.data?.payable), `${s.data?.owedCount ?? 0} vendors`, 'red', 'alert'],
        ['Paid in this view', taka(p.data.totals?.amount), `${p.data.total} payment${p.data.total === 1 ? '' : 's'}`, 'green', 'check'],
        ['Bills to pay', b.data.total, taka(b.data.totals?.due) + ' still due', 'amber', 'clock'],
        ['Paid this month', taka(s.data?.paid), 'to vendors', 'blue', 'money']
      ]} />
      {tab === 'payments'
        ? <ListFilter t={p} noun="payment" title="Search vendor payments" search={{ placeholder: 'Payment no., vendor, reference or purchase' }} selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }, { key: 'method', label: 'Method', all: 'All methods', icon: 'card', options: METHODS }]} range={{ label: 'Paid' }} amount={{ label: 'Amount' }} />
        : <ListFilter t={b} noun="bill" title="Search bills to pay" search={{ placeholder: 'Purchase no., invoice or vendor' }} selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }]} range={{ label: 'Received' }} amount={{ label: 'Bill total' }} />}
      <Toolbar t={t} search={false} />
      <Notice err={p.error || b.error} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Vendor payments</h3><small className="fd-sub">Money paid to vendors and suppliers</small></div>
          <div className="bk-acts"><CsvButton onClick={download} disabled={!p.data.total} />{canEdit && <AddBtn onClick={() => setPay({})}>＋ Pay vendor</AddBtn>}</div></div>
        <Tabs value={tab} onChange={setTab} items={[['payments', 'Payments', p.data.total], ['due', 'Bills to pay', b.data.total]]} />
        {tab === 'payments' ? (
          <Grid server={p} cols="44px 100px 120px minmax(180px,1.5fr) 120px minmax(120px,1fr) 110px 120px 60px" head={['SL', 'Payment', 'Date', 'Vendor', 'Method', 'Reference', 'Bill', 'Amount', '']} empty="No payment matches."
            rows={p.data.rows.map((x, i) => ({ key: x.id, cells: [slNo(p, i), <b key="i" className="mono">{x.id}</b>, fDate(x.date), x.vendor, x.method, x.reference || '—', x.receiptId || 'On account', <b key="a">{taka(x.amount)}</b>, canEdit ? <button key="u" type="button" className="a-mini bk-del" title="Remove (within 24 hours)" onClick={() => undo(x)}>✕</button> : ''] }))} />
        ) : (
          <Grid server={b} cols="44px 100px minmax(180px,1.5fr) 120px 120px 120px 120px 100px" head={['SL', 'Purchase', 'Vendor', 'Date', 'Total', 'Paid', 'Due', '']} empty="No unpaid bill matches. Everything is settled."
            rows={b.data.rows.map((x, i) => ({ key: x.id, cells: [slNo(b, i), <b key="i" className="mono">{x.id}</b>, x.vendor, fDate(x.date), taka(x.total), taka(x.paid), <Chip key="d" tone="bad">{taka(x.due)}</Chip>, canEdit ? <button key="p" type="button" className="a-mini ok" onClick={() => setPay({ vendor: String(x.vendorId), receipt: x.id, due: x.due })}>Pay</button> : ''] }))} />
        )}
      </section>
      {pay && <PayForm vendors={vendors} vendor={pay.vendor} receipt={pay.receipt} due={pay.due} onClose={() => setPay(null)} onSaved={reload} />}
    </>
  );
}
