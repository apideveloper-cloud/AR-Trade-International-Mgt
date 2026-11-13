// Quotations: price offers to customers. Write one, send its PDF, then mark it Sent / Accepted / Rejected.
import { useState } from 'react';
import { can, quoteApi, slNo, useTable } from '../adminApi.js';
import { Summary, Toolbar } from '../ui.jsx';
import { ListFilter } from '../ListFilter.jsx';
import { Chip, Grid, Notice, PdfButton, fDate, taka } from '../fieldKit.jsx';
import { QuoteDrawer } from './quotes/QuoteDrawer.jsx';
import { QuoteForm } from './quotes/QuoteForm.jsx';
import { QuotePreview } from './quotes/QuoteMail.jsx';
import { CUSTOMER_KINDS, STATUSES, Status } from './quotes/shared.jsx';
import '../field.css';
import './inventory/inventory.css';
import './quotations.css';

export function Quotations({ staff }) {
  const t = useTable('/', { q: '', status: '', ctype: '', from: '', to: '', min: '', max: '' }, [], quoteApi);
  const [open, setOpen] = useState(null); const [add, setAdd] = useState(false); const [pdf, setPdf] = useState(null);
  const canEdit = can(staff, 'quotes.manage');
  const m = t.data.totals || {};
  return (
    <>
      <Summary items={[
        ['Quotations', t.data.total ?? '…', 'matching your filters', 'blue', 'cart'],
        ['Quoted value', taka(m.net), 'net payable, all of these', 'violet', 'box'],
        ['Waiting for answer', (m.sent ?? 0) + (m.draft ?? 0), `${m.draft ?? 0} draft · ${m.sent ?? 0} sent`, 'amber', 'clock'],
        ['Won', taka(m.acceptedNet), `${m.accepted ?? 0} accepted`, 'green', 'check']
      ]} />
      <ListFilter t={t} noun="quotation" title="Search quotations" search={{ placeholder: 'Quotation no., customer, subject or contact' }}
        selects={[{ key: 'status', label: 'Status', all: 'Every status', icon: 'status', options: STATUSES.map(s => ({ v: s, t: s })) }, { key: 'ctype', label: 'Customer', all: 'All customers', icon: 'user', options: CUSTOMER_KINDS.map(([v, t]) => ({ v, t })) }]}
        range={{ label: 'Quotation date' }} amount={{ label: 'Net payable' }} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Quotations</h3><small className="fd-sub">Write a quotation, open its PDF to send, then record the answer</small></div>
          <div className="bk-acts">{canEdit && <button type="button" className="a-btn sm grad" onClick={() => setAdd(true)}>＋ New quotation</button>}</div></div>
        <Grid server={t} cols="44px 160px minmax(180px,1.3fr) minmax(160px,1.2fr) 110px 60px 120px 100px 44px" head={['SL', 'Quotation', 'Customer', 'Subject', 'Date', 'Items', 'Net payable', 'Status', '']} onRow={x => setOpen(x.id)} empty="No quotation matches. Press New quotation to write one."
          rows={t.data.rows.map((x, i) => ({ key: x.id, item: x, cells: [slNo(t, i), <b key="i" className="mono">{x.id}</b>, <span key="c">{x.toName}{x.custType !== 'Existing' && <Chip tone={x.custType === 'Upcoming' ? 'amber' : 'blue'}> {x.custType.toLowerCase()}</Chip>}</span>, <span key="s" className="qt-clip">{x.subject || '—'}</span>, fDate(x.date), x.items, <b key="n">{taka(x.net)}</b>, <Status key="st" s={x.status} />, <PdfButton key="p" label="" onClick={() => setPdf({ id: x.id })} />] }))} />
      </section>
      {open && <QuoteDrawer id={open} canEdit={canEdit} staff={staff} onClose={() => setOpen(null)} onChanged={t.reload} />}
      {add && <QuoteForm staff={staff} onClose={() => setAdd(false)} onSaved={t.reload} onPreview={(id, mode) => setPdf({ id, email: mode === 'email' })} />}
      {pdf && <QuotePreview id={pdf.id} startMail={pdf.email} canEdit={canEdit} onClose={() => setPdf(null)} onSent={t.reload} />}
    </>
  );
}
