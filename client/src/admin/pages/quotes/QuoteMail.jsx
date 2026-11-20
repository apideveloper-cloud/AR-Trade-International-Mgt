import { useEffect, useState } from 'react';
import { quoteApi } from '../../adminApi.js';
import { Modal, alertBox } from '../../ui.jsx';
import { Notice, PdfPreview, taka } from '../../fieldKit.jsx';
import { Rich } from '../growth/parts.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

/** 01712-345678 or +8801712345678 -> 8801712345678 (what wa.me wants); anything else is passed on as typed digits. */
const waNumber = v => { const d = String(v || '').replace(/\D/g, ''); return d.startsWith('880') ? d : d.startsWith('0') && d.length === 11 ? '88' + d : d; };
/** Opens WhatsApp with a ready message and a private link to the quotation PDF. A draft becomes Sent. */
export async function sendWhatsApp(q, tr = s => s) {
  const win = window.open('about:blank', '_blank'); // opened first, in the click, so the browser does not block it
  try {
    const { token } = await quoteApi.post(`/${q.id}/share`, {});
    const link = `${window.location.origin}/api/quotes/shared/${token}.pdf`;
    const text = [`Dear ${q.attend || q.toName},`, '', `Please find our quotation ${q.id}${q.subject ? ' (' + q.subject + ')' : ''}.`, `Net payable: ${taka(q.net)} · valid for ${q.validDays} days.`, '', `View / download the PDF: ${link}`, '', `Best regards,`, q.signerName || 'AR Trade International', 'AR Trade International'].join('\n');
    const url = `https://wa.me/${waNumber(q.mobile)}?text=${encodeURIComponent(text)}`;
    if (win) win.location.href = url; else window.location.href = url;
  } catch (e) { win?.close(); alertBox(tr(e.message)); }
}

