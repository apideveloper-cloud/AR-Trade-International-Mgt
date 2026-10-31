import { useEffect, useState } from 'react';
import { adm, fld, slNo, useTable } from '../adminApi.js';
import { HBars } from '../charts.jsx';
import { ListFilter, periodOf } from '../ListFilter.jsx';
import { Drawer, Empty, Pager, Summary, Toolbar, alertBox } from '../ui.jsx';
import { Av, Chip, Fact, Notice, Skeleton, Tabs, downloadCsv, fDate, fDateTime, taka, toneOf, todayBd, useFld } from '../fieldKit.jsx';

// The accountant's side of the console: money owed to us, money collected, expenses, purchase orders and the reports.
// The lists are paged and filtered by the server (useTable); the "all rows" CSV downloads read every page.
const month0 = () => todayBd().slice(0, 7);

/** Every row of a server-paged list that matches the table's filters (200 per request), for the CSV downloads. */
async function allRows(path, params) {
  const out = [];
  for (let page = 1; page <= 200; page++) {
    const qs = new URLSearchParams(Object.entries({ ...params, page, size: 200 }).filter(([, v]) => v !== '' && v != null));
    const d = await fld.get(`${path}?${qs}`);
    out.push(...d.rows);
    if (out.length >= d.total || !d.rows.length) break;
  }
  return out;
}

/** The console's grid table for one page of server rows. rows = [{ key, item, cells, full }]; a full row is the detail of the row before it. */
function Tbl({ t, cols, head, rows, onRow }) {
  return (
    <div className="fd-tbl" role="table" style={{ opacity: t.loading ? 0.6 : 1 }}>
      <div className="fd-th" role="row" style={{ gridTemplateColumns: cols }}>{head.map(h => <span key={h}>{h}</span>)}</div>
      {rows.map((r, i) => (
        <div key={r.key ?? i} role="row" className={'fd-tr' + (onRow && r.item ? ' click' : '') + (r.full ? ' full' : '')} style={{ gridTemplateColumns: r.full ? '1fr' : cols }} onClick={onRow && r.item ? () => onRow(r.item) : undefined}>
          {r.cells.map((c, j) => <span key={j}>{c}</span>)}
        </div>
      ))}
    </div>
  );
}

/** "Download all matching rows as CSV" button for a useTable list. */
function CsvButton({ t, path, name, head, line, params }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { const rows = await allRows(path, params || t.params); downloadCsv(name, head, rows.flatMap(line)); } catch (e) { alertBox(e.message); }
    setBusy(false);
  };
  return <button type="button" className="a-mini" style={{ width: 'auto', flex: 'none' }} disabled={busy || !t.data.total} onClick={run}>{busy ? 'Preparing…' : '⤓ CSV'}</button>;
}

