import { useState } from 'react';
import { invApi } from '../../../adminApi.js';
import { Drawer, alertBox, confirmBox } from '../../../ui.jsx';
import { IconBtn } from '../../../IconBtn.jsx';
import { Skeleton, fDate, fDateTime, taka } from '../../../fieldKit.jsx';
import { useInv } from '../kit/useInv.js';
import { ProdThumb } from '../kit/ProdThumb.jsx';
import { PayForm } from '../kit/PayForm.jsx';
import { initials } from '../vendors/vendorInitials.js';
import { Stage } from './Stage.jsx';
import { ApproveForm, RejectForm, StockInForm } from './ReceiptForms.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/inventory.js';

/** "Sells at ৳ 100" with the amount in bold wherever the translation puts it. */
const sellsAt = (tr, amount) => { const [a, b] = tr('Sells at {a}', { a: '@@' }).split('@@'); return <>{a}<strong>{amount}</strong>{b}</>; };

const when = v => (v ? fDateTime(v) : '');
/** One step of the Added / Approval / Stock in timeline. */
const FlowNode = ({ cls, mark, title, who, at }) => <li className={cls}><i>{mark}</i><b>{title}</b><small>{who}</small>{at && <small className="pd-at">{at}</small>}</li>;

/** The three-step progress list of a purchase. */
function Flow({ d }) {
  const tr = useT();
  const rejected = d.status === 'Rejected'; const pending = d.status === 'Pending';
  return (
    <ol className="pd-flow">
      <FlowNode cls="done" mark="✓" title={tr('Added')} who={d.by} at={when(d.createdAt)} />
      <FlowNode cls={rejected ? 'bad' : pending ? 'now' : 'done'} mark={rejected ? '✕' : pending ? 2 : '✓'} title={tr(rejected ? 'Rejected' : 'Approval')} who={pending ? tr('Waiting for approval') : d.decidedBy} at={when(d.decidedAt)} />
      <FlowNode cls={d.status === 'Stocked' ? 'done' : d.status === 'Approved' ? 'now' : ''} mark={d.status === 'Stocked' ? '✓' : 3} title={tr('Stock in')} who={d.status === 'Stocked' ? d.stockedBy : d.status === 'Approved' ? tr('Ready to stock in') : '—'} at={when(d.stockedAt)} />
    </ol>
  );
}

/** The product lines of a purchase with selling price, margin and remarks. */
function LinesCard({ d, units }) {
  const tr = useT();
  return (
    <section className="vd-card pd-lines">
      <header className="iv-lhd"><b>{tr('Products')}</b><span>{tr('{p} · {u}', { p: tr(d.lines.length === 1 ? '{n} product' : '{n} products', { n: d.lines.length }), u: tr(units === 1 ? '{n} unit' : '{n} units', { n: units }) })}</span></header>
      <div className="pd-lh"><span /><span>{tr('Product')}</span><span>{tr('Qty × buying price')}</span><span>{tr('Total')}</span></div>
      {d.lines.map((l, i) => {
        const margin = l.salePrice ? l.salePrice - Math.round(l.total / l.qty) : null;
        return (
          <div key={i} className="pd-line">
            <ProdThumb src={l.img} name={l.name} size={42} />
            <div className="pd-ln"><b>{l.name}</b>
              {l.salePrice
                ? <span className="pd-sp"><em>{sellsAt(tr, taka(l.salePrice))}</em>{margin !== null && <em className={margin >= 0 ? 'up' : 'down'}>{tr('{s}{a} / unit', { s: margin >= 0 ? '+' : '−', a: taka(Math.abs(margin)) })}</em>}</span>
                : <small className="pd-pend">{tr('Selling price not set yet')}</small>}
              {l.remarks && <small className="pd-rm">“{l.remarks}”</small>}</div>
            <span className="pd-q">{l.qty} × {taka(l.unitCost)}{l.discount ? <em>{tr('− {a} discount', { a: taka(l.discount) })}</em> : null}</span>
            <b className="pd-t">{taka(l.total)}</b>
          </div>
        );
      })}
      <div className="iv-lt-sum"><span>{tr('Total')}</span><b>{taka(d.total)}</b></div>
    </section>
  );
}

