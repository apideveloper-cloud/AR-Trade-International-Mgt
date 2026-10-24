import { useEffect, useMemo, useState } from 'react';
import { adm, fld } from '../adminApi.js';
import { HBars } from '../charts.jsx';
import { Drawer, Summary } from '../ui.jsx';
import { Av, Chip, Fact, Grid, Notice, Skeleton, Tabs, usePaged, downloadCsv, fDate, fDateTime, taka, toneOf, todayBd, useDebounced, useFld } from '../fieldKit.jsx';

// The accountant's side of the console: money owed to us, money collected, expenses, purchase orders and the reports.
const month0 = () => todayBd().slice(0, 7);

/* ---------------- overview ---------------- */
export function AccOverview({ go }) {
  const col = useFld('/reports/collection?period=month');
  const exp = useFld('/reports/expense?month=' + month0());
  const sales = useFld('/reports/summary?type=sales&period=month');
  const po = useFld('/purchase/orders');
  const ap = useFld('/approvals/summary');
  const [web, setWeb] = useState(null);
  useEffect(() => { adm.get('/overview').then(o => setWeb(o.finance || null)).catch(() => {}); }, []);
  const poOpen = (po.data?.items || []).filter(p => ['submitted', 'managerapproved'].includes(p.status));
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
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, err, loading, reload } = useFld(`/payments/customers?q=${encodeURIComponent(dq)}`);
  const [open, setOpen] = useState(null);
  const list = data?.customers || [];
  const all = list.flatMap(c => c.invoices);
  const bucket = (a, b) => all.filter(i => i.ageDays >= a && i.ageDays <= b).reduce((t, i) => t + i.due, 0);
  const total = list.reduce((t, c) => t + c.due, 0);
  return (
    <>
      <Summary items={[
        ['Customers owing', data?.withDue ?? '…', 'with open invoices', 'blue', 'users'],
        ['Total receivable', taka(total), `${all.length} invoices`, 'red', 'money'],
        ['Over 30 days', taka(bucket(31, 99999)), 'chase these first', 'amber', 'alert'],
        ['0 to 15 days', taka(bucket(0, 15)), 'still fresh', 'green', 'check']
      ]} />
      <Notice err={err} onRetry={reload} />
      <section className="a-card">
        <div className="fd-bar"><input className="a-input fd-q" placeholder="Search customer…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search customers" /><button type="button" className="a-mini" disabled={!all.length} onClick={() => downloadCsv('receivables.csv', ['Customer', 'Invoice', 'Order', 'Date', 'Total', 'Paid', 'Due', 'Age (days)'], list.flatMap(c => c.invoices.map(i => [c.name, i.id, i.orderRef, fDate(i.date), i.total, i.paid, i.due, i.ageDays])))}>⤓ CSV</button></div>
        {loading && !data ? <span className="spin" /> : (
          <Grid search={false} cols="44px minmax(220px,2fr) 150px 130px 130px 130px" head={['SL', 'Customer', 'Phone', 'Invoices', 'Oldest', 'Due']} onRow={c => setOpen(open === c.id ? null : c.id)} empty="No customer owes anything."
            rows={list.flatMap((c, i) => [{ key: c.id, item: c, cells: [i + 1, <span className="fd-who" key="n"><Av name={c.name} /><span><b>{c.name}</b><small>{[c.contact, c.area].filter(Boolean).join(' · ')}</small></span></span>, c.phone || '—', c.invoices.length, `${Math.max(...c.invoices.map(x => x.ageDays))} days`, <b key="d" style={{ color: '#b3261e' }}>{taka(c.due)}</b>] },
              ...(open === c.id ? [{ key: c.id + 'x', item: null, full: true, cells: [<div key="x" className="fd-sub-row">{c.invoices.map(v => <div key={v.id}><span><b>{v.id}</b> · {v.orderRef} · {fDate(v.date)}</span><em>paid {taka(v.paid)} of {taka(v.total)}</em><b>{taka(v.due)} <Chip tone={v.ageDays > 30 ? 'bad' : v.ageDays > 15 ? 'amber' : 'ok'}>{v.ageDays}d</Chip></b></div>)}</div>] }] : [])])} />
        )}
      </section>
    </>
  );
}

