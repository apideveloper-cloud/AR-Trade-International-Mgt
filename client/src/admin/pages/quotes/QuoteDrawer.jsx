import { useState } from 'react';
import { quoteApi } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Drawer, alertBox, confirmBox } from '../../ui.jsx';
import { Chip, Fact, PdfButton, Skeleton, fDate, taka } from '../../fieldKit.jsx';
import { QuoteForm } from './QuoteForm.jsx';
import { EmailQuote, QuotePreview, sendWhatsApp } from './QuoteMail.jsx';
import { Status } from './shared.jsx';
import '../sales/salesInline.css';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

export function QuoteDrawer({ id, canEdit, staff, onClose, onChanged }) {
  const tr = useT();
  const q = useApiData(() => quoteApi.get('/' + id), [id]);
  const d = q.data, err = q.error, load = q.reload;
  const [pdf, setPdf] = useState(false); const [edit, setEdit] = useState(null); const [mail, setMail] = useState(null);
  const setStatus = async status => {
    try { await quoteApi.post(`/${id}/status`, { status }); await load(); onChanged(); } catch (e) { alertBox(tr(e.message)); }
  };
  const remove = async () => {
    if (!(await confirmBox(tr('Delete {id}?', { id }), { danger: true, confirmLabel: tr('Delete') }))) return;
    try { await quoteApi.del('/' + id); onChanged(); onClose(); } catch (e) { alertBox(tr(e.message)); }
  };
  const locked = d?.status === 'Accepted';
  return (
    <Drawer title={id} sub={d ? `${d.toName} · ${taka(d.net)}` : tr('Loading…')} onClose={onClose}>
      {err && <div className="a-msg err">{tr(err)}</div>}
      {!d ? !err && <Skeleton rows={6} /> : (
        <>
          <div className="fd-facts">
            <Fact k={tr('Status')}><Status s={d.status} /></Fact><Fact k={tr('Date')}>{fDate(d.date)}</Fact><Fact k={tr('To')}>{d.toName} <Chip tone={d.custType === 'Upcoming' ? 'amber' : d.custType === 'New' ? 'blue' : 'ok'}>{tr(d.custType.toLowerCase())}</Chip></Fact><Fact k={tr('Attend')}>{[d.attend, d.desig].filter(Boolean).join(' · ')}</Fact>
            <Fact k={tr('Mobile')}>{d.mobile}</Fact><Fact k={tr('Email')}>{d.email}</Fact><Fact k={tr('Address')}>{d.address}</Fact><Fact k={tr('Valid for')}>{tr('{n} days', { n: d.validDays })}</Fact><Fact k={tr('Written by')}>{d.by}</Fact>
          </div>
          {d.subject && <p className="qt-subj">{d.subject}</p>}
          <div className="fd-sub-row">{d.lines.map((l, i) => <div key={i}><span>{l.description}{l.warranty ? <small className="sinl-warranty">{tr('Warranty: {w}', { w: l.warranty })}</small> : null}</span><em>{l.qty} {l.unit} × {taka(l.unitPrice)}</em><b>{taka(l.amount)}</b></div>)}</div>
          <dl className="qt-tot">
            <div><dt>{tr('Total amount')}</dt><dd>{taka(d.total)}</dd></div>
            {d.install > 0 && <div><dt>{tr('Installation / service')}</dt><dd>{taka(d.install)}</dd></div>}
            {d.transport > 0 && <div><dt>{tr('Transportation')}</dt><dd>{taka(d.transport)}</dd></div>}
            {d.discount > 0 && <div><dt>{tr('Discount')}</dt><dd>−{taka(d.discount)}</dd></div>}
            {d.vat > 0 && <div><dt>{tr('VAT')}</dt><dd>{taka(d.vat)}</dd></div>}
            <div className="net"><dt>{tr('Net payable')}</dt><dd>{taka(d.net)}</dd></div>
          </dl>
          <div className="fd-apa">
            <PdfButton onClick={() => setPdf(true)} title={tr('Preview as PDF')} />
            {canEdit && <button type="button" className="a-mini" onClick={() => setMail({ to: d.email || '', message: '' })}>{tr('✉ Email')}</button>}
            {canEdit && <button type="button" className="a-mini wa" onClick={async () => { await sendWhatsApp(d, tr); load(); onChanged(); }}>WhatsApp</button>}
            {canEdit && d.status === 'Draft' && <button type="button" className="a-mini ok" onClick={() => setStatus('Sent')}>{tr('Mark as sent')}</button>}
            {canEdit && d.status === 'Sent' && <><button type="button" className="a-mini ok" onClick={() => setStatus('Accepted')}>{tr('Accepted')}</button><button type="button" className="a-mini bad" onClick={() => setStatus('Rejected')}>{tr('Rejected')}</button></>}
            {canEdit && (d.status === 'Rejected' || d.status === 'Sent') && <button type="button" className="a-mini" onClick={() => setStatus('Draft')}>{tr('Back to draft')}</button>}
            {canEdit && !locked && <button type="button" className="a-mini" onClick={() => setEdit('edit')}>{tr('Edit')}</button>}
            {canEdit && <button type="button" className="a-mini" onClick={() => setEdit('copy')}>{tr('Make a copy')}</button>}
            {canEdit && (d.status === 'Draft' || d.status === 'Rejected') && <button type="button" className="a-mini bad" onClick={remove}>{tr('Delete')}</button>}
          </div>
        </>
      )}
      {pdf && <QuotePreview id={id} canEdit={canEdit} onClose={() => setPdf(false)} onSent={() => { load(); onChanged(); }} />}
      {edit && d && <QuoteForm quote={d} copy={edit === 'copy'} staff={staff} onClose={() => setEdit(null)} onSaved={() => { load(); onChanged(); }} onPreview={(_, mode) => (mode === 'email' ? setMail({ to: d.email || '', message: '' }) : setPdf(true))} />}
      {mail && d && <EmailQuote d={d} mail={mail} setMail={setMail} onSent={() => { load(); onChanged(); }} />}
    </Drawer>
  );
}
