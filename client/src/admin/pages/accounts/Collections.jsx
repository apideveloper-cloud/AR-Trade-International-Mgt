import { fld, slNo, useTable } from '../../adminApi.js';
import { HBars } from '../../charts.jsx';
import { ListFilter, periodOf } from '../../ListFilter.jsx';
import { Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { Chip, Notice, fDateTime, taka, toneOf } from '../../fieldKit.jsx';
import { CsvButton, Tbl } from './shared.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

export function AccCollections() {
  const tr = useT();
  const t = useTable('/reports/collection', { size: 25, method: '', status: '', ...periodOf('month') }, [], fld);
  const data = t.data;
  return (
    <>
      <Summary items={[
        [tr('Collected'), taka(data.collected), data.label ? tr(data.label) : '', 'green', 'money'],
        [tr('Receipts'), data.count ?? '…', tr('money receipts'), 'blue', 'check'],
        [tr('Still owed'), taka(data.dues?.total), tr('all unpaid invoices'), 'red', 'clock']
      ]} />
      <Notice err={t.error && tr(t.error)} onRetry={t.reload} />
      <div className="fd-two">
        <section className="a-card"><div className="card-hd"><h3>{tr('By method')}</h3></div>{(data.methods || []).length ? <HBars rows={data.methods.map(x => ({ label: tr(x.label), value: x.amount, text: taka(x.amount), sub: x.pct + '%' }))} hue={150} inline /> : <div className="a-empty">{tr('No receipts in this period.')}</div>}</section>
        <section className="a-card"><div className="card-hd"><h3>{tr('Unpaid by age')}</h3></div>{(data.dues?.aging || []).length ? <HBars rows={data.dues.aging.map(x => ({ label: tr(x.label), value: x.amount, text: taka(x.amount) }))} hue={20} /> : null}</section>
      </div>
      <ListFilter t={t} noun="receipt" title="Search collections" search={{ placeholder: 'Receipt, customer, invoice or reference' }} range={{ label: 'Receipt date', def: 'month' }}
        selects={[{ key: 'method', label: 'Method', all: 'All methods', icon: 'card', options: ['Cash', 'bKash', 'Cheque', 'Bank'] },
          { key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: [{ v: 'Received', t: 'Received' }, { v: 'ChequePending', t: 'Cheque pending' }, { v: 'Bounced', t: 'Bounced' }] }]} />
      <Toolbar t={t} search={false}>
        <CsvButton t={t} path="/reports/collection" name="collections.csv" head={['Receipt', 'Date', 'Customer', 'Invoices', 'Method', 'Collected by', 'Amount', 'Status']}
          line={i => [[i.id, fDateTime(i.date), i.customer, i.invoices, i.method, i.who, i.amount, i.status]]} />
      </Toolbar>
      <section className="a-card">
        <Tbl t={t} cols="44px 110px minmax(200px,2fr) minmax(140px,1fr) 100px 150px 120px 120px" head={['SL', 'Receipt', 'Customer', 'Invoices', 'Method', 'Collected by', 'Status', 'Amount']}
          rows={t.data.rows.map((i, k) => ({ key: i.id, cells: [slNo(t, k), <b key="i" className="mono">{i.id}</b>, <span key="c"><b>{i.customer}</b><small style={{ display: 'block', color: '#6b7388' }}>{fDateTime(i.date)}</small></span>, i.invoices, tr(i.method), i.who, <Chip key="s" tone={toneOf(i.status)}>{tr(i.status)}</Chip>, <b key="a">{taka(i.amount)}</b>] }))} />
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}
