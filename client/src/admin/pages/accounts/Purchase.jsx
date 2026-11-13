import { useState } from 'react';
import { fld, slNo, useTable } from '../../adminApi.js';
import { ListFilter } from '../../ListFilter.jsx';
import { Drawer, Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { Chip, Fact, Notice, Skeleton, Tabs, fDate, fDateTime, taka, toneOf, useFld } from '../../fieldKit.jsx';
import { useBusy } from '../../hooks/useBusy.js';
import { Tbl } from './shared.jsx';

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
  const [deciding, runDecide] = useBusy();
  const by = po.data.summary?.by || {};
  const sum = s => by[s]?.grand || 0;
  const d = det.data;
  const decide = status => runDecide(async () => {
    setMsg('');
    try { await fld.put(`/approvals/purchase/${open}/decision`, { status, remarks: rej.trim() }); setReject(false); setRej(''); po.reload(); det.reload(); } catch (e) { setMsg(e.message); }
  });
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
                ? <div className="fd-rej"><textarea className="a-input" rows={2} placeholder="Reason for rejecting (the buyer sees this)" value={rej} onChange={e => setRej(e.target.value)} autoFocus /><div><button type="button" className="a-mini" onClick={() => setReject(false)}>Cancel</button><button type="button" className="a-mini bad" disabled={!rej.trim() || deciding} onClick={() => decide('rejected')}>Confirm reject</button></div></div>
                : <div className="fd-apa"><button type="button" className="a-mini ok" disabled={deciding} onClick={() => decide('approved')}>Approve this step</button><button type="button" className="a-mini" onClick={() => setReject(true)}>Reject</button></div>)}
            </>
          )}
        </Drawer>
      )}
    </>
  );
}