/* ---------------- collections ---------------- */
export function AccCollections() {
  const [period, setPeriod] = useState('month');
  const [m, setM] = useState('all');
  const { data, err, loading } = useFld('/reports/collection?period=' + period);
  const items = (data?.items || []).filter(i => m === 'all' || i.method === m);
  const methods = [...new Set((data?.items || []).map(i => i.method))];
  return (
    <>
      <Summary items={[
        ['Collected', taka(data?.total), data?.label || '', 'green', 'money'],
        ['Receipts', data?.count ?? '…', 'money receipts', 'blue', 'check'],
        ['Still owed', taka(data?.dues?.total), 'all unpaid invoices', 'red', 'clock']
      ]} />
      <Notice err={err} />
      <div className="fd-two">
        <section className="a-card"><div className="card-hd"><h3>By method</h3></div>{(data?.methods || []).length ? <HBars rows={data.methods.map(x => ({ label: x.label, value: x.amount, text: taka(x.amount), sub: x.pct + '%' }))} hue={150} inline /> : <div className="a-empty">No receipts in this period.</div>}</section>
        <section className="a-card"><div className="card-hd"><h3>Unpaid by age</h3></div>{(data?.dues?.aging || []).length ? <HBars rows={data.dues.aging.map(x => ({ label: x.label, value: x.amount, text: taka(x.amount) }))} hue={20} /> : null}</section>
      </div>
      <section className="a-card">
        <div className="fd-bar"><Tabs value={period} onChange={setPeriod} items={[['day', 'Today'], ['week', 'This week'], ['month', 'This month']]} /><Tabs value={m} onChange={setM} items={[['all', 'All methods'], ...methods.map(x => [x, x])]} />
          <button type="button" className="a-mini" disabled={!items.length} onClick={() => downloadCsv('collections.csv', ['Receipt', 'Date', 'Customer', 'Invoices', 'Method', 'Collected by', 'Amount', 'Status'], items.map(i => [i.id, fDateTime(i.date), i.customer, i.invoices, i.method, i.who, i.amount, i.status]))}>⤓ CSV</button></div>
        {loading && !data ? <span className="spin" /> : (
          <Grid cols="44px 110px minmax(200px,2fr) minmax(140px,1fr) 100px 150px 120px 120px" head={['SL', 'Receipt', 'Customer', 'Invoices', 'Method', 'Collected by', 'Status', 'Amount']} empty="No receipts."
            rows={items.map((i, k) => ({ key: i.id, cells: [k + 1, <b key="i" className="mono">{i.id}</b>, <span key="c"><b>{i.customer}</b><small style={{ display: 'block', color: '#6b7388' }}>{fDateTime(i.date)}</small></span>, i.invoices, i.method, i.who, <Chip key="s" tone={toneOf(i.status)}>{i.status}</Chip>, <b key="a">{taka(i.amount)}</b>] }))} />
        )}
      </section>
    </>
  );
}

