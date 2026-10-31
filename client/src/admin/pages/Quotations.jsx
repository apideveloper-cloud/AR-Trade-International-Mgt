// Quotations: price offers to customers. Write one, send its PDF, then mark it Sent / Accepted / Rejected.
import { useEffect, useRef, useState } from 'react';
import { can, quoteApi, slNo, useTable } from '../adminApi.js';
import { Drawer, Modal, Summary, Toolbar, alertBox, confirmBox } from '../ui.jsx';
import { ListFilter } from '../ListFilter.jsx';
import { IconBtn } from '../IconBtn.jsx';
import { Chip, Fact, Grid, Notice, PdfButton, PdfPreview, Skeleton, fDate, taka, todayBd, useDebounced } from '../fieldKit.jsx';
import { ProductPick } from './inventory/shared.jsx';
import '../field.css';
import './inventory/inventory.css';
import './quotations.css';

const TONE = { Draft: 'off', Sent: 'blue', Accepted: 'ok', Rejected: 'bad' };
const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected'];
const num = v => Math.max(0, Math.round(Number(v) || 0));
const Status = ({ s }) => <Chip tone={TONE[s] || 'off'}>{s}</Chip>;
const CUSTOMER_KINDS = [['Existing', 'Existing customer'], ['Upcoming', 'Upcoming customer'], ['New', 'New customer']];
const blank = (staff, defaults) => ({
  custType: 'Existing', customerId: null, date: todayBd(), toName: '', address: '', attend: '', desig: '', mobile: '', email: '', subject: '', intro: defaults?.intro || '', notes: defaults?.notes || '', validDays: 3,
  install: '', transport: '', discount: '', vat: '', signerName: staff?.name || '', signerDesig: staff?.role || '', signerDept: 'Sales & Marketing', signerCell: staff?.phone || '',
  lines: [{ description: '', qty: 1, unit: 'PCS', warranty: '', unitPrice: '' }]
});

