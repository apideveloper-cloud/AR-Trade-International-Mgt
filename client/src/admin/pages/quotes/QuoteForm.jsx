import { useEffect, useRef, useState } from 'react';
import { quoteApi } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import { IconBtn } from '../../IconBtn.jsx';
import { CustomerPick } from '../../CustomerPick.jsx';
import { Notice, taka, todayBd } from '../../fieldKit.jsx';
import { ProductPick, num } from '../inventory/shared.jsx';
import { CUSTOMER_KINDS } from './shared.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

const blank = (staff, defaults) => ({
  custType: 'Existing', customerId: null, date: todayBd(), toName: '', address: '', attend: '', desig: '', mobile: '', email: '', subject: '', intro: defaults?.intro || '', notes: defaults?.notes || '', validDays: 3,
  install: '', transport: '', discount: '', vat: '', signerName: staff?.name || '', signerDesig: staff?.role || '', signerDept: 'Sales & Marketing', signerCell: staff?.phone || '',
  lines: [{ description: '', qty: 1, unit: 'PCS', warranty: '', unitPrice: '' }]
});

const loadCustomers = (type, q) => quoteApi.get(`/customers?type=${type}&q=${encodeURIComponent(q)}`);

/** Write a new quotation, edit one, or start from a copy of another. */
export function QuoteForm({ quote, copy, staff, onClose, onSaved, onPreview }) {
  const tr = useT();
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
    if (file.size > 6 * 1024 * 1024) { setScan({ busy: false, err: true, msg: tr('The picture is larger than 6 MB.') }); return; }
    setScan({ busy: true, msg: tr('Reading the picture… this can take a few seconds.') });
    try {
      const image = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(new Error(tr('The picture could not be opened'))); r.readAsDataURL(file); });
      const r = await quoteApi.post('/scan', { image });
      setF(x => ({ ...x, notes: (x.notes.trim() ? x.notes.trim() + '\n' : '') + r.text }));
      setScan({ busy: false, msg: r.lines === 1 ? tr('Added 1 line from the picture. Check them before saving.') : tr('Added {n} lines from the picture. Check them before saving.', { n: r.lines }) });
    } catch (er) { setScan({ busy: false, err: true, msg: tr(er.message) }); }
  };
  const total = f.lines.reduce((t, l) => t + num(l.qty) * num(l.unitPrice), 0);
  const net = Math.max(0, total + num(f.install) + num(f.transport) + num(f.vat) - num(f.discount));
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!f.toName.trim()) {
      setCustErr(f.custType === 'New' ? tr('Write the customer or organisation name.') : f.custType === 'Upcoming' ? tr('Choose an upcoming customer from the list, or switch to "New customer" to type one in.') : tr('Choose an existing customer from the list, or switch to "New customer" to type one in.'));
      document.querySelector('.a-modal.qt .bd')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    try {
      const saved = quote && !copy ? (await quoteApi.put('/' + quote.id, f), { id: quote.id }) : await quoteApi.post('', f);
      onSaved(saved.id); onClose();
      if (preview.current) onPreview?.(saved.id, preview.current);
    } catch (er) { setErr(tr(er.message)); setBusy(false); }
  };
  return (
    <Modal side cls="qt" kicker={quote && !copy ? quote.id : tr('Quotation')} title={quote && !copy ? tr('Edit quotation') : copy ? tr('Copy of {id}', { id: quote.id }) : tr('New quotation')} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>{tr('Cancel')}</button><button className="a-btn ghost" disabled={busy} onClick={() => { preview.current = 'preview'; }}>{tr('Save & preview')}</button><button className="a-btn ghost" disabled={busy} onClick={() => { preview.current = 'email'; }}>{tr('Save & email')}</button><button className="a-btn grad" disabled={busy} onClick={() => { preview.current = ''; }}>{busy ? tr('Saving…') : tr('Save quotation')}</button></>}>
      <div className="qt-form">
        <div className="qt-main">
          <Notice err={err} />
          <section className="pu-card">
            <header className="iv-lhd"><b>{tr('Quotation for')}</b>
              <div className="iv-seg qt-seg" role="radiogroup" aria-label={tr('Customer type')}>
                  {CUSTOMER_KINDS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={f.custType === k} className={f.custType === k ? 'on' : ''} onClick={() => { setCustErr(''); setF(x => (x.custType === k ? x : { ...x, custType: k, customerId: null, toName: k === 'New' ? x.toName : '' })); }}>{tr(label)}</button>)}
              </div></header>
            <div className="qt-cust">
              <div className="qt-row1">
              <div className="qt-who">
                {f.custType === 'New'
                  ? <label className="a-lbl">{tr('Customer / organisation')}<input className={'a-input' + (custErr ? ' bad' : '')} value={f.toName} onChange={e => { setCustErr(''); set('toName')(e); }} placeholder="e.g. Northern University Bangladesh" /></label>
                  : <div className="a-lbl">{f.custType === 'Upcoming' ? tr('Upcoming customer') : tr('Existing customer')}
                    <CustomerPick load={loadCustomers} type={f.custType} bad={!!custErr} selected={f.customerId ? f.toName : ''} onClear={() => setF(x => ({ ...x, customerId: null, toName: '' }))}
                      onPick={c => { setCustErr(''); setF(x => ({ ...x, customerId: c.id, toName: c.name, attend: c.contact || x.attend, desig: c.role || x.desig, mobile: c.phone || x.mobile, email: c.email || x.email, address: c.address || x.address })); }} />
                    </div>}
                {custErr && <small className="qt-err" role="alert">{custErr}</small>}
              </div>
              <label className="a-lbl">{tr('Contact person')}<input className="a-input" value={f.attend} onChange={set('attend')} placeholder={tr('Attend')} /></label>
              </div>
              <div className="qt-contact">
                <label className="a-lbl">{tr('Designation')}<input className="a-input" value={f.desig} onChange={set('desig')} /></label>
                <label className="a-lbl">{tr('Mobile')}<input className="a-input" value={f.mobile} onChange={set('mobile')} /></label>
                <label className="a-lbl">{tr('Email')}<input className="a-input" type="email" value={f.email} onChange={set('email')} /></label>
              </div>
              <label className="a-lbl">{tr('Address')}<input className="a-input" maxLength={300} value={f.address} onChange={set('address')} placeholder={tr('Street, area, city')} /></label>
            </div>
          </section>
          <section className="pu-card">
            <header className="iv-lhd"><b>{tr('Subject & letter')}</b><span>{tr('The short covering text')}</span></header>
            <div className="qt-grid one">
              <label className="a-lbl">{tr('Subject')}<input className="a-input" value={f.subject} onChange={set('subject')} placeholder={tr('Price quotation for …')} /></label>
              <label className="a-lbl">{tr('Introduction')}<textarea className="a-input" rows={3} maxLength={2000} value={f.intro} onChange={set('intro')} /></label>
            </div>
          </section>
          <section className="iv-lines">
            <header className="iv-lhd"><b>{tr('Items')}</b><span>{tr('{n} item(s)', { n: f.lines.filter(l => l.description).length })}</span></header>
            <div className="qt-add">
              <ProductPick placeholder={tr('Search the catalogue to add a product with its price…')} onPick={p => setF(x => ({ ...x, lines: [...x.lines.filter(l => l.description || num(l.unitPrice)), { productId: p.id, description: p.name, qty: 1, unit: 'PCS', warranty: '', unitPrice: p.price || '' }] }))} />
              <button type="button" className="a-btn ghost sm" onClick={() => setF(x => ({ ...x, lines: [...x.lines, { description: '', qty: 1, unit: 'PCS', warranty: '', unitPrice: '' }] }))}>{tr('＋ Blank line')}</button>
            </div>
            <div className="qt-lt">
              <div className="qt-lh"><span>{tr('Description')}</span><span>{tr('Qty')}</span><span>{tr('Unit')}</span><span>{tr('Warranty')}</span><span>{tr('Unit price ৳')}</span><span>{tr('Amount')}</span><span /></div>
              {f.lines.map((l, i) => (
                <div key={i} className="qt-lr">
                  <input className="a-input" value={l.description} onChange={e => setLine(i, 'description', e.target.value)} placeholder={tr('Item description')} aria-label={tr('Description')} />
                  <input className="a-input r" type="number" min="1" value={l.qty} onChange={e => setLine(i, 'qty', e.target.value)} aria-label={tr('Quantity')} />
                  <select className="a-input" value={l.unit} onChange={e => setLine(i, 'unit', e.target.value)} aria-label={tr('Unit')}>{['PCS', 'SET', 'BOX', 'ROLL', 'PACK', 'UNIT'].map(u => <option key={u}>{u}</option>)}</select>
                  <input className="a-input" value={l.warranty} onChange={e => setLine(i, 'warranty', e.target.value)} placeholder={tr('e.g. 1 year')} aria-label={tr('Warranty')} />
                  <input className="a-input r" type="number" min="0" value={l.unitPrice} onChange={e => setLine(i, 'unitPrice', e.target.value)} placeholder="0" aria-label={tr('Unit price')} />
                  <strong>{taka(num(l.qty) * num(l.unitPrice))}</strong>
                  <IconBtn icon="trash" tone="bad" title={tr('Remove this line')} onClick={() => setF(x => ({ ...x, lines: x.lines.length > 1 ? x.lines.filter((_, j) => j !== i) : x.lines }))} />
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="qt-side">
          <div className="pu-sum">
            <small>{tr('Net payable')}</small><b>{taka(net)}</b>
            <div className="pu-sum-row"><span>{tr('Total amount')}</span><em>{taka(total)}</em></div>
            {num(f.discount) > 0 && <div className="pu-sum-row"><span>{tr('Discount')}</span><em>−{taka(num(f.discount))}</em></div>}
          </div>
          <section className="pu-card qt-box">
            <div className="qt-grid two">
              <label className="a-lbl">{tr('Date')}<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
              <label className="a-lbl">{tr('Valid for (days)')}<input className="a-input" type="number" min="1" value={f.validDays} onChange={set('validDays')} /></label>
              <label className="a-lbl">{tr('Installation / service ৳')}<input className="a-input r" type="number" min="0" value={f.install} onChange={set('install')} placeholder="0" /></label>
              <label className="a-lbl">{tr('Transportation ৳')}<input className="a-input r" type="number" min="0" value={f.transport} onChange={set('transport')} placeholder="0" /></label>
              <label className="a-lbl">{tr('Discount ৳')}<input className="a-input r" type="number" min="0" value={f.discount} onChange={set('discount')} placeholder="0" /></label>
              <label className="a-lbl">{tr('VAT ৳')}<input className="a-input r" type="number" min="0" value={f.vat} onChange={set('vat')} placeholder="0" /></label>
            </div>
          </section>
          <div className="a-lbl qt-terms">
            <span className="qt-terms-hd">{tr('Terms (N.B.)')} <small>{tr('one per line')}</small>
              <label className={'a-mini qt-scan' + (scan.busy ? ' off' : '')} title={tr('Take the terms from a photo or screenshot')}>{scan.busy ? tr('Reading…') : tr('📷 Scan from picture')}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={scan.busy} onChange={scanTerms} /></label></span>
            <textarea className="a-input" rows={6} maxLength={2000} value={f.notes} onChange={set('notes')} />
            {scan.msg && <small className={'qt-scan-msg' + (scan.err ? ' bad' : '')}>{scan.msg}</small>}
          </div>
          <section className="pu-card qt-box">
            <div className="qt-grid two">
              <label className="a-lbl qt-w2">{tr('Signed by')}<input className="a-input" value={f.signerName} onChange={set('signerName')} /></label>
              <label className="a-lbl">{tr('Designation')}<input className="a-input" value={f.signerDesig} onChange={set('signerDesig')} /></label>
              <label className="a-lbl">{tr('Department')}<input className="a-input" value={f.signerDept} onChange={set('signerDept')} /></label>
              <label className="a-lbl qt-w2">{tr('Cell / WhatsApp')}<input className="a-input" value={f.signerCell} onChange={set('signerCell')} /></label>
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
