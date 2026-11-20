import { fld, slNo, useTable } from '../../adminApi.js';
import { HBars } from '../../charts.jsx';
import { ListFilter, periodOf } from '../../ListFilter.jsx';
import { Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { Chip, Notice, fDate, taka, toneOf } from '../../fieldKit.jsx';
import { CsvButton, Tbl } from './shared.jsx';
import { Rich } from '../growth/parts.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

export function AccExpenses() {
  const tr = useT();
  const t = useTable('/reports/expense', { size: 25, category: '', status: '', ...periodOf('month') }, [], fld);
  const data = t.data;
  const split = Object.fromEntries((data.split || []).map(s => [s.label, s]));
  return (
    <>
      <Summary items={[
        [tr('Total claimed'), taka(data.claimed), `${tr('{n} claims', { n: data.count ?? 0 })} · ${data.month || ''}`, 'amber', 'money'],
        [tr('Approved'), taka(split.Approved?.amount), tr('{n} claims', { n: split.Approved?.count || 0 }), 'green', 'check'],
        [tr('Waiting'), taka(split.Pending?.amount), tr('{n} claims', { n: split.Pending?.count || 0 }), 'blue', 'clock'],
        [tr('Rejected'), taka(split.Rejected?.amount), tr('{n} claims', { n: split.Rejected?.count || 0 }), 'red', 'alert']
      ]} />
      <Notice err={t.error && tr(t.error)} onRetry={t.reload} />
      <section className="a-card"><div className="card-hd"><h3>{tr('By category')}</h3></div>{(data.categories || []).length ? <HBars rows={data.categories.map(c => ({ label: tr(c.name), value: c.amount, text: taka(c.amount), sub: tr('{n} claims', { n: c.count }) }))} hue={60} inline /> : <div className="a-empty">{tr('No claims.')}</div>}</section>
      <ListFilter t={t} noun="claim" title="Search expenses" search={{ placeholder: 'Staff, description or category' }} range={{ label: 'Claim date', def: 'month' }}
        selects={[{ key: 'category', label: 'Category', all: 'All categories', icon: 'tag', options: ['Fuel', 'Food', 'Transport', 'Mobile', 'Courier', 'Other'] },
          { key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: [{ v: 'approved', t: 'Approved' }, { v: 'pending', t: 'Pending' }, { v: 'rejected', t: 'Rejected' }] }]} />
      <Toolbar t={t} search={false}>
        <span className="fd-sub"><Rich text={tr('Decide waiting claims in <b>Approvals</b>.')} /></span>
        <CsvButton t={t} path="/reports/expense" name="expenses.csv" head={['Date', 'Staff', 'Description', 'Category', 'Amount', 'Status']} line={i => [[fDate(i.date), i.who, i.title, i.category, i.amount, i.status]]} />
      </Toolbar>
      <section className="a-card">
        <Tbl t={t} cols="44px 120px 170px minmax(220px,2fr) 120px 110px 120px" head={['SL', 'Date', 'Staff', 'Description', 'Category', 'Status', 'Amount']}
          rows={data.rows.map((i, k) => ({ key: i.id, cells: [slNo(t, k), fDate(i.date), i.who, <span key="t">{i.title}{i.voucher ? ' 📎' : ''}</span>, tr(i.category), <Chip key="s" tone={toneOf(i.status)}>{tr(i.status)}</Chip>, <b key="a">{taka(i.amount)}</b>] }))} />
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}
