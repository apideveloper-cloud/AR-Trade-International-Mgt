import { useEffect, useState } from 'react';
import { adm, downloadFile, dateTimeF, fmtMoney, STATUS_COLORS } from '../../adminApi.js';
import { hueOf, Drawer, Modal, confirmBox } from '../../ui.jsx';
import { PdfIcon, PdfPreview } from '../../fieldKit.jsx';
import { STATUSES, AREA } from './constants.js';
import { StatusDialog } from './StatusDialog.jsx';

/** Order details panel: summary, progress tracker with required remarks, invoice actions, contact, items and the timeline with comments. */
export function OrderDrawer({ id, onClose, onChanged, canDelete, riderOnly }) {
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  const [mail, setMail] = useState(null); // { to, message, busy, err, done }
  const [showPdf, setShowPdf] = useState(false);
  useEffect(() => { adm.get('/orders/' + id).then(setO).catch(e => setErr(e.message)); }, [id]);
  const [chg, setChg] = useState(null); // the status being moved to: the remarks dialog is open while this is set
  const [cm, setCm] = useState({ text: '', busy: false, err: '' });
  const setStatus = status => { if (o && o.status !== status) setChg(status); };
  const postComment = async e => {
    e.preventDefault();
    if (!cm.text.trim()) return;
    setCm(c => ({ ...c, busy: true, err: '' }));
    try { const n = await adm.post(`/orders/${id}/comments`, { text: cm.text.trim() }); setO(n); setCm({ text: '', busy: false, err: '' }); } catch (x) { setCm(c => ({ ...c, busy: false, err: x.message })); }
  };
  const del = async () => { if (!(await confirmBox('Delete order ' + id + '? This cannot be undone.', { danger: true, confirmLabel: 'Delete order' }))) return; await adm.del('/orders/' + id); onChanged(); onClose(); };
  return (
    <>
    {showPdf && <PdfPreview url={`/api/admin/orders/${id}/invoice.pdf`} title={'INV-' + id.replace(/^\D+/, '')} filename={'INV-' + id.replace(/^\D+/, '') + '.pdf'} onClose={() => setShowPdf(false)} />}
    <Drawer title={id} sub={o ? dateTimeF(o.date) : ''} onClose={onClose}>
      {err && <div className="a-msg err">{err}</div>}
      {!o ? <span className="spin" /> : (
        <>
          <div className="od-hero">
            <span className="od-av" style={{ '--h': hueOf(o.customer.name) }}>{String(o.customer.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
            <div className="od-who"><b>{o.customer.name}</b><span>{o.customer.phone} · {AREA[o.area]}</span>
              <div className="od-badges"><i className={'od-pay ' + (o.payStatus === 'Paid' ? 'ok' : 'due')}>{o.payStatus === 'Paid' ? '✓ Paid' : '● Unpaid'}</i><i>{o.payment}</i><i>{o.source && o.source !== 'Customer' ? 'By ' + o.source + (o.placedBy ? ' · ' + o.placedBy : '') : 'By customer (website)'}</i>{o.slot && <i>⏱ {o.slot}</i>}</div></div>
            <div className="od-amt"><small>Order total</small><b>{fmtMoney(o.total)}</b><span>{o.items.reduce((t, i) => t + i.qty, 0)} item{o.items.reduce((t, i) => t + i.qty, 0) === 1 ? '' : 's'}</span></div>
          </div>
          <div className="od-track">
            <div className="od-track-h"><small>Order progress</small>{o.status === 'Cancelled' && <em>Cancelled</em>}</div>
            <div className="od-steps">
              {STATUSES.filter(s => s !== 'Cancelled' && (!riderOnly || ['Shipped', 'Delivered'].includes(s))).map((s, i, a) => {
                const cur = STATUSES.indexOf(o.status), n = STATUSES.indexOf(s), cancelled = o.status === 'Cancelled';
                const state = cancelled ? 'off' : n < cur ? 'done' : n === cur ? 'now' : 'next';
                return (
                  <button key={s} type="button" className={'od-step ' + state} onClick={() => setStatus(s)} style={{ '--c': STATUS_COLORS[s][1] }} title={'Set status to ' + s}>
                    <span className="od-dot">{state === 'done' ? '✓' : i + 1}</span><span className="od-lab">{s}</span>
                    {i < a.length - 1 && <span className="od-line" />}
                  </button>
                );
              })}
            </div>
            {STATUSES.includes('Cancelled') && !riderOnly && <button type="button" className={'od-cancel' + (o.status === 'Cancelled' ? ' on' : '')} onClick={() => setStatus('Cancelled')}>✕ Cancel this order</button>}
          </div>
          {!riderOnly && (
            <div className="od-inv">
              <span className="inv-ic">📄</span>
              <div className="od-inv-t"><b>INV-{id.replace(/^\D+/, '')}</b><small>{o.payStatus === 'Paid' ? 'Paid' : 'Payment due'} · {fmtMoney(o.total)}</small></div>
              <div className="od-inv-a">
                <button type="button" onClick={() => setShowPdf(true)} title="View the invoice as PDF"><PdfIcon size={14} /> PDF</button>
                <button type="button" onClick={() => downloadFile(`/orders/${id}/invoice.pdf`, 'INV-' + id.replace(/^\D+/, '') + '.pdf').catch(e => setErr(e.message))} title="Download the invoice">⤓ Download</button>
                <button type="button" className="hot" onClick={() => setMail({ to: o.customer.email || '', message: '' })} title="Email the invoice to the customer">✉ Email</button>
              </div>
            </div>
          )}
          {o.hold && <div className="od-hold">⏸ {o.holdNote}</div>}
          <section className="od-card">
            <h4>Contact &amp; delivery</h4>
            <div className="od-rows">
              <div><span className="od-ic"><svg viewBox="0 0 24 24"><path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5 5l1.3-2 4 1.6V17a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg></span><div><small>Phone</small><a href={'tel:' + o.customer.phone}>{o.customer.phone}</a></div></div>
              {o.customer.email && <div><span className="od-ic"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg></span><div><small>Email</small><span>{o.customer.email}</span></div></div>}
              <div className="wide"><span className="od-ic"><svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg></span><div><small>Delivery address · {AREA[o.area]}</small><span>{o.address}</span></div></div>
              <div><span className="od-ic"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></svg></span><div><small>Payment</small><span><b>{o.payment}</b> · {o.payStatus}</span></div></div>
              {o.company && <div><span className="od-ic"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h2M14 8h2M8 12h2M14 12h2M10 21v-4h4v4" /></svg></span><div><small>Company</small><span>{o.company} · BIN {o.bin}</span></div></div>}
              {o.note && <div><span className="od-ic"><svg viewBox="0 0 24 24"><path d="M5 4h14v12H9l-4 4z" /></svg></span><div><small>Note</small><span>{o.note}</span></div></div>}
            </div>
          </section>
          <section className="od-card">
            <h4>Items <em>{o.items.reduce((t, i) => t + i.qty, 0)}</em></h4>
            <div className="od-items">
              {o.items.map(i => (
                <div key={i.id} className="od-item">
                  <div className="a-thumb" style={{ backgroundImage: i.img ? `url('${i.img}')` : 'none' }} />
                  <span className="od-nm">{i.name}{i.backorder > 0 && <b className="od-bo"> +{i.backorder} on back-order</b>}<small>{fmtMoney(i.price)} each</small></span>
                  <i className="od-q">× {i.qty}</i>
                  <b>{fmtMoney(i.price * i.qty)}</b>
                </div>
              ))}
            </div>
            <div className="od-sum">
              <div><span>Subtotal</span><span>{fmtMoney(o.subtotal)}</span></div>
              <div><span>Discount</span><span>− {fmtMoney(o.discount)}</span></div>
              <div><span>Delivery</span><span>{o.delivery ? fmtMoney(o.delivery) : 'Free'}</span></div>
              <div className="tot"><span>Total</span><span>{fmtMoney(o.total)}</span></div>
            </div>
          </section>
          <section className="od-card">
            <h4>Timeline &amp; comments <em>{o.history.length}</em></h4>
            <form className="od-cm" onSubmit={postComment}>
              <textarea rows={3} value={cm.text} onChange={e => setCm(c => ({ ...c, text: e.target.value }))} placeholder="Add a comment for your team (not shown to the customer)…" maxLength={255} />
              <div><small>{cm.err || `${cm.text.length}/255`}</small><button className="a-btn sm grad" disabled={cm.busy || !cm.text.trim()}>{cm.busy ? 'Posting…' : '💬 Post comment'}</button></div>
            </form>
            <ol className="od-hist">
              {[...o.history].reverse().map((h, i) => (
                <li key={i} className={h.kind === 'comment' ? 'cmt' : ''} style={{ '--c': h.kind === 'comment' ? '#6b7388' : STATUS_COLORS[h.s]?.[1] || '#13306b' }}>
                  <div className="od-he"><b>{h.kind === 'comment' ? '💬 Comment' : h.s}</b><span className="mono">{dateTimeF(h.at)}</span></div>
                  {h.note && <p>{h.kind === 'comment' ? h.note : '“' + h.note + '”'}</p>}
                  {h.by && <small>by {h.by}</small>}
                </li>
              ))}
            </ol>
          </section>
          {canDelete && o.status === 'Cancelled' && <button onClick={del} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: 'oklch(0.5 0.2 350)', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>Delete order</button>}
        </>
      )}
      {chg && o && <StatusDialog id={id} from={o.status} to={chg} onClose={() => setChg(null)} onSaved={x => { setO(x); onChanged(); setChg(null); }} />}
      {mail && o && (
        <Modal kicker="Invoice" title={'Email INV-' + id.replace(/^\D+/, '') + ' to the customer'} onClose={() => setMail(null)}
          onSubmit={async e => {
            e.preventDefault();
            setMail(m => ({ ...m, busy: true, err: '' }));
            try { const r = await adm.post(`/orders/${id}/invoice/email`, { to: mail.to, message: mail.message }); setMail(m => ({ ...m, busy: false, done: r.to })); onChanged(); adm.get('/orders/' + id).then(setO).catch(() => {}); }
            catch (x) { setMail(m => ({ ...m, busy: false, err: x.message })); }
          }}
          footer={mail.done
            ? <button type="button" className="a-btn" onClick={() => setMail(null)}>Close</button>
            : <><button type="button" className="a-btn ghost" onClick={() => setMail(null)}>Cancel</button><button className="a-btn grad" disabled={mail.busy}>{mail.busy ? 'Sending…' : '✉ Send invoice'}</button></>}>
          {mail.done ? (
            <div className="a-msg ok" style={{ fontSize: 14 }}>✓ The invoice PDF was sent to <b>{mail.done}</b>.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 13.5, color: '#4b5263', lineHeight: 1.5 }}>The PDF invoice for order <b>{id}</b> ({fmtMoney(o.total)}) is attached to the email automatically.</span>
              <label className="a-lbl">Customer email<input className="a-input" type="email" required value={mail.to} onChange={e => setMail(m => ({ ...m, to: e.target.value }))} placeholder="customer@example.com" /></label>
              <label className="a-lbl">Message (optional)<textarea className="a-input" rows={3} value={mail.message} onChange={e => setMail(m => ({ ...m, message: e.target.value }))} placeholder="A short note that appears above the order summary" /></label>
              {mail.err && <div className="a-msg err">{mail.err}</div>}
            </div>
          )}
        </Modal>
      )}
    </Drawer>
    </>
  );
}