/** Search the field app's customers (Existing or Upcoming) and hand the chosen one back. */
function CustomerPick({ type, selected, onPick, onClear, bad }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q, 250);
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (selected) return undefined;
    let stale = false;
    quoteApi.get(`/customers?type=${type}&q=${encodeURIComponent(dq.trim())}`).then(r => { if (!stale) setItems(r.items); }).catch(() => { if (!stale) setItems([]); });
    return () => { stale = true; };
  }, [type, dq, selected]);
  const [openList, setOpenList] = useState(false);
  if (selected) return <div className="iv-sel" title={selected}><b>{selected}</b><small>{type}</small><button type="button" onClick={onClear} aria-label="Choose another customer">✕</button></div>;
  return (
    <div className="iv-pick">
      <input className={'a-input' + (bad ? ' bad' : '')} value={q} onChange={e => { setQ(e.target.value); setOpenList(true); }} onFocus={() => setOpenList(true)} onBlur={() => setTimeout(() => setOpenList(false), 150)} placeholder={type === 'Upcoming' ? 'Search upcoming customers by name, phone or area…' : 'Search existing customers by name, phone or area…'} aria-label="Search customers" />
      {openList && (
        <div className="iv-res">
          {items === null ? <small>Searching…</small> : !items.length ? <small>{q.trim() ? 'No customer found.' : `No ${type.toLowerCase()} customers yet.`} Use "New customer" to type one in.</small> : items.map(c => (
            <button key={c.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(c); setQ(''); setOpenList(false); }}><span>{c.name}{c.contact ? ' · ' + c.contact : ''}</span><em>{c.phone}</em></button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Write a new quotation, edit one, or start from a copy of another. */
function QuoteForm({ quote, copy, staff, onClose, onSaved, onPreview }) {
  const defaults = useDefaults();
  const [f, setF] = useState(() => (quote ? { ...quote, install: quote.install || '', transport: quote.transport || '', discount: quote.discount || '', vat: quote.vat || '', ...(copy ? { date: todayBd(), signerName: staff?.name || quote.signerName } : {}) } : null));
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const preview = useRef(''); const [scan, setScan] = useState({ busy: false, msg: '' }); const [custErr, setCustErr] = useState('');
  useEffect(() => { if (!f && defaults) setF(blank(staff, defaults)); }, [defaults, f, staff]);
  if (!f) return null;
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const setLine = (i, k, v) => setF(x => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const scanTerms = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) { setScan({ busy: false, err: true, msg: 'The picture is larger than 6 MB.' }); return; }
    setScan({ busy: true, msg: 'Reading the picture… this can take a few seconds.' });
    try {
      const image = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error('The picture could not be opened')); r.readAsDataURL(file); });
      const r = await quoteApi.post('/scan', { image });
      setF(x => ({ ...x, notes: (x.notes.trim() ? x.notes.trim() + '\n' : '') + r.text }));
      setScan({ busy: false, msg: `Added ${r.lines} line${r.lines === 1 ? '' : 's'} from the picture. Check them before saving.` });
    } catch (er) { setScan({ busy: false, err: true, msg: er.message }); }
  };
  const total = f.lines.reduce((t, l) => t + num(l.qty) * num(l.unitPrice), 0);
  const net = Math.max(0, total + num(f.install) + num(f.transport) + num(f.vat) - num(f.discount));
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!f.toName.trim()) {
      setCustErr(f.custType === 'New' ? 'Write the customer or organisation name.' : `Choose ${f.custType === 'Upcoming' ? 'an upcoming' : 'an existing'} customer from the list, or switch to "New customer" to type one in.`);
      document.querySelector('.a-modal.qt .bd')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    try {
      const saved = quote && !copy ? (await quoteApi.put('/' + quote.id, f), { id: quote.id }) : await quoteApi.post('', f);
      onSaved(saved.id); onClose();
      if (preview.current) onPreview?.(saved.id, preview.current);
    } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal side cls="qt" kicker={quote && !copy ? quote.id : 'Quotation'} title={quote && !copy ? 'Edit quotation' : copy ? 'Copy of ' + quote.id : 'New quotation'} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn ghost" disabled={busy} onClick={() => { preview.current = 'preview'; }}>Save & preview</button><button className="a-btn ghost" disabled={busy} onClick={() => { preview.current = 'email'; }}>Save & email</button><button className="a-btn grad" disabled={busy} onClick={() => { preview.current = ''; }}>{busy ? 'Saving…' : 'Save quotation'}</button></>}>
      <div className="qt-form">
        <div className="qt-main">
          <Notice err={err} />
          <section className="pu-card">
            <header className="iv-lhd"><b>Quotation for</b>
              <div className="iv-seg qt-seg" role="radiogroup" aria-label="Customer type">
                  {CUSTOMER_KINDS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={f.custType === k} className={f.custType === k ? 'on' : ''} onClick={() => { setCustErr(''); setF(x => (x.custType === k ? x : { ...x, custType: k, customerId: null, toName: k === 'New' ? x.toName : '' })); }}>{label}</button>)}
              </div></header>
            <div className="qt-cust">
              <div className="qt-row1">
              <div className="qt-who">
                {f.custType === 'New'
                  ? <label className="a-lbl">Customer / organisation<input className={'a-input' + (custErr ? ' bad' : '')} value={f.toName} onChange={e => { setCustErr(''); set('toName')(e); }} placeholder="e.g. Northern University Bangladesh" /></label>
                  : <div className="a-lbl">{f.custType === 'Upcoming' ? 'Upcoming customer' : 'Existing customer'}
                    <CustomerPick type={f.custType} bad={!!custErr} selected={f.customerId ? f.toName : ''} onClear={() => setF(x => ({ ...x, customerId: null, toName: '' }))}
                      onPick={c => { setCustErr(''); setF(x => ({ ...x, customerId: c.id, toName: c.name, attend: c.contact || x.attend, desig: c.role || x.desig, mobile: c.phone || x.mobile, email: c.email || x.email, address: c.address || x.address })); }} />
                    </div>}
                {custErr && <small className="qt-err" role="alert">{custErr}</small>}
              </div>
              <label className="a-lbl">Contact person<input className="a-input" value={f.attend} onChange={set('attend')} placeholder="Attend" /></label>
              </div>
              <div className="qt-contact">
                <label className="a-lbl">Designation<input className="a-input" value={f.desig} onChange={set('desig')} /></label>
                <label className="a-lbl">Mobile<input className="a-input" value={f.mobile} onChange={set('mobile')} /></label>
                <label className="a-lbl">Email<input className="a-input" type="email" value={f.email} onChange={set('email')} /></label>
              </div>
              <label className="a-lbl">Address<input className="a-input" maxLength={300} value={f.address} onChange={set('address')} placeholder="Street, area, city" /></label>
            </div>
          </section>
          <section className="pu-card">
            <header className="iv-lhd"><b>Subject & letter</b><span>The short covering text</span></header>
            <div className="qt-grid one">
              <label className="a-lbl">Subject<input className="a-input" value={f.subject} onChange={set('subject')} placeholder="Price quotation for …" /></label>
              <label className="a-lbl">Introduction<textarea className="a-input" rows={3} maxLength={2000} value={f.intro} onChange={set('intro')} /></label>
            </div>
          </section>
          <section className="iv-lines">
            <header className="iv-lhd"><b>Items</b><span>{f.lines.filter(l => l.description).length} item(s)</span></header>
            <div className="qt-add">
              <ProductPick placeholder="Search the catalogue to add a product with its price…" onPick={p => setF(x => ({ ...x, lines: [...x.lines.filter(l => l.description || num(l.unitPrice)), { productId: p.id, description: p.name, qty: 1, unit: 'PCS', warranty: '', unitPrice: p.price || '' }] }))} />
              <button type="button" className="a-btn ghost sm" onClick={() => setF(x => ({ ...x, lines: [...x.lines, { description: '', qty: 1, unit: 'PCS', warranty: '', unitPrice: '' }] }))}>＋ Blank line</button>
            </div>
            <div className="qt-lt">
              <div className="qt-lh"><span>Description</span><span>Qty</span><span>Unit</span><span>Warranty</span><span>Unit price ৳</span><span>Amount</span><span /></div>
              {f.lines.map((l, i) => (
                <div key={i} className="qt-lr">
                  <input className="a-input" value={l.description} onChange={e => setLine(i, 'description', e.target.value)} placeholder="Item description" aria-label="Description" />
                  <input className="a-input r" type="number" min="1" value={l.qty} onChange={e => setLine(i, 'qty', e.target.value)} aria-label="Quantity" />
                  <select className="a-input" value={l.unit} onChange={e => setLine(i, 'unit', e.target.value)} aria-label="Unit">{['PCS', 'SET', 'BOX', 'ROLL', 'PACK', 'UNIT'].map(u => <option key={u}>{u}</option>)}</select>
                  <input className="a-input" value={l.warranty} onChange={e => setLine(i, 'warranty', e.target.value)} placeholder="e.g. 1 year" aria-label="Warranty" />
                  <input className="a-input r" type="number" min="0" value={l.unitPrice} onChange={e => setLine(i, 'unitPrice', e.target.value)} placeholder="0" aria-label="Unit price" />
                  <strong>{taka(num(l.qty) * num(l.unitPrice))}</strong>
                  <IconBtn icon="trash" tone="bad" title="Remove this line" onClick={() => setF(x => ({ ...x, lines: x.lines.length > 1 ? x.lines.filter((_, j) => j !== i) : x.lines }))} />
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="qt-side">
          <div className="pu-sum">
            <small>Net payable</small><b>{taka(net)}</b>
            <div className="pu-sum-row"><span>Total amount</span><em>{taka(total)}</em></div>
            {num(f.discount) > 0 && <div className="pu-sum-row"><span>Discount</span><em>−{taka(num(f.discount))}</em></div>}
          </div>
          <section className="pu-card qt-box">
            <div className="qt-grid two">
              <label className="a-lbl">Date<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
              <label className="a-lbl">Valid for (days)<input className="a-input" type="number" min="1" value={f.validDays} onChange={set('validDays')} /></label>
              <label className="a-lbl">Installation / service ৳<input className="a-input r" type="number" min="0" value={f.install} onChange={set('install')} placeholder="0" /></label>
              <label className="a-lbl">Transportation ৳<input className="a-input r" type="number" min="0" value={f.transport} onChange={set('transport')} placeholder="0" /></label>
              <label className="a-lbl">Discount ৳<input className="a-input r" type="number" min="0" value={f.discount} onChange={set('discount')} placeholder="0" /></label>
              <label className="a-lbl">VAT ৳<input className="a-input r" type="number" min="0" value={f.vat} onChange={set('vat')} placeholder="0" /></label>
            </div>
          </section>
          <div className="a-lbl qt-terms">
            <span className="qt-terms-hd">Terms (N.B.) <small>one per line</small>
              <label className={'a-mini qt-scan' + (scan.busy ? ' off' : '')} title="Take the terms from a photo or screenshot">{scan.busy ? 'Reading…' : '📷 Scan from picture'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={scan.busy} onChange={scanTerms} /></label></span>
            <textarea className="a-input" rows={6} maxLength={2000} value={f.notes} onChange={set('notes')} />
            {scan.msg && <small className={'qt-scan-msg' + (scan.err ? ' bad' : '')}>{scan.msg}</small>}
          </div>
          <section className="pu-card qt-box">
            <div className="qt-grid two">
              <label className="a-lbl qt-w2">Signed by<input className="a-input" value={f.signerName} onChange={set('signerName')} /></label>
              <label className="a-lbl">Designation<input className="a-input" value={f.signerDesig} onChange={set('signerDesig')} /></label>
              <label className="a-lbl">Department<input className="a-input" value={f.signerDept} onChange={set('signerDept')} /></label>
              <label className="a-lbl qt-w2">Cell / WhatsApp<input className="a-input" value={f.signerCell} onChange={set('signerCell')} /></label>
            </div>
          </section>
        </aside>
      </div>
    </Modal>
  );
}
function useDefaults() {
  const [d, setD] = useState(null);
  useEffect(() => { quoteApi.get('/defaults').then(setD).catch(() => setD({ intro: '', notes: '' })); }, []);
  return d;
}

/** 01712-345678 or +8801712345678 -> 8801712345678 (what wa.me wants); anything else is passed on as typed digits. */
const waNumber = v => { const d = String(v || '').replace(/\D/g, ''); return d.startsWith('880') ? d : d.startsWith('0') && d.length === 11 ? '88' + d : d; };
/** Opens WhatsApp with a ready message and a private link to the quotation PDF. A draft becomes Sent. */
async function sendWhatsApp(q) {
  const win = window.open('about:blank', '_blank'); // opened first, in the click, so the browser does not block it
  try {
    const { token } = await quoteApi.post(`/${q.id}/share`, {});
    const link = `${window.location.origin}/api/quotes/shared/${token}.pdf`;
    const text = [`Dear ${q.attend || q.toName},`, '', `Please find our quotation ${q.id}${q.subject ? ' (' + q.subject + ')' : ''}.`, `Net payable: ${taka(q.net)} · valid for ${q.validDays} days.`, '', `View / download the PDF: ${link}`, '', `Best regards,`, q.signerName || 'AR Trade International', 'AR Trade International'].join('\n');
    const url = `https://wa.me/${waNumber(q.mobile)}?text=${encodeURIComponent(text)}`;
    if (win) win.location.href = url; else window.location.href = url;
  } catch (e) { win?.close(); alertBox(e.message); }
}

function QuoteDrawer({ id, canEdit, staff, onClose, onChanged }) {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const [pdf, setPdf] = useState(false); const [edit, setEdit] = useState(null); const [mail, setMail] = useState(null);
  const load = () => quoteApi.get('/' + id).then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const setStatus = async status => {
    try { await quoteApi.post(`/${id}/status`, { status }); await load(); onChanged(); } catch (e) { alertBox(e.message); }
  };
  const remove = async () => {
    if (!(await confirmBox(`Delete ${id}?`, { danger: true, confirmLabel: 'Delete' }))) return;
    try { await quoteApi.del('/' + id); onChanged(); onClose(); } catch (e) { alertBox(e.message); }
  };
  const locked = d?.status === 'Accepted';
  return (
    <Drawer title={id} sub={d ? `${d.toName} · ${taka(d.net)}` : 'Loading…'} onClose={onClose}>
      {err && <div className="a-msg err">{err}</div>}
      {!d ? !err && <Skeleton rows={6} /> : (
        <>
          <div className="fd-facts">
            <Fact k="Status"><Status s={d.status} /></Fact><Fact k="Date">{fDate(d.date)}</Fact><Fact k="To">{d.toName} <Chip tone={d.custType === 'Upcoming' ? 'amber' : d.custType === 'New' ? 'blue' : 'ok'}>{d.custType.toLowerCase()}</Chip></Fact><Fact k="Attend">{[d.attend, d.desig].filter(Boolean).join(' · ')}</Fact>
            <Fact k="Mobile">{d.mobile}</Fact><Fact k="Email">{d.email}</Fact><Fact k="Address">{d.address}</Fact><Fact k="Valid for">{d.validDays} days</Fact><Fact k="Written by">{d.by}</Fact>
          </div>
          {d.subject && <p className="qt-subj">{d.subject}</p>}
          <div className="fd-sub-row">{d.lines.map((l, i) => <div key={i}><span>{l.description}{l.warranty ? <small style={{ display: 'block', color: '#6b7388' }}>Warranty: {l.warranty}</small> : null}</span><em>{l.qty} {l.unit} × {taka(l.unitPrice)}</em><b>{taka(l.amount)}</b></div>)}</div>
          <dl className="qt-tot">
            <div><dt>Total amount</dt><dd>{taka(d.total)}</dd></div>
            {d.install > 0 && <div><dt>Installation / service</dt><dd>{taka(d.install)}</dd></div>}
            {d.transport > 0 && <div><dt>Transportation</dt><dd>{taka(d.transport)}</dd></div>}
            {d.discount > 0 && <div><dt>Discount</dt><dd>−{taka(d.discount)}</dd></div>}
            {d.vat > 0 && <div><dt>VAT</dt><dd>{taka(d.vat)}</dd></div>}
            <div className="net"><dt>Net payable</dt><dd>{taka(d.net)}</dd></div>
          </dl>
          <div className="fd-apa">
            <PdfButton onClick={() => setPdf(true)} />
            {canEdit && <button type="button" className="a-mini" onClick={() => setMail({ to: d.email || '', message: '' })}>✉ Email</button>}
            {canEdit && <button type="button" className="a-mini wa" onClick={async () => { await sendWhatsApp(d); load(); onChanged(); }}>WhatsApp</button>}
            {canEdit && d.status === 'Draft' && <button type="button" className="a-mini ok" onClick={() => setStatus('Sent')}>Mark as sent</button>}
            {canEdit && d.status === 'Sent' && <><button type="button" className="a-mini ok" onClick={() => setStatus('Accepted')}>Accepted</button><button type="button" className="a-mini bad" onClick={() => setStatus('Rejected')}>Rejected</button></>}
            {canEdit && (d.status === 'Rejected' || d.status === 'Sent') && <button type="button" className="a-mini" onClick={() => setStatus('Draft')}>Back to draft</button>}
            {canEdit && !locked && <button type="button" className="a-mini" onClick={() => setEdit('edit')}>Edit</button>}
            {canEdit && <button type="button" className="a-mini" onClick={() => setEdit('copy')}>Make a copy</button>}
            {canEdit && (d.status === 'Draft' || d.status === 'Rejected') && <button type="button" className="a-mini bad" onClick={remove}>Delete</button>}
          </div>
        </>
      )}
      {pdf && <QuotePreview id={id} canEdit={canEdit} onClose={() => setPdf(false)} onSent={() => { load(); onChanged(); }} />}
      {edit && d && <QuoteForm quote={d} copy={edit === 'copy'} staff={staff} onClose={() => setEdit(null)} onSaved={() => { load(); onChanged(); }} onPreview={(_, mode) => (mode === 'email' ? setMail({ to: d.email || '', message: '' }) : setPdf(true))} />}
      {mail && d && <EmailQuote d={d} mail={mail} setMail={setMail} onSent={() => { load(); onChanged(); }} />}
    </Drawer>
  );
}

/** Email the quotation PDF to the customer. A draft becomes Sent once it has gone out. */
const EMAIL_RE = /^[^\s,;<>"()]+@[^\s,;<>"()]+\.[^\s,;<>"()]+$/;
/** The first address in "a@x.com, b@y.com; c@z.com" that is not an email address, or '' when all are fine. */
const badAddress = v => String(v || '').split(/[;,\s]+/).map(x => x.trim()).filter(Boolean).find(a => !EMAIL_RE.test(a)) || '';
const addressCount = v => String(v || '').split(/[;,\s]+/).filter(Boolean).length;

function EmailQuote({ d, mail, setMail, onSent }) {
  const fields = mail.fields || {};
  const put = k => e => setMail(m => ({ ...m, [k]: e.target.value, fields: { ...m.fields, [k]: '' } }));
  const send = async e => {
    e.preventDefault();
    const found = {};
    if (!String(mail.to || '').trim()) found.to = "Write the customer's email address.";
    else if (!EMAIL_RE.test(String(mail.to).trim())) found.to = 'This does not look like an email address. Check it and try again.';
    for (const [k, label] of [['cc', 'CC'], ['bcc', 'BCC']]) {
      const bad = badAddress(mail[k]);
      if (bad) found[k] = `"${bad}" is not a valid email address.`;
      else if (addressCount(mail[k]) > 10) found[k] = `${label}: at most 10 addresses.`;
    }
    if (Object.keys(found).length) { setMail(m => ({ ...m, fields: found })); return; }
    setMail(m => ({ ...m, busy: true, err: '', fields: {} }));
    try { const r = await quoteApi.post(`/${d.id}/email`, { to: mail.to, cc: mail.cc, bcc: mail.bcc, message: mail.message }); setMail(m => ({ ...m, busy: false, done: r })); onSent(); } catch (x) { setMail(m => ({ ...m, busy: false, err: x.message })); }
  };
  const hide = k => setMail(m => ({ ...m, ['show' + k]: false, [k.toLowerCase()]: '', fields: { ...m.fields, [k.toLowerCase()]: '' } }));
  const field = (k, label, hint) => (
    <div className="a-lbl">
      <span className="em-row"><span className="pu-lbl">{label} <small>{hint}</small></span><button type="button" className="em-x" onClick={() => hide(label)}>Remove</button></span>
      <input className={'a-input' + (fields[k] ? ' bad' : '')} type="text" inputMode="email" autoFocus={!mail[k]} value={mail[k] || ''} onChange={put(k)} placeholder="name@example.com, another@example.com" />
      {fields[k] && <small className="qt-err" role="alert">{fields[k]}</small>}
    </div>
  );
  return (
    <Modal narrow cls="mailq" kicker={d.id} title="Email this quotation" onClose={() => setMail(null)} onSubmit={send}
      footer={mail.done ? <button type="button" className="a-btn" onClick={() => setMail(null)}>Close</button>
        : <><button type="button" className="a-btn ghost" onClick={() => setMail(null)}>Cancel</button><button className="a-btn grad" disabled={mail.busy}>{mail.busy ? 'Sending…' : '✉ Send quotation'}</button></>}>
      {mail.done ? (
        <div className="a-msg ok">✓ The quotation PDF was sent to <b>{mail.done.to}</b>.
          {!!mail.done.cc?.length && <div>CC: {mail.done.cc.join(', ')}</div>}
          {!!mail.done.bcc?.length && <div>BCC: {mail.done.bcc.length} hidden recipient{mail.done.bcc.length === 1 ? '' : 's'}</div>}</div>
      ) : (
        <div className="iv-form">
          <Notice err={mail.err} />
          <small className="fd-sub">The PDF of <b>{d.id}</b> ({taka(d.net)}) is attached automatically.</small>
          <div className="a-lbl">
            <span className="em-row"><span className="pu-lbl">To <small>the customer</small></span>
              <span className="em-add">
                {!(mail.showCC || mail.cc) && <button type="button" onClick={() => setMail(m => ({ ...m, showCC: true }))}>+ CC</button>}
                {!(mail.showBCC || mail.bcc) && <button type="button" onClick={() => setMail(m => ({ ...m, showBCC: true }))}>+ BCC</button>}
              </span></span>
            <input className={'a-input' + (fields.to ? ' bad' : '')} type="text" inputMode="email" autoComplete="email" value={mail.to} onChange={put('to')} placeholder="customer@example.com" />
            {fields.to && <small className="qt-err" role="alert">{fields.to}</small>}
          </div>
          {(mail.showCC || mail.cc) && field('cc', 'CC', 'everyone sees them')}
          {(mail.showBCC || mail.bcc) && field('bcc', 'BCC', 'hidden from the others')}
          <label className="a-lbl">Message <small>(optional, shown above the standard text)</small><textarea className="a-input" rows={2} maxLength={1000} value={mail.message} onChange={e => setMail(m => ({ ...m, message: e.target.value }))} /></label>
        </div>
      )}
    </Modal>
  );
}

/** The PDF of a quotation in a side panel, with a button to email it to the customer (or straight to the email dialog when startMail is set). */
function QuotePreview({ id, canEdit, startMail, onClose, onSent }) {
  const [d, setD] = useState(null); const [mail, setMail] = useState(null); const [err, setErr] = useState('');
  const openMail = async () => {
    try { const q = d || await quoteApi.get('/' + id); setD(q); setMail({ to: q.email || '', message: '' }); } catch (e) { setErr(e.message); }
  };
  useEffect(() => { if (startMail) openMail(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const update = v => { if (v === null && startMail) onClose(); else setMail(v); };
  return (
    <>
      {!startMail && <PdfPreview url={`/api/quotes/${id}/pdf`} title={id} filename={`${id}.pdf`} onClose={onClose}
        actions={canEdit && <><button type="button" className="a-btn ghost" onClick={openMail}>✉ Email to customer</button><button type="button" className="a-btn ghost wa" onClick={async () => { try { await sendWhatsApp(d || await quoteApi.get('/' + id)); onSent(); } catch (e) { setErr(e.message); } }}>WhatsApp</button></>} />}
      {err && <Modal narrow cls="mailq" kicker={id} title="Email" onClose={() => (startMail ? onClose() : setErr(''))} footer={<button type="button" className="a-btn" onClick={() => (startMail ? onClose() : setErr(''))}>Close</button>}><div className="a-msg err">{err}</div></Modal>}
      {mail && d && <EmailQuote d={d} mail={mail} setMail={update} onSent={onSent} />}
    </>
  );
}

export function Quotations({ staff }) {
  const t = useTable('/', { q: '', status: '', ctype: '', from: '', to: '', min: '', max: '' }, [], quoteApi);
  const [open, setOpen] = useState(null); const [add, setAdd] = useState(false); const [pdf, setPdf] = useState(null);
  const canEdit = can(staff, 'quotes.manage');
  const m = t.data.totals || {};
  return (
    <>
      <Summary items={[
        ['Quotations', t.data.total ?? '…', 'matching your filters', 'blue', 'cart'],
        ['Quoted value', taka(m.net), 'net payable, all of these', 'violet', 'box'],
        ['Waiting for answer', (m.sent ?? 0) + (m.draft ?? 0), `${m.draft ?? 0} draft · ${m.sent ?? 0} sent`, 'amber', 'clock'],
        ['Won', taka(m.acceptedNet), `${m.accepted ?? 0} accepted`, 'green', 'check']
      ]} />
      <ListFilter t={t} noun="quotation" title="Search quotations" search={{ placeholder: 'Quotation no., customer, subject or contact' }}
        selects={[{ key: 'status', label: 'Status', all: 'Every status', icon: 'status', options: STATUSES.map(s => ({ v: s, t: s })) }, { key: 'ctype', label: 'Customer', all: 'All customers', icon: 'user', options: CUSTOMER_KINDS.map(([v, t]) => ({ v, t })) }]}
        range={{ label: 'Quotation date' }} amount={{ label: 'Net payable' }} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Quotations</h3><small className="fd-sub">Write a quotation, open its PDF to send, then record the answer</small></div>
          <div className="bk-acts">{canEdit && <button type="button" className="a-btn sm grad" onClick={() => setAdd(true)}>＋ New quotation</button>}</div></div>
        <Grid server={t} cols="44px 160px minmax(180px,1.3fr) minmax(160px,1.2fr) 110px 60px 120px 100px 44px" head={['SL', 'Quotation', 'Customer', 'Subject', 'Date', 'Items', 'Net payable', 'Status', '']} onRow={x => setOpen(x.id)} empty="No quotation matches. Press New quotation to write one."
          rows={t.data.rows.map((x, i) => ({ key: x.id, item: x, cells: [slNo(t, i), <b key="i" className="mono">{x.id}</b>, <span key="c">{x.toName}{x.custType !== 'Existing' && <Chip tone={x.custType === 'Upcoming' ? 'amber' : 'blue'}> {x.custType.toLowerCase()}</Chip>}</span>, <span key="s" className="qt-clip">{x.subject || '—'}</span>, fDate(x.date), x.items, <b key="n">{taka(x.net)}</b>, <Status key="st" s={x.status} />, <PdfButton key="p" label="" onClick={() => setPdf({ id: x.id })} />] }))} />
      </section>
      {open && <QuoteDrawer id={open} canEdit={canEdit} staff={staff} onClose={() => setOpen(null)} onChanged={t.reload} />}
      {add && <QuoteForm staff={staff} onClose={() => setAdd(false)} onSaved={t.reload} onPreview={(id, mode) => setPdf({ id, email: mode === 'email' })} />}
      {pdf && <QuotePreview id={pdf.id} startMail={pdf.email} canEdit={canEdit} onClose={() => setPdf(null)} onSent={t.reload} />}
    </>
  );
}