/* ---------------- overview ---------------- */
export function AccOverview({ go }) {
  const col = useFld('/reports/collection?period=month');
  const exp = useFld('/reports/expense?month=' + month0());
  const sales = useFld('/reports/summary?type=sales&period=month');
  const po = useFld('/purchase/orders');
  const ap = useFld('/approvals/summary');
  const [web, setWeb] = useState(null);
  useEffect(() => { adm.get('/overview').then(o => setWeb(o.finance || null)).catch(() => {}); }, []);
  const poOpen = (po.data?.items || []).filter(p => ['submitted', 'manager_approved'].includes(p.status));
  const poValue = poOpen.reduce((t, p) => t + p.grand, 0);
  const aging = col.data?.dues?.aging || [];
  const err = col.err || exp.err || sales.err;
  return (
    <>
      <Summary items={[
        ['Sales this month', sales.data?.kpis?.[0]?.display ?? '…', sales.data?.label || '', 'green', 'cart'],
        ['Collected', taka(col.data?.total), `${col.data?.count ?? 0} money receipts`, 'blue', 'money'],
        ['Receivable', taka(col.data?.dues?.total), 'unpaid invoices', 'red', 'clock'],
        ['Expenses', taka(exp.data?.total), `${exp.data?.count ?? 0} claims in ${exp.data?.month || ''}`, 'amber', 'tag'],
        ['Purchase to approve', taka(poValue), `${poOpen.length} purchase order${poOpen.length === 1 ? '' : 's'}`, 'violet', 'box'],
        ['Web orders to collect', web ? taka(web.unpaidV) : '—', web ? `${web.unpaidN} unpaid web orders` : 'not available for your role', 'red', 'truck']
      ]} />
      <Notice err={err} />
      <div className="fd-two">
        <section className="a-card">
          <div className="card-hd"><div><h3>Receivable by age</h3><small className="fd-sub">How long customers' invoices have been unpaid</small></div><button type="button" className="a-mini" onClick={() => go('acc-receivables')}>Open receivables →</button></div>
          {aging.length ? <HBars rows={aging.map(a => ({ label: a.label, value: a.amount, text: taka(a.amount) }))} hue={20} /> : <div className="a-empty">No unpaid invoices.</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>Collected by method</h3><small className="fd-sub">{col.data?.label}</small></div><button type="button" className="a-mini" onClick={() => go('acc-collections')}>Open collections →</button></div>
          {(col.data?.methods || []).length ? <HBars rows={col.data.methods.map(m => ({ label: m.label, value: m.amount, text: taka(m.amount), sub: m.pct + '%' }))} hue={150} inline /> : <div className="a-empty">Nothing collected yet this month.</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>Expenses by category</h3><small className="fd-sub">{exp.data?.month}</small></div><button type="button" className="a-mini" onClick={() => go('acc-expenses')}>Open expenses →</button></div>
          {(exp.data?.categories || []).length ? <HBars rows={exp.data.categories.map(c => ({ label: c.name, value: c.amount, text: taka(c.amount), sub: c.count + ' claims' }))} hue={60} inline /> : <div className="a-empty">No expenses this month.</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>Waiting for a decision</h3><small className="fd-sub">Approvals in the field app and here</small></div><button type="button" className="a-mini" onClick={() => go('field-approvals')}>Open approvals →</button></div>
          <div className="fd-chips">
            {Object.entries(ap.data?.counts || {}).map(([k, n]) => <Chip key={k} tone={n ? 'amber' : 'off'}>{n} {k === 'orders' ? 'sales orders' : k === 'purchase' ? 'purchase orders' : k}</Chip>)}
            {!ap.data && <span className="spin" />}
          </div>
          {(col.data?.items || []).slice(0, 5).map(r => <div key={r.id} className="fd-line"><span><b>{r.customer}</b><small>{r.id} · {r.method} · {fDate(r.date)}</small></span><b>{taka(r.amount)}</b></div>)}
        </section>
      </div>
    </>
  );
}

/* ---------------- receivables ---------------- */
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
          rows={list.flatMap((c, i) => [{ key: c.id, item: c, cells: [slNo(t, i), <span className="fd-who" key="n"><Av name={c.name} /><span><b>{c.name}</b><small>{[c.contact, c.area].filter(Boolean).join(' · ')}</small></span></span>, c.phone || '—', c.invoices.length, `${Math.max(...c.invoices.map(x => x.ageDays))} days`, <b key="d" style={{ color: '#b3261e' }}>{taka(c.due)}</b>] },
            ...(open === c.id ? [{ key: c.id + 'x', item: null, full: true, cells: [<div key="x" className="fd-sub-row">{c.invoices.map(v => <div key={v.id}><span><b>{v.id}</b> · {v.orderRef} · {fDate(v.date)}</span><em>paid {taka(v.paid)} of {taka(v.total)}</em><b>{taka(v.due)} <Chip tone={v.ageDays > 30 ? 'bad' : v.ageDays > 15 ? 'amber' : 'ok'}>{v.ageDays}d</Chip></b></div>)}</div>] }] : [])])} />
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}

/* ---------------- collections ---------------- */
export function AccCollections() {
  const t = useTable('/reports/collection', { size: 25, method: '', status: '', ...periodOf('month') }, [], fld);
  const data = t.data;
  return (
    <>
      <Summary items={[
        ['Collected', taka(data.collected), data.label || '', 'green', 'money'],
        ['Receipts', data.count ?? '…', 'money receipts', 'blue', 'check'],
        ['Still owed', taka(data.dues?.total), 'all unpaid invoices', 'red', 'clock']
      ]} />
      <Notice err={t.error} onRetry={t.reload} />
      <div className="fd-two">
        <section className="a-card"><div className="card-hd"><h3>By method</h3></div>{(data.methods || []).length ? <HBars rows={data.methods.map(x => ({ label: x.label, value: x.amount, text: taka(x.amount), sub: x.pct + '%' }))} hue={150} inline /> : <div className="a-empty">No receipts in this period.</div>}</section>
        <section className="a-card"><div className="card-hd"><h3>Unpaid by age</h3></div>{(data.dues?.aging || []).length ? <HBars rows={data.dues.aging.map(x => ({ label: x.label, value: x.amount, text: taka(x.amount) }))} hue={20} /> : null}</section>
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
          rows={t.data.rows.map((i, k) => ({ key: i.id, cells: [slNo(t, k), <b key="i" className="mono">{i.id}</b>, <span key="c"><b>{i.customer}</b><small style={{ display: 'block', color: '#6b7388' }}>{fDateTime(i.date)}</small></span>, i.invoices, i.method, i.who, <Chip key="s" tone={toneOf(i.status)}>{i.status}</Chip>, <b key="a">{taka(i.amount)}</b>] }))} />
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}

/* ---------------- expenses ---------------- */
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

/* ---------------- purchase ---------------- */
const PO_STATUS = [{ v: 'draft', t: 'Draft' }, { v: 'submitted', t: 'Submitted' }, { v: 'manager_approved', t: 'Manager approved' }, { v: 'approved', t: 'Approved' }, { v: 'rejected', t: 'Rejected' }];

export function AccPurchase() {
  const [tab, setTab] = useState('orders');
  const po = useTable('/purchase/orders', { size: 25, status: '' }, [], fld);
  const pr = useFld(tab === 'requests' ? '/purchase/requests' : null);
  const vd = useFld(tab === 'vendors' ? '/purchase/vendors' : null);
  const [open, setOpen] = useState(null);
  const det = useFld(open ? '/purchase/orders/' + open : null);
  const [msg, setMsg] = useState('');
  const [rej, setRej] = useState('');
  const [reject, setReject] = useState(false);
  const by = po.data.summary?.by || {};
  const sum = s => by[s]?.grand || 0;
  const d = det.data;
  const decide = async status => {
    setMsg('');
    try { await fld.put(`/approvals/purchase/${open}/decision`, { status, remarks: rej.trim() }); setReject(false); setRej(''); po.reload(); det.reload(); } catch (e) { setMsg(e.message); }
  };
  return (
    <>
      <Summary items={[
        ['Purchase orders', po.data.summary?.count ?? '…', po.params.q || po.params.from || po.params.to ? 'matching your search' : 'all time', 'blue', 'box'],
        ['Waiting for approval', taka(sum('submitted') + sum('manager_approved')), 'manager, then accountant', 'amber', 'clock'],
        ['Approved', taka(sum('approved')), 'ready to order', 'green', 'check'],
        ['Rejected', taka(sum('rejected')), 'sent back', 'red', 'alert']
      ]} />
      <Notice err={po.error || pr.err || vd.err} onRetry={po.reload} />
      <section className="a-card">
        <Tabs value={tab} onChange={setTab} items={[['orders', 'Purchase orders'], ['requests', 'Requisitions'], ['vendors', 'Vendors']]} />
        {tab === 'requests' && (pr.loading && !pr.data ? <span className="spin" /> : (
          <Tbl t={{ loading: false }} cols="44px 100px minmax(220px,2fr) 90px 130px 140px 130px" head={['SL', 'Requisition', 'Product', 'Qty', 'Need by', 'Stock now / min', 'Best quote']}
            rows={(pr.data?.items || []).map((r, i) => ({ key: r.id, cells: [i + 1, <b key="i" className="mono">{r.id}</b>, <span key="p"><b>{r.product}</b><small style={{ display: 'block', color: '#6b7388' }}>{r.requestedBy} · {r.quoteCount} quotes</small></span>, r.qty, r.needBy ? fDate(r.needBy) : '—', <Chip key="s" tone={r.stock?.low ? 'bad' : 'ok'}>{r.stock?.now} / {r.stock?.min}</Chip>, r.lowest ? taka(r.lowest) : '—'] }))} />
        ))}
        {tab === 'requests' && pr.data && !pr.data.items.length && <div className="a-empty">No open requisitions.</div>}
        {tab === 'vendors' && (vd.loading && !vd.data ? <span className="spin" /> : (
          <Tbl t={{ loading: false }} cols="44px minmax(200px,2fr) minmax(200px,2fr) 160px" head={['SL', 'Vendor', 'Kind', 'Phone']}
            rows={(vd.data?.items || []).map((v, i) => ({ key: v.id, cells: [i + 1, <b key="n">{v.name}</b>, v.kind, v.phone ? <a key="p" href={'tel:' + v.phone}>{v.phone}</a> : '—'] }))} />
        ))}
        {tab === 'vendors' && vd.data && !vd.data.items.length && <div className="a-empty">No vendors.</div>}
      </section>
      {tab === 'orders' && (
        <>
          <ListFilter t={po} noun="purchase order" title="Search purchase orders" search={{ placeholder: 'PO number, vendor or buyer' }} range={{ label: 'Created' }}
            selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: PO_STATUS }]} />
          <Toolbar t={po} search={false} />
          <section className="a-card">
            <Tbl t={po} cols="44px 110px minmax(180px,1.6fr) 150px 120px 130px 130px" head={['SL', 'PO', 'Vendor', 'Raised by', 'Status', 'Deliver by', 'Grand total']} onRow={p => { setOpen(p.id); setReject(false); setMsg(''); }}
              rows={po.data.rows.map((p, i) => ({ key: p.id, item: p, cells: [slNo(po, i), <b key="i" className="mono">{p.id}{p.rev ? ' r' + p.rev : ''}</b>, p.vendor, p.by, <Chip key="s" tone={toneOf(p.status)}>{p.statusLabel}</Chip>, p.deliverBy ? fDate(p.deliverBy) : '—', <span key="g"><b>{taka(p.grand)}</b>{!p.within && <small style={{ display: 'block', color: '#b3261e' }}>over budget by {taka(p.over)}</small>}</span>] }))} />
            <Empty t={po} />
          </section>
          <Pager t={po} />
        </>
      )}
      {open && (
        <Drawer title={open} sub={d ? `${d.vendor} · ${d.statusLabel}` : 'Loading…'} onClose={() => setOpen(null)}>
          {!d ? <Skeleton rows={7} /> : (
            <>
              <div className="fd-facts">
                <Fact k="Vendor">{d.vendor}</Fact><Fact k="Raised by">{d.by}</Fact><Fact k="Deliver by">{d.deliverBy && fDate(d.deliverBy)}</Fact><Fact k="Deliver to">{d.deliverTo}</Fact><Fact k="Payment terms">{d.paymentTerms}</Fact><Fact k="Note">{d.note}</Fact>
                <Fact k="Budget">{d.within ? 'Within budget' : `Over by ${taka(d.over)}`}</Fact><Fact k="Submitted">{d.submittedAt && fDateTime(d.submittedAt)}</Fact>
              </div>
              <div className="fd-sub-row">{d.lines.map(l => <div key={l.id}><span>{l.name}{l.sku ? ' · ' + l.sku : ''}</span><em>{l.qty} × {taka(l.unitPrice)}</em><b>{taka(l.total)}</b></div>)}
                <div className="fd-sub-sum">Subtotal {taka(d.subtotal)} · VAT {taka(d.vat)} · Freight {taka(d.freight)} · <b>Grand total {taka(d.grand)}</b></div></div>
              <Notice err={msg} />
              {['submitted', 'manager_approved'].includes(d.status) && (reject
                ? <div className="fd-rej"><textarea className="a-input" rows={2} placeholder="Reason for rejecting (the buyer sees this)" value={rej} onChange={e => setRej(e.target.value)} autoFocus /><div><button type="button" className="a-mini" onClick={() => setReject(false)}>Cancel</button><button type="button" className="a-mini bad" disabled={!rej.trim()} onClick={() => decide('rejected')}>Confirm reject</button></div></div>
                : <div className="fd-apa"><button type="button" className="a-mini ok" onClick={() => decide('approved')}>Approve this step</button><button type="button" className="a-mini" onClick={() => setReject(true)}>Reject</button></div>)}
            </>
          )}
        </Drawer>
      )}
    </>
  );
}

