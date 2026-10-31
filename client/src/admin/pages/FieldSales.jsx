import { useEffect, useState } from 'react';
import { fld, slNo, useTable, viewFieldFile } from '../adminApi.js';
import { Drawer, Empty, Pager, Summary, Toolbar } from '../ui.jsx';
import { ListFilter, periodOf } from '../ListFilter.jsx';
import { Av, Chip, Fact, Notice, PdfButton, PdfPreview, Skeleton, Tabs, fDate, fDateTime, fTime, taka, toneOf, useFld } from '../fieldKit.jsx';

// Web views of the field app's sales side: customers (CRM), visits and follow-ups, sales orders, deliveries and the contact directory.
// Every list is searched, filtered by date and paged on the server (useTable + ListFilter), the way the other admin lists are.

/** The console's grid table for one server page (the paging, search and "no rows" notice live outside, in Toolbar / ListFilter / Pager / Empty). */
function Rows({ t, cols, head, rows, onRow }) {
  if (!rows.length) return null;
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

/* ---------------- customers ---------------- */
export function FieldCustomers() {
  const t = useTable('/customers', { kind: 'all', q: '', from: '', to: '', size: 25 }, [], fld);
  const [open, setOpen] = useState(null);
  const items = t.data.rows || [], c = t.data.counts || {};
  return (
    <>
      <Summary items={[
        ['Field customers', c.all ?? '…', 'in the CRM', 'blue', 'users'],
        ['Active', c.active ?? '…', 'have ordered', 'green', 'check'],
        ['Upcoming', c.upcoming ?? '…', 'leads to win', 'violet', 'plus'],
        ['Dues (matching)', taka(t.data.dueTotal), 'unpaid invoices', 'red', 'money']
      ]} />
      <Notice err={t.error} onRetry={t.reload} />
      <ListFilter t={t} noun="customer" title="Search customers" search={{ placeholder: 'Name, contact, area or phone' }} range={{ label: 'Added' }} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={t.params.kind} onChange={k => t.set({ kind: k })} items={[['all', 'All', c.all], ['active', 'Active', c.active], ['upcoming', 'Upcoming', c.upcoming]]} /></div>
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="44px minmax(220px,2fr) 140px 130px 110px 110px 120px" head={['SL', 'Customer', 'Phone', 'Area', 'Type', 'Status', 'Due']} onRow={setOpen}
          rows={items.map((x, i) => ({ key: x.id, item: x, cells: [slNo(t, i), <span className="fd-who" key="n"><Av name={x.name} /><span><b>{x.name}</b><small>{[x.contact, x.contactRole].filter(Boolean).join(' · ')}</small></span></span>, x.phone, x.area || '—', x.type || '—', <Chip key="s" tone={toneOf(x.kind)}>{x.kind}</Chip>, x.due ? <b key="d" style={{ color: '#b3261e' }}>{taka(x.due)}</b> : '—'] }))} />
        <Empty t={t} /><Pager t={t} />
      </section>
      {open && (
        <Drawer title={open.name} sub={`${open.kind} · ${open.type || 'Customer'}`} onClose={() => setOpen(null)}>
          <div className="fd-facts">
            <Fact k="Contact person">{[open.contact, open.contactRole].filter(Boolean).join(' · ')}</Fact><Fact k="Phone">{open.phone && <a href={'tel:' + open.phone}>{open.phone}</a>}</Fact>
            <Fact k="Email">{open.email}</Fact><Fact k="Address">{open.address}</Fact><Fact k="Area">{open.area}</Fact>
            <Fact k="Interested in">{open.interest}</Fact><Fact k="Expected value">{open.monthlyValue}</Fact><Fact k="Source">{open.source}</Fact>
            <Fact k="Next step">{open.nextStep}</Fact><Fact k="Notes">{open.note}</Fact><Fact k="Open dues">{open.due ? taka(open.due) : ''}</Fact><Fact k="Added">{fDate(open.createdAt)}</Fact>
            {open.lat != null && <Fact k="Location"><a href={`https://www.openstreetmap.org/?mlat=${open.lat}&mlon=${open.lng}#map=16/${open.lat}/${open.lng}`} target="_blank" rel="noreferrer">Open on the map ↗</a></Fact>}
          </div>
        </Drawer>
      )}
    </>
  );
}

/* ---------------- visits and follow-ups ---------------- */
export function FieldVisits() {
  const team = useFld('/team');
  const people = (team.data?.members || []).filter(m => ['rm', 'manager'].includes(m.role));
  const [sid, setSid] = useState('');
  const [tab, setTab] = useState('visits');
  const staff = sid || (people.find(p => p.role === 'rm')?.id ?? people[0]?.id ?? '');
  // visits open on today; the period is a day or a range, and `date` keeps the week strip on the first day of the period
  const day = periodOf('today');
  const v = useTable('/visits', { q: '', status: '', staff_id: '', date: day.from, ...day, size: 25 }, [], fld);
  const f = useTable('/followups', { q: '', bucket: 'all', status: '', staff_id: '', from: '', to: '', size: 25 }, [], fld);
  const who = staff ? String(staff) : '';
  useEffect(() => {
    if (v.params.staff_id !== who) v.set({ staff_id: who });
    if (f.params.staff_id !== who) f.set({ staff_id: who });
  }, [who]); // eslint-disable-line react-hooks/exhaustive-deps
  const vt = { ...v, set: patch => v.set('from' in patch ? { ...patch, date: patch.from || '' } : patch) };
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState(null);
  const act = async (id, what, body) => {
    setMsg('');
    try { await fld.put(`/followups/${id}/${what}`, body); setNote(null); f.reload(); } catch (e) { setMsg(e.message); }
  };
  const fc = f.data.counts || {};
  const one = v.params.from && v.params.from === v.params.to;
  const goDay = d => v.set({ from: d, to: d, date: d });
  const vd = v.data;
  return (
    <>
      <Notice err={v.error || f.error || msg} />
      <section className="a-card">
        <div className="fd-bar">
          <label className="fd-sel">Salesperson
            <select className="a-input" value={staff} onChange={e => setSid(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{p.name} · {p.roleLabel}</option>)}{!people.length && <option value="">Me</option>}</select>
          </label>
          <Tabs value={tab} onChange={setTab} items={[['visits', 'Visits'], ['follow', 'Follow-ups', fc.open]]} />
        </div>
      </section>
      {tab === 'visits' && (
        <>
          <ListFilter t={vt} noun="visit" title="Search visits" search={{ placeholder: 'Customer, area, contact or purpose' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: [{ v: 'Planned', t: 'Planned' }, { v: 'InProgress', t: 'In progress' }, { v: 'Done', t: 'Done' }] }]} range={{ label: 'Visit date', def: 'today' }} />
          <section className="a-card">
            <div className="fd-week">{(vd.week || []).map(d => <button key={d.date} type="button" disabled={d.off} className={(one && d.date === v.params.from ? 'on ' : '') + (d.count ? 'has' : '')} onClick={() => goDay(d.date)}><small>{d.dn}</small><b>{d.dt}</b><em>{d.off ? 'off' : d.count || '·'}</em></button>)}</div>
            <div className="fd-bar"><span className="fd-sub">{v.loading && !vd.visits ? '…' : `${one ? fDate(v.params.from) : 'Selected period'} · ${vd.total} visit${vd.total === 1 ? '' : 's'}, ${vd.done} done`}</span></div>
            <Toolbar t={v} search={false} />
            <div className="fd-appr" style={{ opacity: v.loading ? 0.6 : 1 }}>
              {(vd.rows || []).map(x => (
                <div key={x.id} className="fd-ap">
                  <Av name={x.customer} />
                  <div className="fd-apb">
                    <div className="fd-aph"><b>{x.customer}</b><Chip tone={toneOf(x.status)}>{x.status}</Chip><Chip tone="blue">{x.purpose}</Chip></div>
                    <div className="fd-aps">{!one && fDate(x.date) + ' · '}{x.time} · {x.area || x.address} {x.contact ? '· ' + x.contact : ''}</div>
                    <div className="fd-apm">{x.checkIn && <span>In {fTime(x.checkIn)}</span>}{x.checkOut && <span>Out {fTime(x.checkOut)}</span>}{x.outcome && <span><b>{x.outcome}</b></span>}{x.orderValue > 0 && <strong>{taka(x.orderValue)}</strong>}</div>
                    {x.notes && <div className="fd-apd">{x.notes}</div>}{x.followupAction && <div className="fd-apd">Follow-up: {x.followupAction}{x.followupWhen ? ' · ' + x.followupWhen : ''}</div>}
                  </div>
                </div>
              ))}
            </div>
            <Empty t={v} /><Pager t={v} />
          </section>
        </>
      )}
      {tab === 'follow' && (
        <>
          <ListFilter t={f} noun="follow-up" title="Search follow-ups" search={{ placeholder: 'Customer, area, title or note' }} selects={[{ key: 'status', label: 'Status', all: 'Open and done', icon: 'status', options: ['Open', 'Done'] }]} range={{ label: 'Due' }} />
          <section className="a-card">
            <div className="fd-bar"><Tabs value={f.params.bucket} onChange={k => f.set({ bucket: k })} items={[['all', 'All'], ['overdue', 'Overdue', fc.overdue], ['today', 'Today', fc.today], ['upcoming', 'Upcoming', fc.upcoming]]} /></div>
            <Toolbar t={f} search={false} />
            <div className="fd-appr" style={{ opacity: f.loading ? 0.6 : 1 }}>
              {(f.data.rows || []).map(x => (
                <div key={x.id} className={'fd-ap' + (x.status === 'Open' && x.group === 0 ? ' open' : '')}>
                  <Av name={x.customer} />
                  <div className="fd-apb">
                    <div className="fd-aph"><b>{x.customer}</b><Chip tone={x.status !== 'Open' ? 'ok' : x.group === 0 ? 'bad' : x.group === 1 ? 'amber' : 'violet'}>{x.status !== 'Open' ? x.status : ['Overdue', 'Today', 'Upcoming'][x.group]}</Chip><Chip tone="blue">{x.action}</Chip></div>
                    <div className="fd-aps">{x.title} · due {fDateTime(x.dueAt)}</div>
                    {x.note && <div className="fd-apd">{x.note}</div>}{x.doneRemarks && <div className="fd-apd">Done: {x.doneRemarks}</div>}
                    {note?.id === x.id && <div className="fd-rej"><textarea className="a-input" rows={2} placeholder="What happened? (required)" value={note.text} onChange={e => setNote({ ...note, text: e.target.value })} autoFocus /><div><button type="button" className="a-mini" onClick={() => setNote(null)}>Cancel</button><button type="button" className="a-mini ok" disabled={!note.text.trim()} onClick={() => act(x.id, 'done', { remarks: note.text.trim() })}>Mark done</button></div></div>}
                  </div>
                  <div className="fd-apa">{x.status === 'Open' ? <button type="button" className="a-mini ok" onClick={() => setNote({ id: x.id, text: '' })}>Done…</button> : <button type="button" className="a-mini" onClick={() => act(x.id, 'reopen')}>Reopen</button>}</div>
                </div>
              ))}
            </div>
            <Empty t={f} /><Pager t={f} />
          </section>
        </>
      )}
    </>
  );
}