const EMAIL_RE = /^[^\s,;<>"()]+@[^\s,;<>"()]+\.[^\s,;<>"()]+$/;
/** The first address in "a@x.com, b@y.com; c@z.com" that is not an email address, or '' when all are fine. */
const badAddress = v => String(v || '').split(/[;,\s]+/).map(x => x.trim()).filter(Boolean).find(a => !EMAIL_RE.test(a)) || '';
const addressCount = v => String(v || '').split(/[;,\s]+/).filter(Boolean).length;

/** Email the quotation PDF to the customer. A draft becomes Sent once it has gone out. */
export function EmailQuote({ d, mail, setMail, onSent }) {
  const tr = useT();
  const fields = mail.fields || {};
  const put = k => e => setMail(m => ({ ...m, [k]: e.target.value, fields: { ...m.fields, [k]: '' } }));
  const send = async e => {
    e.preventDefault();
    const found = {};
    if (!String(mail.to || '').trim()) found.to = tr("Write the customer's email address.");
    else if (!EMAIL_RE.test(String(mail.to).trim())) found.to = tr('This does not look like an email address. Check it and try again.');
    for (const [k, label] of [['cc', 'CC'], ['bcc', 'BCC']]) {
      const bad = badAddress(mail[k]);
      if (bad) found[k] = tr('"{addr}" is not a valid email address.', { addr: bad });
      else if (addressCount(mail[k]) > 10) found[k] = tr('{label}: at most 10 addresses.', { label });
    }
    if (Object.keys(found).length) { setMail(m => ({ ...m, fields: found })); return; }
    setMail(m => ({ ...m, busy: true, err: '', fields: {} }));
    try { const r = await quoteApi.post(`/${d.id}/email`, { to: mail.to, cc: mail.cc, bcc: mail.bcc, message: mail.message }); setMail(m => ({ ...m, busy: false, done: r })); onSent(); } catch (x) { setMail(m => ({ ...m, busy: false, err: tr(x.message) })); }
  };
  const hide = k => setMail(m => ({ ...m, ['show' + k]: false, [k.toLowerCase()]: '', fields: { ...m.fields, [k.toLowerCase()]: '' } }));
  const field = (k, label, hint) => (
    <div className="a-lbl">
      <span className="em-row"><span className="pu-lbl">{tr(label)} <small>{tr(hint)}</small></span><button type="button" className="em-x" onClick={() => hide(label)}>{tr('Remove')}</button></span>
      <input className={'a-input' + (fields[k] ? ' bad' : '')} type="text" inputMode="email" autoFocus={!mail[k]} value={mail[k] || ''} onChange={put(k)} placeholder="name@example.com, another@example.com" />
      {fields[k] && <small className="qt-err" role="alert">{fields[k]}</small>}
    </div>
  );
  return (
    <Modal narrow cls="mailq" kicker={d.id} title={tr('Email this quotation')} onClose={() => setMail(null)} onSubmit={send}
      footer={mail.done ? <button type="button" className="a-btn" onClick={() => setMail(null)}>{tr('Close')}</button>
        : <><button type="button" className="a-btn ghost" onClick={() => setMail(null)}>{tr('Cancel')}</button><button className="a-btn grad" disabled={mail.busy}>{mail.busy ? tr('Sending…') : tr('✉ Send quotation')}</button></>}>
      {mail.done ? (
        <div className="a-msg ok"><Rich text={tr('✓ The quotation PDF was sent to <b>{to}</b>.', { to: mail.done.to })} />
          {!!mail.done.cc?.length && <div>{tr('CC: {list}', { list: mail.done.cc.join(', ') })}</div>}
          {!!mail.done.bcc?.length && <div>{mail.done.bcc.length === 1 ? tr('BCC: 1 hidden recipient') : tr('BCC: {n} hidden recipients', { n: mail.done.bcc.length })}</div>}</div>
      ) : (
        <div className="iv-form">
          <Notice err={mail.err && tr(mail.err)} />
          <small className="fd-sub"><Rich text={tr('The PDF of <b>{id}</b> ({amount}) is attached automatically.', { id: d.id, amount: taka(d.net) })} /></small>
          <div className="a-lbl">
            <span className="em-row"><span className="pu-lbl">{tr('To')} <small>{tr('the customer')}</small></span>
              <span className="em-add">
                {!(mail.showCC || mail.cc) && <button type="button" onClick={() => setMail(m => ({ ...m, showCC: true }))}>{tr('+ CC')}</button>}
                {!(mail.showBCC || mail.bcc) && <button type="button" onClick={() => setMail(m => ({ ...m, showBCC: true }))}>{tr('+ BCC')}</button>}
              </span></span>
            <input className={'a-input' + (fields.to ? ' bad' : '')} type="text" inputMode="email" autoComplete="email" value={mail.to} onChange={put('to')} placeholder="customer@example.com" />
            {fields.to && <small className="qt-err" role="alert">{fields.to}</small>}
          </div>
          {(mail.showCC || mail.cc) && field('cc', 'CC', 'everyone sees them')}
          {(mail.showBCC || mail.bcc) && field('bcc', 'BCC', 'hidden from the others')}
          <label className="a-lbl">{tr('Message')} <small>{tr('(optional, shown above the standard text)')}</small><textarea className="a-input" rows={2} maxLength={1000} value={mail.message} onChange={e => setMail(m => ({ ...m, message: e.target.value }))} /></label>
        </div>
      )}
    </Modal>
  );
}

/** The PDF of a quotation in a side panel, with a button to email it to the customer (or straight to the email dialog when startMail is set). */
export function QuotePreview({ id, canEdit, startMail, onClose, onSent }) {
  const tr = useT();
  const [d, setD] = useState(null); const [mail, setMail] = useState(null); const [err, setErr] = useState('');
  const openMail = async () => {
    try { const q = d || await quoteApi.get('/' + id); setD(q); setMail({ to: q.email || '', message: '' }); } catch (e) { setErr(tr(e.message)); }
  };
  useEffect(() => { if (startMail) openMail(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const update = v => { if (v === null && startMail) onClose(); else setMail(v); };
  return (
    <>
      {!startMail && <PdfPreview url={`/api/quotes/${id}/pdf`} title={id} filename={`${id}.pdf`} onClose={onClose}
        actions={canEdit && <><button type="button" className="a-btn ghost" onClick={openMail}>{tr('✉ Email to customer')}</button><button type="button" className="a-btn ghost wa" onClick={async () => { try { await sendWhatsApp(d || await quoteApi.get('/' + id), tr); onSent(); } catch (e) { setErr(tr(e.message)); } }}>WhatsApp</button></>} />}
      {err && <Modal narrow cls="mailq" kicker={id} title={tr('Email')} onClose={() => (startMail ? onClose() : setErr(''))} footer={<button type="button" className="a-btn" onClick={() => (startMail ? onClose() : setErr(''))}>{tr('Close')}</button>}><div className="a-msg err">{err}</div></Modal>}
      {mail && d && <EmailQuote d={d} mail={mail} setMail={update} onSent={onSent} />}
    </>
  );
}