/* ---------------- reports ---------------- */
const REPORTS = [['sales', 'Sales'], ['collection', 'Collections'], ['delivery', 'Deliveries'], ['expense', 'Expenses'], ['approvals', 'Approvals'], ['ledger', 'Ledger sync'], ['attendance', 'Attendance'], ['leave', 'Leave'], ['route', 'Routes']];

export function AccReports() {
  const [type, setType] = useState('sales');
  const [period, setPeriod] = useState('month');
  const sm = useFld(`/reports/summary?type=${type}&period=${period}`);
  const t = useTable('/reports/export', { name: 'sales', size: 25, ...periodOf('month') }, [], fld);
  const r = t.data, name = t.params.name;
  const [busy, setBusy] = useState(false);
  const csv = async () => {
    setBusy(true);
    try {
      const { page: _p, size: _s, ...rest } = t.params;
      const qs = new URLSearchParams(Object.entries({ ...rest, format: 'json' }).filter(([, v]) => v !== '' && v != null));
      const all = await fld.get('/reports/export?' + qs);
      downloadCsv(`${name}-${t.params.from || 'all'}_${t.params.to || 'all'}.csv`, all.columns, all.rows);
    } catch (e) { alertBox(e.message); }
    setBusy(false);
  };
  const grid = { gridTemplateColumns: `repeat(${(r.columns || []).length}, minmax(110px, 1fr))` };
  return (
    <>
      <Summary items={(sm.data?.kpis || [{ label: 'Loading…', display: '…', delta: '' }]).map((k, i) => [k.label, k.display, k.delta, ['green', 'blue', 'violet', 'amber'][i % 4], ['cart', 'check', 'money', 'clock'][i % 4]])} />
      <Notice err={sm.err || t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={type} onChange={setType} items={[['sales', 'Sales'], ['expenses', 'Expenses'], ['attendance', 'Attendance']]} /><Tabs value={period} onChange={setPeriod} items={[['day', 'Today'], ['week', 'This week'], ['month', 'This month']]} /></div>
        {sm.data?.chart && <><h3 style={{ margin: 0 }}>{sm.data.chart.title} <small className="fd-sub">{sm.data.label}</small></h3>
          <HBars rows={sm.data.chart.bars.map(b => ({ label: b.label, value: b.value, text: b.display }))} hue={type === 'expenses' ? 50 : type === 'attendance' ? 200 : 150} inline /></>}
      </section>
      <section className="a-card">
        <div className="card-hd"><div><h3>Detailed report</h3><small className="fd-sub">Pick a report, choose the dates and download it for Excel</small></div></div>
        <Tabs value={name} onChange={n => t.set({ name: n, q: '' })} items={REPORTS} />
      </section>
      <ListFilter t={t} noun="row" title={`Search ${r.title ? r.title.toLowerCase() : 'report'}`} search={{ placeholder: 'Search this report…' }} range={{ label: 'Report date', def: 'month' }} />
      <Toolbar t={t} search={false}>
        {r.title && <b>{r.title}</b>}{r.period && <span className="fd-sub">{r.period}</span>}
        <button type="button" className="a-mini" style={{ width: 'auto', flex: 'none' }} disabled={busy || !r.total} onClick={csv}>{busy ? 'Preparing…' : '⤓ Download CSV'}</button>
      </Toolbar>
      <section className="a-card">
        <div className="fd-tbl" style={{ opacity: t.loading ? 0.6 : 1 }}>
          <div className="fd-th" style={grid}>{(r.columns || []).map(c => <span key={c}>{c}</span>)}</div>
          {r.rows.map((row, i) => <div key={i} className="fd-tr" style={grid}>{row.map((c, j) => <span key={j}>{c}</span>)}</div>)}
        </div>
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}