/* ---------------- sales orders ---------------- */
export function FieldOrders() {
  const t = useTable('/orders', { q: '', approval: '', status: '', from: '', to: '', size: 25 }, [], fld);
  const [open, setOpen] = useState(null);
  const [rej, setRej] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [msg, setMsg] = useState('');
  const data = t.data, items = data.rows || [];
  const decide = async (id, status, remarks = '') => {
    setMsg('');
    try { await fld.put(`/orders/${id}/approve`, { status, remarks }); setRej(null); t.reload(); } catch (e) { setMsg(e.message); }
  };
  return (
    <>
      <Summary items={[
        ['Orders today', data.summary?.ordersToday ?? '…', 'placed by the team', 'blue', 'cart'],
        ['Sales today', taka(data.summary?.salesToday), 'after discount', 'green', 'money'],
        ['Waiting approval', data.pending ?? '…', 'in this list · manager decides', 'amber', 'clock'],
        ['Matching orders', data.total, taka(data.amount), 'violet', 'box']
      ]} />
      <Notice err={t.error || msg} onRetry={t.error ? t.reload : undefined} />
      <ListFilter t={t} noun="order" title="Search orders" search={{ placeholder: 'Order no, customer or taken by' }}
        selects={[{ key: 'approval', label: 'Approval', all: 'All approvals', icon: 'status', options: ['Pending', 'Approved', 'Rejected'] }, { key: 'status', label: 'Status', all: 'All statuses', icon: 'box', options: ['Placed', 'Delivered', 'Cancelled'] }]}
        range={{ label: 'Order date' }} />
      <section className="a-card">
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="44px 140px minmax(200px,2fr) 150px 110px 110px 120px 84px" head={['SL', 'Order', 'Customer', 'Taken by', 'Approval', 'Status', 'Total', 'Document']} onRow={o => setOpen(open === o.id ? null : o.id)}
          rows={items.flatMap((o, i) => [{ key: o.id, item: o, cells: [slNo(t, i), <b key="i" className="mono">{o.id}</b>, <span key="c"><b>{o.customer}</b><small style={{ display: 'block', color: '#6b7388' }}>{fDateTime(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}</small></span>, o.by, <Chip key="a" tone={toneOf(o.approval)}>{o.approval}</Chip>, <Chip key="s" tone={toneOf(o.status)}>{o.status}</Chip>, <b key="t">{taka(o.total)}</b>, <PdfButton key="p" title="Preview the sales order as a PDF" onClick={() => setPdf(o)} />] },
            ...(open === o.id ? [{ key: o.id + '-d', item: null, full: true, cells: [<div key="x" className="fd-sub-row">
              {o.lines.map(l => <div key={l.id}><span>{l.name}</span><em>{l.qty} × {taka(l.price)}</em><b>{taka(l.qty * l.price)}</b></div>)}
              <div className="fd-sub-sum">Subtotal {taka(o.subtotal)} · Discount {taka(o.discount)} · <b>Total {taka(o.total)}</b>{o.synced ? ' · posted to accounts' : ''}</div>
              {o.notes && <div className="fd-apd">Note: {o.notes}</div>}
              <div className="fd-apa" style={{ justifyContent: 'flex-start' }}><PdfButton title="Preview the sales order as a PDF" label="PDF preview" onClick={() => setPdf(o)} /></div>
              {o.approval === 'Pending' && (rej === o.id
                ? <div className="fd-rej"><textarea id={'rj' + o.id} className="a-input" rows={2} placeholder="Reason for rejecting" autoFocus /><div><button type="button" className="a-mini" onClick={() => setRej(null)}>Cancel</button><button type="button" className="a-mini bad" onClick={() => decide(o.id, 'rejected', document.getElementById('rj' + o.id).value.trim())}>Confirm reject</button></div></div>
                : <div className="fd-apa"><button type="button" className="a-mini ok" onClick={() => decide(o.id, 'approved')}>Approve</button><button type="button" className="a-mini" onClick={() => setRej(o.id)}>Reject</button></div>)}
            </div>] }] : [])])} />
        <Empty t={t} /><Pager t={t} />
      </section>
      {pdf && <PdfPreview url={`/api/field/orders/${pdf.id}/pdf`} title={pdf.id} filename={`${pdf.id}.pdf`} onClose={() => setPdf(null)} />}
    </>
  );
}

/* ---------------- deliveries ---------------- */
export function FieldDeliveries() {
  const t = useTable('/deliveries', { status: 'pending', q: '', from: '', to: '', size: 25 }, [], fld);
  const [open, setOpen] = useState(null);
  const [pdf, setPdf] = useState(null);
  const det = useFld(open ? '/deliveries/' + open : null);
  const data = t.data, c = data.counts || {};
  const d = det.data;
  return (
    <>
      <Summary items={[
        ['Pending', c.pending ?? '…', 'to deliver', 'amber', 'truck'],
        ['Delivered', c.delivered ?? '…', 'with proof', 'green', 'check'],
        ['Pending value', taka(data.pendingAmount), 'still to be delivered', 'red', 'money'],
        ['Completion', (data.percent ?? 0) + '%', 'delivered of all', 'blue', 'box']
      ]} />
      <Notice err={t.error} onRetry={t.reload} />
      <ListFilter t={t} noun="delivery note" title="Search deliveries" search={{ placeholder: 'Customer, delivery or order no, address' }} range={{ label: 'Created' }} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={t.params.status} onChange={k => t.set({ status: k })} items={[['pending', 'Pending', c.pending], ['delivered', 'Delivered', c.delivered], ['all', 'All', c.all]]} /></div>
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="44px 120px minmax(200px,2fr) 150px 120px 120px 130px 100px" head={['SL', 'Delivery', 'Customer', 'Order', 'Status', 'ETA / done', 'Amount', 'Document']} onRow={x => setOpen(x.id)}
          rows={(data.rows || []).map((x, i) => ({ key: x.id, item: x, cells: [slNo(t, i), <b key="i" className="mono">{x.id}</b>, <span key="c"><b>{x.customer}</b><small style={{ display: 'block', color: '#6b7388' }}>{x.address}</small></span>, x.orderId, <Chip key="s" tone={toneOf(x.status)}>{x.status === 'OnTheWay' ? 'On the way' : x.status}</Chip>, x.deliveredAt ? fDateTime(x.deliveredAt) : x.eta, <b key="a">{taka(x.amount)}</b>, <PdfButton key="p" title="Preview the delivery note as a PDF" onClick={() => setPdf(x)} />] }))} />
        <Empty t={t} /><Pager t={t} />
      </section>
      {pdf && <PdfPreview url={`/api/field/deliveries/${pdf.id}/pdf`} title={pdf.id + ' · Delivery note'} filename={`${pdf.id}.pdf`} onClose={() => setPdf(null)} />}
      {open && (
        <Drawer title={open} sub={d ? `${d.customer} · ${d.status}` : 'Loading…'} onClose={() => setOpen(null)}>
          {!d ? <Skeleton rows={7} /> : (
            <>
              <div className="fd-facts">
                <Fact k="Order">{d.orderId}</Fact><Fact k="Customer">{d.customer}</Fact><Fact k="Contact">{[d.contact, d.phone].filter(Boolean).join(' · ')}</Fact><Fact k="Address">{d.address}</Fact>
                <Fact k="Terms">{d.terms}</Fact><Fact k="Amount">{taka(d.amount)}</Fact><Fact k="Invoice">{d.invoiceId}</Fact><Fact k="Received by">{d.receivedBy}</Fact><Fact k="Delivered">{d.deliveredAt && fDateTime(d.deliveredAt)}</Fact>
              </div>
              <div className="fd-sub-row">{d.lines.map(l => <div key={l.id}><span>{l.name}</span><em>{l.qty} × {taka(l.price)}</em><b>{taka(l.qty * l.price)}</b></div>)}</div>
              <div className="fd-bar">
                <Chip tone={d.hasPhoto ? 'ok' : 'off'}>Photo {d.hasPhoto ? 'taken' : 'not yet'}</Chip><Chip tone={d.hasSignature ? 'ok' : 'off'}>Signature {d.hasSignature ? 'taken' : 'not yet'}</Chip><Chip tone={d.otpOk ? 'ok' : 'off'}>OTP {d.otpOk ? 'verified' : 'not used'}</Chip><Chip tone={d.gps ? 'ok' : 'off'}>GPS {d.gps ? 'recorded' : 'none'}</Chip>
              </div>
              <div className="fd-bar">
                <PdfButton title="Preview the delivery note as a PDF" label="Delivery note PDF" onClick={() => setPdf(d)} />
                {d.hasPhoto && <button type="button" className="a-mini" onClick={() => viewFieldFile(`/api/field/deliveries/${d.id}/proof/photo`).catch(() => {})}>View delivery photo</button>}
                {d.hasSignature && <button type="button" className="a-mini" onClick={() => viewFieldFile(`/api/field/deliveries/${d.id}/proof/signature`).catch(() => {})}>View signature</button>}
              </div>
            </>
          )}
        </Drawer>
      )}
    </>
  );
}

/* ---------------- contacts ---------------- */
export function FieldContacts() {
  const t = useTable('/contacts', { type: 'all', q: '', size: 25 }, [], fld);
  const [off, setOff] = useState([]);
  useEffect(() => { fld.get('/contacts/office').then(setOff).catch(() => {}); }, []);
  const data = t.data, ready = data.online !== undefined;
  return (
    <>
      <Summary items={[
        ['Contacts', ready ? data.total : '…', 'team, customers, vendors', 'blue', 'users'],
        ['Online now', data.online ?? '…', 'clocked in', 'green', 'check'],
        ['Head office lines', off.length, 'shared numbers', 'violet', 'tag']
      ]} />
      <Notice err={t.error} />
      <ListFilter t={t} noun="contact" title="Search contacts" search={{ placeholder: 'Name, company or phone' }} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={t.params.type} onChange={k => t.set({ type: k })} items={[['all', 'All'], ['team', 'Team'], ['customer', 'Customers'], ['vendor', 'Vendors']]} /></div>
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="40px minmax(170px,1.3fr) 100px minmax(170px,1.3fr) 120px minmax(250px,1.6fr)" head={['SL', 'Name', 'Type', 'Company / title', 'Phone', 'Email']}
          rows={(data.rows || []).map((x, i) => ({ key: x.key, cells: [slNo(t, i), <span className="fd-who" key="n"><Av name={x.name} /><span><b>{x.name}</b>{x.online && <small style={{ color: '#17784a' }}>● online</small>}</span></span>, <Chip key="t" tone={x.type === 'team' ? 'blue' : x.type === 'vendor' ? 'violet' : 'ok'}>{x.type}</Chip>, [x.title, x.org].filter(Boolean).join(' · ') || '—', x.phone ? <a key="p" href={'tel:' + x.phone}>{x.phone}</a> : '—', x.email ? <a key="e" href={'mailto:' + x.email}>{x.email}</a> : '—'] }))} />
        <Empty t={t} /><Pager t={t} />
        {off.length > 0 && <small className="fd-sub">Head office: {off.map(o => `${o.name} ${o.phone || ''}`.trim()).join(' · ')}</small>}
      </section>
    </>
  );
}
