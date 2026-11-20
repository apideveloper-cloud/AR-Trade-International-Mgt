import { useState } from 'react';
import { fld, slNo, useTable, viewFieldFile } from '../../adminApi.js';
import { Drawer, Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Chip, Fact, Notice, PdfButton, PdfPreview, Skeleton, Tabs, fDateTime, taka, toneOf, useFld } from '../../fieldKit.jsx';
import { Rows } from './Rows.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/field.js';
import './fieldSales.css';

/** Delivery notes: pending / delivered list, proof chips and PDF preview. */
export function FieldDeliveries() {
  const tr = useT();
  const t = useTable('/deliveries', { status: 'pending', q: '', from: '', to: '', size: 25 }, [], fld);
  const [open, setOpen] = useState(null);
  const [pdf, setPdf] = useState(null);
  const det = useFld(open ? '/deliveries/' + open : null);
  const data = t.data, c = data.counts || {};
  const d = det.data?.id === open ? det.data : null; // the previously opened note stays in det.data while the next one loads: do not show it under the new number
  return (
    <>
      <Summary items={[
        [tr('Pending'), c.pending ?? '…', tr('to deliver'), 'amber', 'truck'],
        [tr('Delivered'), c.delivered ?? '…', tr('with proof'), 'green', 'check'],
        [tr('Pending value'), taka(data.pendingAmount), tr('still to be delivered'), 'red', 'money'],
        [tr('Completion'), (data.percent ?? 0) + '%', tr('delivered of all'), 'blue', 'box']
      ]} />
      <Notice err={t.error && tr(t.error)} onRetry={t.reload} />
      <ListFilter t={t} noun="delivery note" title="Search deliveries" search={{ placeholder: 'Customer, delivery or order no, address' }} range={{ label: 'Created' }} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={t.params.status} onChange={k => t.set({ status: k })} items={[['pending', tr('Pending'), c.pending], ['delivered', tr('Delivered'), c.delivered], ['all', tr('All'), c.all]]} /></div>
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="44px 120px minmax(200px,2fr) 150px 120px 120px 130px 100px" head={['SL', 'Delivery', 'Customer', 'Order', 'Status', 'ETA / done', 'Amount', 'Document']} onRow={x => setOpen(x.id)}
          rows={(data.rows || []).map((x, i) => ({ key: x.id, item: x, cells: [slNo(t, i), <b key="i" className="mono">{x.id}</b>, <span key="c"><b>{x.customer}</b><small className="fd-addr">{x.address}</small></span>, x.orderId, <Chip key="s" tone={toneOf(x.status)}>{tr(x.status === 'OnTheWay' ? 'On the way' : x.status)}</Chip>, x.deliveredAt ? fDateTime(x.deliveredAt) : x.eta, <b key="a">{taka(x.amount)}</b>, <PdfButton key="p" title={tr('Preview the delivery note as a PDF')} onClick={() => setPdf(x)} />] }))} />
        <Empty t={t} /><Pager t={t} />
      </section>
      {pdf && <PdfPreview url={`/api/field/deliveries/${pdf.id}/pdf`} title={pdf.id + ' · ' + tr('Delivery note')} filename={`${pdf.id}.pdf`} onClose={() => setPdf(null)} />}
      {open && (
        <Drawer title={open} sub={d ? `${d.customer} · ${tr(d.status === 'OnTheWay' ? 'On the way' : d.status)}` : tr('Loading…')} onClose={() => setOpen(null)}>
          {!d ? (det.err ? <Notice err={tr(det.err)} onRetry={det.reload} /> : <Skeleton rows={7} />) : (
            <>
              <div className="fd-facts">
                <Fact k={tr('Order')}>{d.orderId}</Fact><Fact k={tr('Customer')}>{d.customer}</Fact><Fact k={tr('Contact')}>{[d.contact, d.phone].filter(Boolean).join(' · ')}</Fact><Fact k={tr('Address')}>{d.address}</Fact>
                <Fact k={tr('Terms')}>{d.terms}</Fact><Fact k={tr('Amount')}>{taka(d.amount)}</Fact><Fact k={tr('Invoice')}>{d.invoiceId}</Fact><Fact k={tr('Received by')}>{d.receivedBy}</Fact><Fact k={tr('Delivered')}>{d.deliveredAt && fDateTime(d.deliveredAt)}</Fact>
              </div>
              <div className="fd-sub-row">{d.lines.map(l => <div key={l.id}><span>{l.name}</span><em>{l.qty} × {taka(l.price)}</em><b>{taka(l.qty * l.price)}</b></div>)}</div>
              <div className="fd-bar">
                <Chip tone={d.hasPhoto ? 'ok' : 'off'}>{d.hasPhoto ? tr('Photo taken') : tr('Photo not yet')}</Chip><Chip tone={d.hasSignature ? 'ok' : 'off'}>{d.hasSignature ? tr('Signature taken') : tr('Signature not yet')}</Chip><Chip tone={d.otpOk ? 'ok' : 'off'}>{d.otpOk ? tr('OTP verified') : tr('OTP not used')}</Chip><Chip tone={d.gps ? 'ok' : 'off'}>{d.gps ? tr('GPS recorded') : tr('GPS none')}</Chip>
              </div>
              <div className="fd-bar">
                <PdfButton title={tr('Preview the delivery note as a PDF')} label={tr('Delivery note PDF')} onClick={() => setPdf(d)} />
                {d.hasPhoto && <button type="button" className="a-mini" onClick={() => viewFieldFile(`/api/field/deliveries/${d.id}/proof/photo`).catch(() => {})}>{tr('View delivery photo')}</button>}
                {d.hasSignature && <button type="button" className="a-mini" onClick={() => viewFieldFile(`/api/field/deliveries/${d.id}/proof/signature`).catch(() => {})}>{tr('View signature')}</button>}
              </div>
            </>
          )}
        </Drawer>
      )}
    </>
  );
}
