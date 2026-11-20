import { useState } from 'react';
import { fld, slNo, useTable } from '../../adminApi.js';
import { ListFilter } from '../../ListFilter.jsx';
import { Drawer, Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { Chip, Fact, Notice, Skeleton, Tabs, fDate, fDateTime, taka, toneOf, useFld } from '../../fieldKit.jsx';
import { useBusy } from '../../hooks/useBusy.js';
import { Tbl } from './shared.jsx';
import { Rich } from '../growth/parts.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

const PO_STATUS = [{ v: 'draft', t: 'Draft' }, { v: 'submitted', t: 'Submitted' }, { v: 'manager_approved', t: 'Manager approved' }, { v: 'approved', t: 'Approved' }, { v: 'rejected', t: 'Rejected' }];

export function AccPurchase() {
  const tr = useT();
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
  const d = det.data?.id === open ? det.data : null; // the previous order stays in det.data while the next one loads: never show it (or decide on it) under another number
  const decide = status => runDecide(async () => {
    setMsg('');
    try { await fld.put(`/approvals/purchase/${open}/decision`, { status, remarks: rej.trim() }); setReject(false); setRej(''); po.reload(); det.reload(); } catch (e) { setMsg(e.message); }
  });
  return (
    <>
      <Summary items={[
        [tr('Purchase orders'), po.data.summary?.count ?? '…', po.params.q || po.params.from || po.params.to ? tr('matching your search') : tr('all time'), 'blue', 'box'],
        [tr('Waiting for approval'), taka(sum('submitted') + sum('manager_approved')), tr('manager, then accountant'), 'amber', 'clock'],
        [tr('Approved'), taka(sum('approved')), tr('ready to order'), 'green', 'check'],
        [tr('Rejected'), taka(sum('rejected')), tr('sent back'), 'red', 'alert']
      ]} />
      <Notice err={(po.error || pr.err || vd.err) && tr(po.error || pr.err || vd.err)} onRetry={po.reload} />
      <section className="a-card">
        <Tabs value={tab} onChange={setTab} items={[['orders', tr('Purchase orders')], ['requests', tr('Requisitions')], ['vendors', tr('Vendors')]]} />
        {tab === 'requests' && (pr.loading && !pr.data ? <span className="spin" /> : (
          <Tbl t={{ loading: false }} cols="44px 100px minmax(220px,2fr) 90px 130px 140px 130px" head={['SL', 'Requisition', 'Product', 'Qty', 'Need by', 'Stock now / min', 'Best quote']}
            rows={(pr.data?.items || []).map((r, i) => ({ key: r.id, cells: [i + 1, <b key="i" className="mono">{r.id}</b>, <span key="p"><b>{r.product}</b><small style={{ display: 'block', color: '#6b7388' }}>{r.requestedBy} · {tr('{n} quotes', { n: r.quoteCount })}</small></span>, r.qty, r.needBy ? fDate(r.needBy) : '—', <Chip key="s" tone={r.stock?.low ? 'bad' : 'ok'}>{r.stock?.now} / {r.stock?.min}</Chip>, r.lowest ? taka(r.lowest) : '—'] }))} />
        ))}
        {tab === 'requests' && pr.data && !pr.data.items.length && <div className="a-empty">{tr('No open requisitions.')}</div>}
        {tab === 'vendors' && (vd.loading && !vd.data ? <span className="spin" /> : (
          <Tbl t={{ loading: false }} cols="44px minmax(200px,2fr) minmax(200px,2fr) 160px" head={['SL', 'Vendor', 'Kind', 'Phone']}
            rows={(vd.data?.items || []).map((v, i) => ({ key: v.id, cells: [i + 1, <b key="n">{v.name}</b>, tr(v.kind), v.phone ? <a key="p" href={'tel:' + v.phone}>{v.phone}</a> : '—'] }))} />
        ))}
        {tab === 'vendors' && vd.data && !vd.data.items.length && <div className="a-empty">{tr('No vendors.')}</div>}
      </section>
      {tab === 'orders' && (
        <>
          <ListFilter t={po} noun="purchase order" title="Search purchase orders" search={{ placeholder: 'PO number, vendor or buyer' }} range={{ label: 'Created' }}
            selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: PO_STATUS }]} />
          <Toolbar t={po} search={false} />
          <section className="a-card">
            <Tbl t={po} cols="44px 110px minmax(180px,1.6fr) 150px 120px 130px 130px" head={['SL', 'PO', 'Vendor', 'Raised by', 'Status', 'Deliver by', 'Grand total']} onRow={p => { setOpen(p.id); setReject(false); setMsg(''); }}
              rows={po.data.rows.map((p, i) => ({ key: p.id, item: p, cells: [slNo(po, i), <b key="i" className="mono">{p.id}{p.rev ? ' r' + p.rev : ''}</b>, p.vendor, p.by, <Chip key="s" tone={toneOf(p.status)}>{tr(p.statusLabel)}</Chip>, p.deliverBy ? fDate(p.deliverBy) : '—', <span key="g"><b>{taka(p.grand)}</b>{!p.within && <small style={{ display: 'block', color: '#b3261e' }}>{tr('over budget by {amount}', { amount: taka(p.over) })}</small>}</span>] }))} />
            <Empty t={po} />
          </section>
          <Pager t={po} />
        </>
      )}
      {open && (
        <Drawer title={open} sub={d ? `${d.vendor} · ${tr(d.statusLabel)}` : tr('Loading…')} onClose={() => setOpen(null)}>
          {!d ? (det.err ? <Notice err={det.err && tr(det.err)} onRetry={det.reload} /> : <Skeleton rows={7} />) : (
            <>
              <div className="fd-facts">
                <Fact k={tr('Vendor')}>{d.vendor}</Fact><Fact k={tr('Raised by')}>{d.by}</Fact><Fact k={tr('Deliver by')}>{d.deliverBy && fDate(d.deliverBy)}</Fact><Fact k={tr('Deliver to')}>{d.deliverTo}</Fact><Fact k={tr('Payment terms')}>{d.paymentTerms}</Fact><Fact k={tr('Note')}>{d.note}</Fact>
                <Fact k={tr('Budget')}>{d.within ? tr('Within budget') : tr('Over by {amount}', { amount: taka(d.over) })}</Fact><Fact k={tr('Submitted')}>{d.submittedAt && fDateTime(d.submittedAt)}</Fact>
              </div>
              <div className="fd-sub-row">{d.lines.map(l => <div key={l.id}><span>{l.name}{l.sku ? ' · ' + l.sku : ''}</span><em>{l.qty} × {taka(l.unitPrice)}</em><b>{taka(l.total)}</b></div>)}
                <div className="fd-sub-sum"><Rich text={tr('Subtotal {sub} · VAT {vat} · Freight {freight} · <b>Grand total {grand}</b>', { sub: taka(d.subtotal), vat: taka(d.vat), freight: taka(d.freight), grand: taka(d.grand) })} /></div></div>
              <Notice err={msg && tr(msg)} />
              {['submitted', 'manager_approved'].includes(d.status) && (reject
                ? <div className="fd-rej"><textarea className="a-input" rows={2} placeholder={tr('Reason for rejecting (the buyer sees this)')} value={rej} onChange={e => setRej(e.target.value)} autoFocus /><div><button type="button" className="a-mini" onClick={() => setReject(false)}>{tr('Cancel')}</button><button type="button" className="a-mini bad" disabled={!rej.trim() || deciding} onClick={() => decide('rejected')}>{tr('Confirm reject')}</button></div></div>
                : <div className="fd-apa"><button type="button" className="a-mini ok" disabled={deciding} onClick={() => decide('approved')}>{tr('Approve this step')}</button><button type="button" className="a-mini" onClick={() => setReject(true)}>{tr('Reject')}</button></div>)}
            </>
          )}
        </Drawer>
      )}
    </>
  );
}
