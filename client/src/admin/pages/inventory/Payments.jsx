import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Summary, Toolbar, alertBox, confirmBox } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Chip, Grid, Notice, Tabs, fDate, taka } from '../../fieldKit.jsx';
import { useInv, AddBtn, PayForm, useVendors, exportCsv, CsvButton, vendorOptions, METHODS } from './shared.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/inventory.js';

/** Vendor payments page: payments made and the bills still to pay. */
export function InvPayments({ staff }) {
  const tr = useT();
  const [tab, setTab] = useState('payments');
  const p = useTable('/payments', { q: '', vendor: '', method: '', from: '', to: '', min: '', max: '' }, [], invApi);
  const b = useTable('/receipts', { status: 'due', q: '', vendor: '', from: '', to: '', min: '', max: '' }, [], invApi); // bills still to be paid
  const s = useInv('/summary'); const vendors = useVendors();
  const [pay, setPay] = useState(null);
  const canEdit = can(staff, 'inventory.manage');
  const reload = () => { p.reload(); b.reload(); s.reload(); };
  const t = tab === 'payments' ? p : b;
  const undo = async x => {
    if (!(await confirmBox(tr('Remove payment {id} of {a}? Only payments made in the last 24 hours can be removed.', { id: x.id, a: taka(x.amount) }), { danger: true, confirmLabel: tr('Remove') }))) return;
    try { await invApi.del('/payments/' + x.id); reload(); } catch (e) { alertBox(tr(e.message)); }
  };
  const download = () => exportCsv('/payments', p.params, 'vendor-payments.csv', ['Payment', 'Date', 'Vendor', 'Method', 'Reference', 'Purchase', 'Amount'], r => [r.id, r.date, r.vendor, r.method, r.reference, r.receiptId, r.amount], tr);
  return (
    <>
      <Summary items={[
        [tr('We owe vendors'), taka(s.data?.payable), tr('{n} vendors', { n: s.data?.owedCount ?? 0 }), 'red', 'alert'],
        [tr('Paid in this view'), taka(p.data.totals?.amount), tr(p.data.total === 1 ? '{n} payment' : '{n} payments', { n: p.data.total }), 'green', 'check'],
        [tr('Bills to pay'), b.data.total, tr('{a} still due', { a: taka(b.data.totals?.due) }), 'amber', 'clock'],
        [tr('Paid this month'), taka(s.data?.paid), tr('to vendors'), 'blue', 'money']
      ]} />
      {tab === 'payments'
        ? <ListFilter t={p} noun="payment" title="Search vendor payments" search={{ placeholder: 'Payment no., vendor, reference or purchase' }} selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }, { key: 'method', label: 'Method', all: 'All methods', icon: 'card', options: METHODS }]} range={{ label: 'Paid' }} amount={{ label: 'Amount' }} />
        : <ListFilter t={b} noun="bill" title="Search bills to pay" search={{ placeholder: 'Purchase no., invoice or vendor' }} selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }]} range={{ label: 'Received' }} amount={{ label: 'Bill total' }} />}
      <Toolbar t={t} search={false} />
      <Notice err={(p.error || b.error) && tr(p.error || b.error)} />
      <section className="a-card">
        <div className="card-hd"><div><h3>{tr('Vendor payments')}</h3><small className="fd-sub">{tr('Money paid to vendors and suppliers')}</small></div>
          <div className="bk-acts"><CsvButton onClick={download} disabled={!p.data.total} />{canEdit && <AddBtn onClick={() => setPay({})}>{tr('＋ Pay vendor')}</AddBtn>}</div></div>
        <Tabs value={tab} onChange={setTab} items={[['payments', tr('Payments'), p.data.total], ['due', tr('Bills to pay'), b.data.total]]} />
        {tab === 'payments' ? (
          <Grid server={p} cols="44px 100px 120px minmax(180px,1.5fr) 120px minmax(120px,1fr) 110px 120px 60px" head={['SL', 'Payment', 'Date', 'Vendor', 'Method', 'Reference', 'Bill', 'Amount', ''].map(h => tr(h))} empty={tr('No payment matches.')}
            rows={p.data.rows.map((x, i) => ({ key: x.id, cells: [slNo(p, i), <b key="i" className="mono">{x.id}</b>, fDate(x.date), x.vendor, tr(x.method), x.reference || '—', x.receiptId || tr('On account'), <b key="a">{taka(x.amount)}</b>, canEdit ? <button key="u" type="button" className="a-mini bk-del" title={tr('Remove (within 24 hours)')} onClick={() => undo(x)}>✕</button> : ''] }))} />
        ) : (
          <Grid server={b} cols="44px 100px minmax(180px,1.5fr) 120px 120px 120px 120px 100px" head={['SL', 'Purchase', 'Vendor', 'Date', 'Total', 'Paid', 'Due', ''].map(h => tr(h))} empty={tr('No unpaid bill matches. Everything is settled.')}
            rows={b.data.rows.map((x, i) => ({ key: x.id, cells: [slNo(b, i), <b key="i" className="mono">{x.id}</b>, x.vendor, fDate(x.date), taka(x.total), taka(x.paid), <Chip key="d" tone="bad">{taka(x.due)}</Chip>, canEdit ? <button key="p" type="button" className="a-mini ok" onClick={() => setPay({ vendor: String(x.vendorId), receipt: x.id, due: x.due })}>{tr('Pay')}</button> : ''] }))} />
        )}
      </section>
      {pay && <PayForm vendors={vendors} vendor={pay.vendor} receipt={pay.receipt} due={pay.due} onClose={() => setPay(null)} onSaved={reload} />}
    </>
  );
}
