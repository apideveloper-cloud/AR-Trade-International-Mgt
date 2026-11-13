import { fld, slNo, useTable } from '../../adminApi.js';
import { HBars } from '../../charts.jsx';
import { ListFilter, periodOf } from '../../ListFilter.jsx';
import { Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { Chip, Notice, fDate, taka, toneOf } from '../../fieldKit.jsx';
import { CsvButton, Tbl } from './shared.jsx';

export function AccExpenses() {
  const t = useTable('/reports/expense', { size: 25, category: '', status: '', ...periodOf('month') }, [], fld);
  const data = t.data;
  const split = Object.fromEntries((data.split || []).map(s => [s.label, s]));
  return (
    <>
      <Summary items={[
        ['Total claimed', taka(data.claimed), `${data.count ?? 0} claims · ${data.month || ''}`, 'amber', 'money'],
        ['Approved', taka(split.Approved?.amount), `${split.Approved?.count || 0} claims`, 'green', 'check'],
        ['Waiting', taka(split.Pending?.amount), `${split.Pending?.count || 0} claims`, 'blue', 'clock'],
        ['Rejected', taka(split.Rejected?.amount), `${split.Rejected?.count || 0} claims`, 'red', 'alert']
      ]} />
      <Notice err={t.error} onRetry={t.reload} />
      <section className="a-card"><div className="card-hd"><h3>By category</h3></div>{(data.categories || []).length ? <HBars rows={data.categories.map(c => ({ label: c.name, value: c.amount, text: taka(c.amount), sub: c.count + ' claims' }))} hue={60} inline /> : <div className="a-empty">No claims.</div>}</section>
      <ListFilter t={t} noun="claim" title="Search expenses" search={{ placeholder: 'Staff, description or category' }} range={{ label: 'Claim date', def: 'month' }}
        selects={[{ key: 'category', label: 'Category', all: 'All categories', icon: 'tag', options: ['Fuel', 'Food', 'Transport', 'Mobile', 'Courier', 'Other'] },
          { key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: [{ v: 'approved', t: 'Approved' }, { v: 'pending', t: 'Pending' }, { v: 'rejected', t: 'Rejected' }] }]} />
      <Toolbar t={t} search={false}>
        <span className="fd-sub">Decide waiting claims in <b>Approvals</b>.</span>
        <CsvButton t={t} path="/reports/expense" name="expenses.csv" head={['Date', 'Staff', 'Description', 'Category', 'Amount', 'Status']} line={i => [[fDate(i.date), i.who, i.title, i.category, i.amount, i.status]]} />
      </Toolbar>
      <section className="a-card">
        <Tbl t={t} cols="44px 120px 170px minmax(220px,2fr) 120px 110px 120px" head={['SL', 'Date', 'Staff', 'Description', 'Category', 'Status', 'Amount']}
          rows={data.rows.map((i, k) => ({ key: i.id, cells: [slNo(t, k), fDate(i.date), i.who, <span key="t">{i.title}{i.voucher ? ' 📎' : ''}</span>, i.category, <Chip key="s" tone={toneOf(i.status)}>{i.status}</Chip>, <b key="a">{taka(i.amount)}</b>] }))} />
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}
