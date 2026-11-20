import { useState } from 'react';
import { fld, slNo, useTable } from '../../adminApi.js';
import { Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Chip, Notice, PdfButton, PdfPreview, fDateTime, taka, toneOf } from '../../fieldKit.jsx';
import { Rows } from './Rows.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/field.js';
import { Rich } from '../growth/parts.jsx';
import './fieldSales.css';

/** Sales orders: approve or reject pending ones, expand the lines, preview the PDF. */
export function FieldOrders() {
  const tr = useT();
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
        [tr('Orders today'), data.summary?.ordersToday ?? '…', tr('placed by the team'), 'blue', 'cart'],
        [tr('Sales today'), taka(data.summary?.salesToday), tr('after discount'), 'green', 'money'],
        [tr('Waiting approval'), data.pending ?? '…', tr('in this list · manager decides'), 'amber', 'clock'],
        [tr('Matching orders'), data.total, taka(data.amount), 'violet', 'box']
      ]} />
      <Notice err={(t.error || msg) && tr(t.error || msg)} onRetry={t.error ? t.reload : undefined} />
      <ListFilter t={t} noun="order" title="Search orders" search={{ placeholder: 'Order no, customer or taken by' }}
        selects={[{ key: 'approval', label: 'Approval', all: 'All approvals', icon: 'status', options: ['Pending', 'Approved', 'Rejected'] }, { key: 'status', label: 'Status', all: 'All statuses', icon: 'box', options: ['Placed', 'Delivered', 'Cancelled'] }]}
        range={{ label: 'Order date' }} />
      <section className="a-card">
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="44px 140px minmax(200px,2fr) 150px 110px 110px 120px 84px" head={['SL', 'Order', 'Customer', 'Taken by', 'Approval', 'Status', 'Total', 'Document']} onRow={o => setOpen(open === o.id ? null : o.id)}
          rows={items.flatMap((o, i) => [{ key: o.id, item: o, cells: [slNo(t, i), <b key="i" className="mono">{o.id}</b>, <span key="c"><b>{o.customer}</b><small className="fd-addr">{fDateTime(o.createdAt)} · {o.itemCount === 1 ? tr('1 item') : tr('{n} items', { n: o.itemCount })}</small></span>, o.by, <Chip key="a" tone={toneOf(o.approval)}>{tr(o.approval)}</Chip>, <Chip key="s" tone={toneOf(o.status)}>{tr(o.status)}</Chip>, <b key="t">{taka(o.total)}</b>, <PdfButton key="p" title={tr('Preview the sales order as a PDF')} onClick={() => setPdf(o)} />] },
            ...(open === o.id ? [{ key: o.id + '-d', item: null, full: true, cells: [<div key="x" className="fd-sub-row">
              {o.lines.map(l => <div key={l.id}><span>{l.name}</span><em>{l.qty} × {taka(l.price)}</em><b>{taka(l.qty * l.price)}</b></div>)}
              <div className="fd-sub-sum"><Rich text={tr(o.synced ? 'Subtotal {sub} · Discount {disc} · <b>Total {total}</b> · posted to accounts' : 'Subtotal {sub} · Discount {disc} · <b>Total {total}</b>', { sub: taka(o.subtotal), disc: taka(o.discount), total: taka(o.total) })} /></div>
              {o.notes && <div className="fd-apd">{tr('Note: {note}', { note: o.notes })}</div>}
              <div className="fd-apa fd-apa-start"><PdfButton title={tr('Preview the sales order as a PDF')} label={tr('PDF preview')} onClick={() => setPdf(o)} /></div>
              {o.approval === 'Pending' && (rej === o.id
                ? <div className="fd-rej"><textarea id={'rj' + o.id} className="a-input" rows={2} placeholder={tr('Reason for rejecting')} autoFocus /><div><button type="button" className="a-mini" onClick={() => setRej(null)}>{tr('Cancel')}</button><button type="button" className="a-mini bad" onClick={() => decide(o.id, 'rejected', document.getElementById('rj' + o.id).value.trim())}>{tr('Confirm reject')}</button></div></div>
                : <div className="fd-apa"><button type="button" className="a-mini ok" onClick={() => decide(o.id, 'approved')}>{tr('Approve')}</button><button type="button" className="a-mini" onClick={() => setRej(o.id)}>{tr('Reject')}</button></div>)}
            </div>] }] : [])])} />
        <Empty t={t} /><Pager t={t} />
      </section>
      {pdf && <PdfPreview url={`/api/field/orders/${pdf.id}/pdf`} title={pdf.id} filename={`${pdf.id}.pdf`} onClose={() => setPdf(null)} />}
    </>
  );
}
