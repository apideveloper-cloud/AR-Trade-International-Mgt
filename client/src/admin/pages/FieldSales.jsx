import { useEffect, useState } from 'react';
import { fld, viewFieldFile } from '../adminApi.js';
import { Drawer, Summary } from '../ui.jsx';
import { Av, Chip, Fact, Grid, Notice, PdfButton, PdfPreview, Skeleton, Tabs, fDate, fDateTime, fTime, taka, toneOf, todayBd, useDebounced, useFld } from '../fieldKit.jsx';

// Web views of the field app's sales side: customers (CRM), visits and follow-ups, sales orders, deliveries and the contact directory.

/* ---------------- customers ---------------- */
export function FieldCustomers() {
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [open, setOpen] = useState(null);
  const { data, err, loading, reload } = useFld(`/customers?kind=${kind}&q=${encodeURIComponent(dq)}`);
  const items = data?.items || [], c = data?.counts || {};
  const due = items.reduce((t, x) => t + (x.due || 0), 0);
  return (
    <>
      <Summary items={[
        ['Field customers', c.all ?? '…', 'in the CRM', 'blue', 'users'],
        ['Active', c.active ?? '…', 'have ordered', 'green', 'check'],
        ['Upcoming', c.upcoming ?? '…', 'leads to win', 'violet', 'plus'],
        ['Dues (listed)', taka(due), 'unpaid invoices', 'red', 'money']
      ]} />
      <Notice err={err} onRetry={reload} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={kind} onChange={setKind} items={[['all', 'All', c.all], ['active', 'Active', c.active], ['upcoming', 'Upcoming', c.upcoming]]} />
          <input className="a-input fd-q" placeholder="Search name, contact or area…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search customers" /></div>
        {loading && !data ? <span className="spin" /> : (
          <Grid search={false} cols="44px minmax(220px,2fr) 140px 130px 110px 110px 120px" head={['SL', 'Customer', 'Phone', 'Area', 'Type', 'Status', 'Due']} onRow={setOpen} empty="No customers match."
            rows={items.map((x, i) => ({ key: x.id, item: x, cells: [i + 1, <span className="fd-who" key="n"><Av name={x.name} /><span><b>{x.name}</b><small>{[x.contact, x.contactRole].filter(Boolean).join(' · ')}</small></span></span>, x.phone, x.area || '—', x.type || '—', <Chip key="s" tone={toneOf(x.kind)}>{x.kind}</Chip>, x.due ? <b key="d" style={{ color: '#b3261e' }}>{taka(x.due)}</b> : '—'] }))} />
        )}
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
  const [date, setDate] = useState('');
  const [tab, setTab] = useState('visits');
  const [bucket, setBucket] = useState('all');
  const staff = sid || (people.find(p => p.role === 'rm')?.id ?? people[0]?.id ?? '');
  const sp = staff ? `&staff_id=${staff}` : '';
  const v = useFld(`/visits?date=${date || todayBd()}${sp}`);
  const f = useFld(`/followups?bucket=${bucket}${sp}`);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState(null);
  const act = async (id, what, body) => {
    setMsg('');
    try { await fld.put(`/followups/${id}/${what}`, body); setNote(null); f.reload(); } catch (e) { setMsg(e.message); }
  };
  const fc = f.data?.counts || {};
  return (
    <>
      <Notice err={v.err || f.err || msg} />
      <section className="a-card">
        <div className="fd-bar">
          <label className="fd-sel">Salesperson
            <select className="a-input" value={staff} onChange={e => setSid(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{p.name} · {p.roleLabel}</option>)}{!people.length && <option value="">Me</option>}</select>
          </label>
          <Tabs value={tab} onChange={setTab} items={[['visits', 'Visits'], ['follow', 'Follow-ups', fc.open]]} />
        </div>
        {tab === 'visits' && (
          <>
            <div className="fd-week">{(v.data?.week || []).map(d => <button key={d.date} type="button" disabled={d.off} className={(d.date === (v.data?.date) ? 'on ' : '') + (d.count ? 'has' : '')} onClick={() => setDate(d.date)}><small>{d.dn}</small><b>{d.dt}</b><em>{d.off ? 'off' : d.count || '·'}</em></button>)}</div>
            <div className="fd-bar"><span className="fd-sub">{v.data ? `${fDate(v.data.date)} · ${v.data.total} visit${v.data.total === 1 ? '' : 's'}, ${v.data.done} done` : '…'}</span><input type="date" className="a-input fd-date" style={{ width: 'auto' }} value={v.data?.date || ''} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Day" /></div>
            <div className="fd-appr">
              {(v.data?.visits || []).map(x => (
                <div key={x.id} className="fd-ap">
                  <Av name={x.customer} />
                  <div className="fd-apb">
                    <div className="fd-aph"><b>{x.customer}</b><Chip tone={toneOf(x.status)}>{x.status}</Chip><Chip tone="blue">{x.purpose}</Chip></div>
                    <div className="fd-aps">{x.time} · {x.area || x.address} {x.contact ? '· ' + x.contact : ''}</div>
                    <div className="fd-apm">{x.checkIn && <span>In {fTime(x.checkIn)}</span>}{x.checkOut && <span>Out {fTime(x.checkOut)}</span>}{x.outcome && <span><b>{x.outcome}</b></span>}{x.orderValue > 0 && <strong>{taka(x.orderValue)}</strong>}</div>
                    {x.notes && <div className="fd-apd">{x.notes}</div>}{x.followupAction && <div className="fd-apd">Follow-up: {x.followupAction}{x.followupWhen ? ' · ' + x.followupWhen : ''}</div>}
                  </div>
                </div>
              ))}
              {v.data && !v.data.visits.length && <div className="a-empty">No visits on this day for this person.</div>}
            </div>
          </>
        )}
        {tab === 'follow' && (
          <>
            <Tabs value={bucket} onChange={setBucket} items={[['all', 'All'], ['overdue', 'Overdue', fc.overdue], ['today', 'Today', fc.today], ['upcoming', 'Upcoming', fc.upcoming]]} />
            <div className="fd-appr">
              {(f.data?.items || []).map(x => (
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
              {f.data && !f.data.items.length && <div className="a-empty">No follow-ups here.</div>}
            </div>
          </>
        )}
      </section>
    </>
  );
}

/* ---------------- sales orders ---------------- */
export function FieldOrders() {
  const { data, err, loading, reload } = useFld('/orders?limit=100');
  const [open, setOpen] = useState(null);
  const [rej, setRej] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [msg, setMsg] = useState('');
  const items = data?.items || [];
  const waiting = items.filter(o => o.approval === 'Pending').length;
  const decide = async (id, status, remarks = '') => {
    setMsg('');
    try { await fld.put(`/orders/${id}/approve`, { status, remarks }); setRej(null); reload(); } catch (e) { setMsg(e.message); }
  };
  return (
    <>
      <Summary items={[
        ['Orders today', data?.summary?.ordersToday ?? '…', 'placed by the team', 'blue', 'cart'],
        ['Sales today', taka(data?.summary?.salesToday), 'after discount', 'green', 'money'],
        ['Waiting approval', waiting, 'manager decides', 'amber', 'clock'],
        ['Listed orders', items.length, taka(items.reduce((t, o) => t + o.total, 0)), 'violet', 'box']
      ]} />
      <Notice err={err || msg} onRetry={err ? reload : undefined} />
      <section className="a-card">
        {loading && !data ? <span className="spin" /> : (
          <Grid cols="44px 140px minmax(200px,2fr) 150px 110px 110px 120px 84px" head={['SL', 'Order', 'Customer', 'Taken by', 'Approval', 'Status', 'Total', 'Document']} onRow={o => setOpen(open === o.id ? null : o.id)} empty="No field orders yet."
            rows={items.flatMap((o, i) => [{ key: o.id, item: o, cells: [i + 1, <b key="i" className="mono">{o.id}</b>, <span key="c"><b>{o.customer}</b><small style={{ display: 'block', color: '#6b7388' }}>{fDateTime(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}</small></span>, o.by, <Chip key="a" tone={toneOf(o.approval)}>{o.approval}</Chip>, <Chip key="s" tone={toneOf(o.status)}>{o.status}</Chip>, <b key="t">{taka(o.total)}</b>, <PdfButton key="p" title="Preview the sales order as a PDF" onClick={() => setPdf(o)} />] },
              ...(open === o.id ? [{ key: o.id + '-d', item: null, full: true, cells: [<div key="x" className="fd-sub-row">
                {o.lines.map(l => <div key={l.id}><span>{l.name}</span><em>{l.qty} × {taka(l.price)}</em><b>{taka(l.qty * l.price)}</b></div>)}
                <div className="fd-sub-sum">Subtotal {taka(o.subtotal)} · Discount {taka(o.discount)} · <b>Total {taka(o.total)}</b>{o.synced ? ' · posted to accounts' : ''}</div>
                {o.notes && <div className="fd-apd">Note: {o.notes}</div>}
                <div className="fd-apa" style={{ justifyContent: 'flex-start' }}><PdfButton title="Preview the sales order as a PDF" label="PDF preview" onClick={() => setPdf(o)} /></div>
                {o.approval === 'Pending' && (rej === o.id
                  ? <div className="fd-rej"><textarea id={'rj' + o.id} className="a-input" rows={2} placeholder="Reason for rejecting" autoFocus /><div><button type="button" className="a-mini" onClick={() => setRej(null)}>Cancel</button><button type="button" className="a-mini bad" onClick={() => decide(o.id, 'rejected', document.getElementById('rj' + o.id).value.trim())}>Confirm reject</button></div></div>
                  : <div className="fd-apa"><button type="button" className="a-mini ok" onClick={() => decide(o.id, 'approved')}>Approve</button><button type="button" className="a-mini" onClick={() => setRej(o.id)}>Reject</button></div>)}
              </div>] }] : [])])} />
        )}
      </section>
      {pdf && <PdfPreview url={`/api/field/orders/${pdf.id}/pdf`} title={pdf.id} filename={`${pdf.id}.pdf`} onClose={() => setPdf(null)} />}
    </>
  );
}

/* ---------------- deliveries ---------------- */
export function FieldDeliveries() {
  const [st, setSt] = useState('pending');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [open, setOpen] = useState(null);
  const [pdf, setPdf] = useState(null);
  const { data, err, loading, reload } = useFld(`/deliveries?status=${st}&q=${encodeURIComponent(dq)}`);
  const det = useFld(open ? '/deliveries/' + open : null);
  const c = data?.counts || {};
  const d = det.data;
  return (
    <>
      <Summary items={[
        ['Pending', c.pending ?? '…', 'to deliver', 'amber', 'truck'],
        ['Delivered', c.delivered ?? '…', 'with proof', 'green', 'check'],
        ['Pending value', taka(data?.pendingAmount), 'still to be delivered', 'red', 'money'],
        ['Completion', (data?.percent ?? 0) + '%', 'delivered of all', 'blue', 'box']
      ]} />
      <Notice err={err} onRetry={reload} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={st} onChange={setSt} items={[['pending', 'Pending', c.pending], ['delivered', 'Delivered', c.delivered], ['all', 'All', c.all]]} />
          <input className="a-input fd-q" placeholder="Search customer or delivery no…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search deliveries" /></div>
        {loading && !data ? <span className="spin" /> : (
          <Grid search={false} cols="44px 120px minmax(200px,2fr) 150px 120px 120px 130px 100px" head={['SL', 'Delivery', 'Customer', 'Order', 'Status', 'ETA / done', 'Amount', 'Document']} onRow={x => setOpen(x.id)} empty="No deliveries."
            rows={(data?.items || []).map((x, i) => ({ key: x.id, item: x, cells: [i + 1, <b key="i" className="mono">{x.id}</b>, <span key="c"><b>{x.customer}</b><small style={{ display: 'block', color: '#6b7388' }}>{x.address}</small></span>, x.orderId, <Chip key="s" tone={toneOf(x.status)}>{x.status === 'OnTheWay' ? 'On the way' : x.status}</Chip>, x.deliveredAt ? fDateTime(x.deliveredAt) : x.eta, <b key="a">{taka(x.amount)}</b>, <PdfButton key="p" title="Preview the delivery note as a PDF" onClick={() => setPdf(x)} />] }))} />
        )}
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
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, err, loading } = useFld(`/contacts?type=${type}&q=${encodeURIComponent(dq)}`);
  const [off, setOff] = useState([]);
  useEffect(() => { fld.get('/contacts/office').then(setOff).catch(() => {}); }, []);
  return (
    <>
      <Summary items={[
        ['Contacts', data?.total ?? '…', 'team, customers, vendors', 'blue', 'users'],
        ['Online now', data?.online ?? '…', 'clocked in', 'green', 'check'],
        ['Head office lines', off.length, 'shared numbers', 'violet', 'tag']
      ]} />
      <Notice err={err} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={type} onChange={setType} items={[['all', 'All'], ['team', 'Team'], ['customer', 'Customers'], ['vendor', 'Vendors']]} />
          <input className="a-input fd-q" placeholder="Search name, company or phone…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search contacts" /></div>
        {loading && !data ? <span className="spin" /> : (
          <Grid search={false} cols="44px minmax(220px,2fr) 120px minmax(160px,1fr) 150px minmax(180px,1fr)" head={['SL', 'Name', 'Type', 'Company / title', 'Phone', 'Email']} empty="No contacts match."
            rows={(data?.contacts || []).map((x, i) => ({ key: x.key, cells: [i + 1, <span className="fd-who" key="n"><Av name={x.name} /><span><b>{x.name}</b>{x.online && <small style={{ color: '#17784a' }}>● online</small>}</span></span>, <Chip key="t" tone={x.type === 'team' ? 'blue' : x.type === 'vendor' ? 'violet' : 'ok'}>{x.type}</Chip>, [x.title, x.org].filter(Boolean).join(' · ') || '—', x.phone ? <a key="p" href={'tel:' + x.phone}>{x.phone}</a> : '—', x.email ? <a key="e" href={'mailto:' + x.email}>{x.email}</a> : '—'] }))} />
        )}
        {off.length > 0 && <small className="fd-sub">Head office: {off.map(o => `${o.name} ${o.phone || ''}`.trim()).join(' · ')}</small>}
      </section>
    </>
  );
}
