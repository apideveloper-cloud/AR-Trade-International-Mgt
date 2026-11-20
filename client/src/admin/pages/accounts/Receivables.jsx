import { useState } from 'react';
import { fld, slNo, useTable } from '../../adminApi.js';
import { ListFilter } from '../../ListFilter.jsx';
import { Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { Av, Chip, Notice, fDate, taka } from '../../fieldKit.jsx';
import { CsvButton, Tbl } from './shared.jsx';

/** Age of the oldest invoice the customer still owes on (a paid invoice is not a receivable), or a dash when nothing is owed. */
const oldest = c => { const ages = c.invoices.filter(x => x.due > 0).map(x => x.ageDays); return ages.length ? `${Math.max(...ages)} days` : '—'; };

export function AccReceivables() {
  const t = useTable('/payments/customers', { size: 25 }, [], fld);
  const [open, setOpen] = useState(null);
  const list = t.data.rows, s = t.data.summary || {};
  return (
    <>
      <Summary items={[
        ['Customers owing', t.data.withDue ?? '…', 'with open invoices', 'blue', 'users'],
        ['Total receivable', taka(s.due), `${s.invoices || 0} invoices`, 'red', 'money'],
        ['Over 30 days', taka(s.over30), 'chase these first', 'amber', 'alert'],
        ['0 to 15 days', taka(s.fresh), 'still fresh', 'green', 'check']
      ]} />
      <Notice err={t.error} onRetry={t.reload} />
      <ListFilter t={t} noun="customer" title="Search receivables" search={{ placeholder: 'Customer, area, phone or contact' }}
        selects={[{ key: 'due', label: 'Balance', all: 'All customers', icon: 'card', options: [{ v: '1', t: 'Still owing' }] }]} range={{ label: 'Invoice date' }} />
      <Toolbar t={t} search={false}>
        <CsvButton t={t} path="/payments/customers" name="receivables.csv" head={['Customer', 'Invoice', 'Order', 'Date', 'Total', 'Paid', 'Due', 'Age (days)']}
          line={c => c.invoices.map(i => [c.name, i.id, i.orderRef, fDate(i.date), i.total, i.paid, i.due, i.ageDays])} />
      </Toolbar>
      <section className="a-card">
        <Tbl t={t} cols="44px minmax(220px,2fr) 150px 130px 130px 130px" head={['SL', 'Customer', 'Phone', 'Invoices', 'Oldest', 'Due']} onRow={c => setOpen(open === c.id ? null : c.id)}
          rows={list.flatMap((c, i) => [{ key: c.id, item: c, cells: [slNo(t, i), <span className="fd-who" key="n"><Av name={c.name} /><span><b>{c.name}</b><small>{[c.contact, c.area].filter(Boolean).join(' · ')}</small></span></span>, c.phone || '—', c.invoices.length, oldest(c), <b key="d" style={{ color: '#b3261e' }}>{taka(c.due)}</b>] },
            ...(open === c.id ? [{ key: c.id + 'x', item: null, full: true, cells: [<div key="x" className="fd-sub-row">{c.invoices.map(v => <div key={v.id}><span><b>{v.id}</b> · {v.orderRef} · {fDate(v.date)}</span><em>paid {taka(v.paid)} of {taka(v.total)}</em><b>{taka(v.due)} <Chip tone={v.ageDays > 30 ? 'bad' : v.ageDays > 15 ? 'amber' : 'ok'}>{v.ageDays}d</Chip></b></div>)}</div>] }] : [])])} />
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}