/** One purchase: details, progress, lines, payments and the approve / stock-in / pay / delete actions. */
export function ReceiptDrawer({ id, canEdit, canApprove, vendors, onClose, onChanged }) {
  const tr = useT();
  const r = useInv('/receipts/' + id); const [pay, setPay] = useState(false); const [stock, setStock] = useState(false); const [reject, setReject] = useState(false); const [appr, setAppr] = useState(false);
  const d = r.data;
  const after = () => { r.reload(); onChanged(); };
  const remove = async () => {
    if (!(await confirmBox(tr('Delete {id}? Nothing has gone into stock, so nothing else changes.', { id }), { danger: true, confirmLabel: tr('Delete') }))) return;
    try { await invApi.del('/receipts/' + id); onChanged(); onClose(); } catch (e) { alertBox(tr(e.message)); }
  };
  const billed = d && (d.status === 'Approved' || d.status === 'Stocked');
  const units = d ? d.lines.reduce((t, l) => t + l.qty, 0) : 0;
  return (
    <Drawer title={id} sub={d ? `${d.vendor} · ${taka(d.total)}` : tr('Loading…')} onClose={onClose}>
      {!d ? <Skeleton rows={6} /> : (
        <>
          <section className="pd-hero pd-top">
            <div className="pd-h-l">
              <span className="pd-h-av" aria-hidden="true">{initials(d.vendor)}</span>
              <div className="pd-h-v"><b>{d.vendor}</b><span>{d.vendorCode && <i className="mono">{d.vendorCode}</i>}<i className="mono">{d.invoiceNo || '—'}</i></span></div>
            </div>
            <div className="pd-h-r"><small>{tr('Purchase total')}</small><strong>{taka(d.total)}</strong><Stage s={d.status} /></div>
            <div className="pd-h-meta">
              <span><small>{tr('Purchase date')}</small>{fDate(d.date)}</span>
              <span><small>{tr('Reference no.')}</small>{d.referenceNo || '—'}</span>
              <span><small>{tr('Entered by')}</small>{d.by}</span>
              <span><small>{tr('Purchase order')}</small>{d.poId || '—'}</span>
            </div>
          </section>
          <Flow d={d} />
          {d.decisionNote && <div className={'pd-note ' + (d.status === 'Rejected' ? 'bad' : '')}><b>{tr(d.status === 'Rejected' ? 'Rejected' : 'Approval note')}</b>{d.decisionNote}</div>}
          <div className="vd-stats pd-stats3">
            <div><small>{tr('Units')}</small><b>{units}</b></div>
            <div><small>{tr('Paid')}</small><b>{billed ? taka(d.paid) : '—'}</b></div>
            <div className={'vd-bal ' + (!billed ? '' : d.due ? 'bad' : 'ok')}><small>{tr(billed ? 'Balance' : 'Not billed yet')}</small><b>{billed ? (d.due ? tr('{a} due', { a: taka(d.due) }) : tr('Fully paid')) : '—'}</b></div>
          </div>
          {d.note && <div className="pd-note"><b>{tr('Note')}</b>{d.note}</div>}
          <LinesCard d={d} units={units} />
          {!!d.payments.length && (
            <section className="vd-card">
              <header className="iv-lhd"><b>{tr('Payments on this bill')}</b><span>{d.payments.length}</span></header>
              <div className="fd-sub-row pd-pay-rows">{d.payments.map(p => <div key={p.id}><span>{fDate(p.date)} · {tr(p.method)}{p.reference ? ' · ' + p.reference : ''}</span><em className="mono">{p.id}</em><b>{taka(p.amount)}</b></div>)}</div>
            </section>
          )}
          <div className="pd-bar">
            {d.status === 'Pending' && canApprove && <button type="button" className="a-btn sm grad" onClick={() => setAppr(true)}>{tr('Approve…')}</button>}
            {d.status === 'Pending' && canApprove && <button type="button" className="a-btn sm ghost pd-rej" onClick={() => setReject(true)}>{tr('Reject')}</button>}
            {d.status === 'Pending' && !canApprove && <small className="fd-sub">{tr('Waiting for a Master Admin or Admin to approve.')}</small>}
            {d.status === 'Approved' && canEdit && <button type="button" className="a-btn sm grad" onClick={() => setStock(true)}>{tr('Stock in')}</button>}
            {d.status === 'Approved' && !canEdit && <small className="fd-sub">{tr('Approved. Waiting to be stocked in.')}</small>}
            {billed && canEdit && d.due > 0 && <button type="button" className="a-btn sm ghost" onClick={() => setPay(true)}>{tr('Record payment')}</button>}
            <span className="vd-sp" />
            {(d.status === 'Pending' || d.status === 'Rejected') && canEdit && <IconBtn icon="trash" tone="bad" title={tr('Delete this purchase')} onClick={remove} />}
          </div>
        </>
      )}
      {pay && d && <PayForm vendors={vendors} vendor={String(d.vendorId)} receipt={d.id} due={d.due} onClose={() => setPay(false)} onSaved={after} />}
      {appr && d && <ApproveForm d={d} onClose={() => setAppr(false)} onSaved={after} />}
      {stock && d && <StockInForm d={d} onClose={() => setStock(false)} onSaved={after} />}
      {reject && <RejectForm id={id} onClose={() => setReject(false)} onSaved={after} />}
    </Drawer>
  );
}