/* ---------------- expenses ---------------- */
export function AccExpenses() {
  const [month, setMonth] = useState(month0());
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const { data, err, loading } = useFld(`/reports/expense?month=${month}&category=${encodeURIComponent(cat)}&status=${status}`);
  const split = Object.fromEntries((data?.split || []).map(s => [s.label, s]));
  const items = data?.items || [];
  return (
    <>
      <Summary items={[
        ['Total claimed', taka(data?.total), `${data?.count ?? 0} claims · ${data?.month || ''}`, 'amber', 'money'],
        ['Approved', taka(split.Approved?.amount), `${split.Approved?.count || 0} claims`, 'green', 'check'],
        ['Waiting', taka(split.Pending?.amount), `${split.Pending?.count || 0} claims`, 'blue', 'clock'],
        ['Rejected', taka(split.Rejected?.amount), `${split.Rejected?.count || 0} claims`, 'red', 'alert']
      ]} />
      <Notice err={err} />
      <div className="fd-two">
        <section className="a-card"><div className="card-hd"><h3>By category</h3></div>{(data?.categories || []).length ? <HBars rows={data.categories.map(c => ({ label: c.name, value: c.amount, text: taka(c.amount), sub: c.count + ' claims' }))} hue={60} inline /> : <div className="a-empty">No claims.</div>}</section>
        <section className="a-card">
          <div className="card-hd"><h3>Filter</h3></div>
          <label className="fd-sel">Month<input type="month" className="a-input" value={month} max={month0()} onChange={e => e.target.value && setMonth(e.target.value)} /></label>
          <label className="fd-sel">Category<select className="a-input" value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{['Fuel', 'Food', 'Transport', 'Mobile', 'Courier', 'Other'].map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="fd-sel">Status<select className="a-input" value={status} onChange={e => setStatus(e.target.value)}><option value="">All</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></label>
        </section>
      </div>
      <section className="a-card">
        <div className="fd-bar"><span className="fd-sub">Decide waiting claims in <b>Approvals</b>.</span><button type="button" className="a-mini" disabled={!items.length} onClick={() => downloadCsv(`expenses-${month}.csv`, ['Date', 'Staff', 'Description', 'Category', 'Amount', 'Status'], items.map(i => [fDate(i.date), i.who, i.title, i.category, i.amount, i.status]))}>⤓ CSV</button></div>
        {loading && !data ? <span className="spin" /> : (
          <Grid cols="44px 120px 170px minmax(220px,2fr) 120px 110px 120px" head={['SL', 'Date', 'Staff', 'Description', 'Category', 'Status', 'Amount']} empty="No expense claims for this filter."
            rows={items.map((i, k) => ({ key: i.id, cells: [k + 1, fDate(i.date), i.who, <span key="t">{i.title}{i.voucher ? ' 📎' : ''}</span>, i.category, <Chip key="s" tone={toneOf(i.status)}>{i.status}</Chip>, <b key="a">{taka(i.amount)}</b>] }))} />
        )}
      </section>
    </>
  );
}

/* ---------------- purchase ---------------- */
export function AccPurchase() {
  const [tab, setTab] = useState('orders');
  const [st, setSt] = useState('all');
  const po = useFld('/purchase/orders');
  const pr = useFld(tab === 'requests' ? '/purchase/requests' : null);
  const vd = useFld(tab === 'vendors' ? '/purchase/vendors' : null);
  const [open, setOpen] = useState(null);
  const det = useFld(open ? '/purchase/orders/' + open : null);
  const [msg, setMsg] = useState('');
  const [rej, setRej] = useState('');
  const [reject, setReject] = useState(false);
  const orders = (po.data?.items || []).filter(p => st === 'all' || p.status === st);
  const sum = s => (po.data?.items || []).filter(p => p.status === s).reduce((t, p) => t + p.grand, 0);
  const d = det.data;
  const decide = async status => {
    setMsg('');
    try { await fld.put(`/approvals/purchase/${open}/decision`, { status, remarks: rej.trim() }); setReject(false); setRej(''); po.reload(); det.reload(); } catch (e) { setMsg(e.message); }
  };
  const statuses = useMemo(() => ['all', ...new Set((po.data?.items || []).map(p => p.status))], [po.data]);
  return (
    <>
      <Summary items={[
        ['Purchase orders', (po.data?.items || []).length, 'all time', 'blue', 'box'],
        ['Waiting for approval', taka(sum('submitted') + sum('managerapproved')), 'manager, then accountant', 'amber', 'clock'],
        ['Approved', taka(sum('approved')), 'ready to order', 'green', 'check'],
        ['Rejected', taka(sum('rejected')), 'sent back', 'red', 'alert']
      ]} />
      <Notice err={po.err || pr.err || vd.err} />
      <section className="a-card">
        <Tabs value={tab} onChange={setTab} items={[['orders', 'Purchase orders'], ['requests', 'Requisitions'], ['vendors', 'Vendors']]} />
        {tab === 'orders' && (
          <>
            <Tabs value={st} onChange={setSt} items={statuses.map(s => [s, s === 'all' ? 'All' : s.replace(/([a-z])([A-Z])/g, '$1 $2')])} />
            <Grid cols="44px 110px minmax(180px,1.6fr) 150px 120px 130px 130px" head={['SL', 'PO', 'Vendor', 'Raised by', 'Status', 'Deliver by', 'Grand total']} onRow={p => { setOpen(p.id); setReject(false); setMsg(''); }} empty="No purchase orders."
              rows={orders.map((p, i) => ({ key: p.id, item: p, cells: [i + 1, <b key="i" className="mono">{p.id}{p.rev ? ' r' + p.rev : ''}</b>, p.vendor, p.by, <Chip key="s" tone={toneOf(p.status)}>{p.statusLabel}</Chip>, p.deliverBy ? fDate(p.deliverBy) : '—', <span key="g"><b>{taka(p.grand)}</b>{!p.within && <small style={{ display: 'block', color: '#b3261e' }}>over budget by {taka(p.over)}</small>}</span>] }))} />
          </>
        )}
        {tab === 'requests' && (pr.loading && !pr.data ? <span className="spin" /> : (
          <Grid cols="44px 100px minmax(220px,2fr) 90px 130px 140px 130px" head={['SL', 'Requisition', 'Product', 'Qty', 'Need by', 'Stock now / min', 'Best quote']} empty="No open requisitions."
            rows={(pr.data?.items || []).map((r, i) => ({ key: r.id, cells: [i + 1, <b key="i" className="mono">{r.id}</b>, <span key="p"><b>{r.product}</b><small style={{ display: 'block', color: '#6b7388' }}>{r.requestedBy} · {r.quoteCount} quotes</small></span>, r.qty, r.needBy ? fDate(r.needBy) : '—', <Chip key="s" tone={r.stock?.low ? 'bad' : 'ok'}>{r.stock?.now} / {r.stock?.min}</Chip>, r.lowest ? taka(r.lowest) : '—'] }))} />
        ))}
        {tab === 'vendors' && (vd.loading && !vd.data ? <span className="spin" /> : (
          <Grid cols="44px minmax(200px,2fr) minmax(200px,2fr) 160px" head={['SL', 'Vendor', 'Kind', 'Phone']} empty="No vendors."
            rows={(vd.data?.items || []).map((v, i) => ({ key: v.id, cells: [i + 1, <b key="n">{v.name}</b>, v.kind, v.phone ? <a key="p" href={'tel:' + v.phone}>{v.phone}</a> : '—'] }))} />
        ))}
      </section>
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
              {['submitted', 'managerapproved'].includes(d.status) && (reject
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
  const [name, setName] = useState('sales');
  const sm = useFld(`/reports/summary?type=${type}&period=${period}`);
  const rp = useFld(`/reports/export?name=${name}&period=${period}&format=json`);
  const r = rp.data;
  const [rq, setRq] = useState('');
  const found = (r?.rows || []).filter(row => !rq.trim() || row.join(' ').toLowerCase().includes(rq.trim().toLowerCase()));
  const pg = usePaged(found);
  return (
    <>
      <Summary items={(sm.data?.kpis || [{ label: 'Loading…', display: '…', delta: '' }]).map((k, i) => [k.label, k.display, k.delta, ['green', 'blue', 'violet', 'amber'][i % 4], ['cart', 'check', 'money', 'clock'][i % 4]])} />
      <Notice err={sm.err || rp.err} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={type} onChange={setType} items={[['sales', 'Sales'], ['expenses', 'Expenses'], ['attendance', 'Attendance']]} /><Tabs value={period} onChange={setPeriod} items={[['day', 'Today'], ['week', 'This week'], ['month', 'This month']]} /></div>
        {sm.data?.chart && <><h3 style={{ margin: 0 }}>{sm.data.chart.title} <small className="fd-sub">{sm.data.label}</small></h3>
          <HBars rows={sm.data.chart.bars.map(b => ({ label: b.label, value: b.value, text: b.display }))} hue={type === 'expenses' ? 50 : type === 'attendance' ? 200 : 150} inline /></>}
      </section>
      <section className="a-card">
        <div className="card-hd"><div><h3>Detailed report</h3><small className="fd-sub">Pick a report and download it for Excel</small></div></div>
        <Tabs value={name} onChange={setName} items={REPORTS} />
        {rp.loading && !r ? <span className="spin" /> : r && (
          <>
            <div className="fd-bar"><b>{r.title}</b><span className="fd-sub">{r.period}</span><input className="a-input fd-q" type="search" placeholder="Search this report…" value={rq} onChange={e => setRq(e.target.value)} aria-label="Search this report" /><button type="button" className="a-mini" disabled={!found.length} onClick={() => downloadCsv(`${name}-${period}.csv`, r.columns, found)}>⤓ Download CSV</button></div>
            <div className="fd-tbl"><div className="fd-th" style={{ gridTemplateColumns: `repeat(${r.columns.length}, minmax(110px, 1fr))` }}>{r.columns.map(c => <span key={c}>{c}</span>)}</div>
              {pg.items.map((row, i) => <div key={i} className="fd-tr" style={{ gridTemplateColumns: `repeat(${r.columns.length}, minmax(110px, 1fr))` }}>{row.map((c, j) => <span key={j}>{c}</span>)}</div>)}
              {!found.length && <div className="a-empty">{r.rows.length ? 'No row matches your search.' : 'Nothing to report for this period.'}</div>}</div>
            {pg.bar}
          </>
        )}
      </section>
    </>
  );
}
