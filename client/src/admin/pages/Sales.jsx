import { useEffect, useState } from 'react';
import { adm, can, downloadFile, dateF, dateTimeF, fmtMoney, slNo, STATUS_COLORS, useTable } from '../adminApi.js';
import { Drawer, Empty, Modal, Pager, Pill, Summary, Toolbar, alertBox, confirmBox } from '../ui.jsx';
import { PdfIcon, PdfPreview } from '../fieldKit.jsx';

const STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
const AREA = { inside: 'Inside Dhaka', suburb: 'Dhaka suburbs', outside: 'Outside Dhaka' };

function OrderDrawer({ id, site, onClose, onChanged, canDelete, riderOnly }) {
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  const [mail, setMail] = useState(null); // { to, message, busy, err, done }
  const [showPdf, setShowPdf] = useState(false);
  useEffect(() => { adm.get('/orders/' + id).then(setO).catch(e => setErr(e.message)); }, [id]);
  const setStatus = async status => {
    try { const n = await adm.put(`/orders/${id}/status`, { status }); setO(n); onChanged(); } catch (e) { setErr(e.message); }
  };
  const del = async () => { if (!(await confirmBox('Delete order ' + id + '? This cannot be undone.', { danger: true, confirmLabel: 'Delete order' }))) return; await adm.del('/orders/' + id); onChanged(); onClose(); };
  return (
    <>
    {showPdf && <PdfPreview url={`/api/admin/orders/${id}/invoice.pdf`} title={'INV-' + id.replace(/^\D+/, '')} filename={'INV-' + id.replace(/^\D+/, '') + '.pdf'} onClose={() => setShowPdf(false)} />}
    <Drawer title={id} sub={o ? dateTimeF(o.date) : ''} onClose={onClose}>
      {err && <div className="a-msg err">{err}</div>}
      {!o ? <span className="spin" /> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Update status</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUSES.filter(s => !riderOnly || ['Shipped', 'Delivered'].includes(s)).map(s => {
                const on = o.status === s, [bg, fg] = STATUS_COLORS[s];
                return <button key={s} className="a-chip" onClick={() => setStatus(s)} style={{ background: on ? fg : '#fff', color: on ? '#fff' : fg, borderColor: on ? fg : bg }}>{s}</button>;
              })}
            </div>
          </div>
          {!riderOnly && (
            <div className="inv-card">
              <div className="inv-t"><span className="inv-ic">📄</span><div><b>INV-{id.replace(/^\D+/, '')}</b><small>{o.payStatus === 'Paid' ? 'Paid' : 'Payment due'} · {fmtMoney(o.total)}</small></div></div>
              <div className="inv-act">
                <button type="button" className="a-btn sm" onClick={() => setShowPdf(true)}><PdfIcon size={16} /> View PDF</button>
                <button type="button" className="a-btn sm" onClick={() => downloadFile(`/orders/${id}/invoice.pdf`, 'INV-' + id.replace(/^\D+/, '') + '.pdf').catch(e => setErr(e.message))}>⤓ Download</button>
                <button type="button" className="a-btn sm grad" onClick={() => setMail({ to: o.customer.email || '', message: '' })}>✉ Email to customer</button>
              </div>
            </div>
          )}
          {o.hold && <div className="a-msg" style={{ background: 'oklch(0.97 0.02 250)', color: '#0b1631' }}>⏸ {o.holdNote}</div>}
          <div className="a-box">
            <b>{o.customer.name}</b><a href={'tel:' + o.customer.phone}>{o.customer.phone}</a><span style={{ color: '#5d6270' }}>{o.customer.email}</span>
            <span>{o.address} · {AREA[o.area]}</span>
            <span>Payment: <b>{o.payment}</b> · {o.payStatus}</span>
            {o.slot && <span>Slot: {o.slot}</span>}
            {o.company && <span>Company: {o.company} · BIN {o.bin}</span>}
            {o.note && <span style={{ color: '#5d6270' }}>Note: {o.note}</span>}
          </div>
          <div className="a-box" style={{ gap: 10 }}>
            {o.items.map(i => (
              <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
                <div className="a-thumb" style={{ backgroundImage: i.img ? `url('${i.img}')` : 'none' }} />
                <span>{i.name} × {i.qty}{i.backorder > 0 && <b style={{ color: 'oklch(0.5 0.15 60)' }}> (+{i.backorder} on back-order)</b>}</span><b>{fmtMoney(i.price * i.qty)}</b>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e4e2dc', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{fmtMoney(o.subtotal)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>− {fmtMoney(o.discount)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery</span><span>{o.delivery ? fmtMoney(o.delivery) : 'Free'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}><span>Total</span><span>{fmtMoney(o.total)}</span></div>
            </div>
          </div>
          <div className="a-box" style={{ fontSize: 12, gap: 6 }}>
            <b style={{ fontSize: 13 }}>History</b>
            {o.history.map((h, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{h.s}</span><span className="mono" style={{ color: '#5d6270' }}>{dateTimeF(h.at)}</span></div>)}
          </div>
          {canDelete && <button onClick={del} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: 'oklch(0.5 0.2 350)', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>Delete order</button>}
        </>
      )}
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

export function Orders({ site, staff }) {
  const t = useTable('/orders', { status: '', pay: '', summary: 1 });
  const [open, setOpen] = useState(null);
  const counts = t.data.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const rider = staff.role === 'Delivery rider';
  return (
    <>
      <div className="a-chips">
        <button className={'a-chip' + (!t.params.status ? ' on' : '')} onClick={() => t.set({ status: '' })}>All · {all}</button>
        {STATUSES.map(s => <button key={s} className={'a-chip' + (t.params.status === s ? ' on' : '')} onClick={() => t.set({ status: s })}>{s} · {counts[s] || 0}</button>)}
      </div>
      {t.data.summary && (() => {
        const m = t.data.summary;
        return <Summary items={[
          ['Orders', m.total, m.cancelled + ' cancelled', 'blue', 'cart'],
          ['Revenue', fmtMoney(m.revenue), 'Avg ' + fmtMoney(m.avg) + ' per order', 'green', 'money'],
          ['Today', m.today, fmtMoney(m.todayRevenue) + ' today', 'violet', 'clock'],
          ['Open orders', m.open, fmtMoney(m.openValue) + ' to deliver', 'amber', 'truck'],
          ['To collect', fmtMoney(m.unpaid), 'Unpaid, not cancelled', 'red', 'alert']
        ]} />;
      })()}
      <Toolbar t={t} filters={[{ key: 'pay', label: 'All payments', options: ['bKash', 'Nagad', 'Rocket', 'Card', 'Cash on delivery', 'Bank'] }]} />
      <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
        <div style={{ minWidth: 804 }}>
          <div className="head" style={{ gridTemplateColumns: '44px 100px minmax(160px,1fr) 120px 140px 120px 110px' }}><span>SL</span><span>Order</span><span>Customer</span><span>Date</span><span>Payment</span><span>Status</span><span style={{ textAlign: 'right' }}>Total</span></div>
          {t.data.rows.map((o, i) => (
            <button key={o.id} className="row" style={{ gridTemplateColumns: '44px 100px minmax(160px,1fr) 120px 140px 120px 110px' }} onClick={() => setOpen(o.id)}>
              <span className="sl">{slNo(t, i)}</span>
              <b>{o.id}</b>
              <span style={{ display: 'flex', flexDirection: 'column' }}><b style={{ fontWeight: 600 }}>{o.customer.name}</b><span style={{ color: '#5d6270', fontSize: 12 }}>{o.customer.phone} · {AREA[o.area]}</span></span>
              <span style={{ color: '#5d6270' }}>{dateF(o.date)}</span><span>{o.payment}{o.payStatus === 'Paid' ? ' ✓' : ''}</span><Pill s={o.status} />
              <b style={{ textAlign: 'right' }}>{fmtMoney(o.total)}</b>
            </button>
          ))}
        </div>
      </div>
      <Empty t={t} /><Pager t={t} />
      {open && <OrderDrawer id={open} site={site} riderOnly={rider} canDelete={!rider} onClose={() => setOpen(null)} onChanged={t.reload} />}
    </>
  );
}

export function Deliveries() {
  const packed = useTable('/orders', { status: 'Packed', size: 50 });
  const shipped = useTable('/orders', { status: 'Shipped', size: 50 });
  const rows = [...shipped.data.rows, ...packed.data.rows];
  const move = async (id, status) => { await adm.put(`/orders/${id}/status`, { status }); packed.reload(); shipped.reload(); };
  return (
    <>
      <div className="kpis">
        {[['Waiting for pickup', packed.data.total], ['Out for delivery', shipped.data.total], ['COD to collect', fmtMoney(rows.filter(o => o.payStatus !== 'Paid').reduce((a, o) => a + o.total, 0))]].map(([l, v]) => <div className="kpi" key={l}><small>{l}</small><b>{v}</b></div>)}
      </div>
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><b style={{ fontSize: 15 }}>Delivery queue</b><span style={{ color: '#5d6270' }}>Pick up packed orders, then mark them delivered</span></div>
        {!rows.length && <div style={{ padding: '30px 20px', textAlign: 'center', color: '#5d6270', fontSize: 14 }}>No orders waiting for pickup or delivery.</div>}
        {rows.map(o => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f3f4f7', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <b style={{ fontSize: 14 }}>{o.id} · {o.customer.name}</b>
              <span style={{ fontSize: 12, color: '#5d6270' }}>{o.address} · {AREA[o.area]}</span>
              <span style={{ fontSize: 12, color: '#5d6270' }}>{o.items.reduce((a, i) => a + i.qty, 0)} item(s) · {fmtMoney(o.total)} · {o.payment}{o.slot ? ' · ' + o.slot : ''}</span>
            </div>
            <Pill s={o.status} />
            <a href={'tel:' + o.customer.phone} className="a-btn sm ghost">Call</a>
            {o.status === 'Packed' && <button className="a-btn sm" onClick={() => move(o.id, 'Shipped')}>Picked up</button>}
            {o.status === 'Shipped' && <button className="a-btn sm green" onClick={() => move(o.id, 'Delivered')}>Mark delivered</button>}
          </div>
        ))}
      </div>
    </>
  );
}

const PW_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const newPassword = () => {
  const a = new Uint32Array(10); crypto.getRandomValues(a);
  return [...a.slice(0, 8)].map(n => PW_CHARS[n % PW_CHARS.length]).join('') + [...a.slice(8)].map(n => '23456789'[n % 8]).join('');
};

/** Set a customer's password: live rule check, a generator and a copy button, in the console's own dialog. */
function SetPasswordModal({ c, onClose, onDone }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const rules = [['At least 8 characters', pw.length >= 8], ['A letter', /[A-Za-z]/.test(pw)], ['A number', /\d/.test(pw)]];
  const valid = rules.every(r => r[1]);
  const copy = async () => { try { await navigator.clipboard.writeText(pw); setCopied(true); } catch { setErr('Could not copy. Select the password and copy it by hand.'); } };
  const submit = async e => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setErr('');
    try { await adm.put(`/customers/${c.userId}/password`, { password: pw }); setSaved(true); onDone(); } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  return (
    <Modal narrow kicker="Customer account" title={saved ? 'Password updated' : 'Set a new password'} onClose={onClose} onSubmit={submit}
      footer={saved
        ? <button type="button" className="a-btn" onClick={onClose}>Done</button>
        : <><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn" disabled={!valid || busy}>{busy ? 'Saving…' : 'Set password'}</button></>}>
      <p className="pwm-who"><b>{c.name}</b>{c.phone ? ' · ' + c.phone : ''}</p>
      <p className="pwm-note">{saved ? 'Tell the customer this password now. It is not shown again, and they can change it from their account.' : 'Choose a password and share it with the customer. They can change it from their account.'}</p>
      <div className="pwm-field">
        <input className="a-input" type={show ? 'text' : 'password'} value={pw} onChange={e => { setPw(e.target.value); setCopied(false); }} placeholder="New password" autoFocus readOnly={saved} autoComplete="new-password" aria-label="New password" />
        <button type="button" className="pwm-eye" onClick={() => setShow(s => !s)} aria-pressed={show} title={show ? 'Hide' : 'Show'}>{show ? 'Hide' : 'Show'}</button>
      </div>
      <div className="pwm-acts">
        {!saved && <button type="button" className="a-mini" onClick={() => { setPw(newPassword()); setShow(true); setCopied(false); }}>✦ Generate a strong one</button>}
        <button type="button" className="a-mini" disabled={!pw} onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
      {!saved && <ul className="pwm-rules">{rules.map(([t, ok]) => <li key={t} className={ok ? 'ok' : ''}>{ok ? '✓' : '○'} {t}</li>)}</ul>}
      {err && <div className="a-msg err">{err}</div>}
    </Modal>
  );
}

export function Customers() {
  const t = useTable('/customers');
  const [reqs, setReqs] = useState([]);
  const [link, setLink] = useState(null); // { name, url, phone }
  const [copied, setCopied] = useState(false);
  const loadReqs = () => adm.get('/password-resets').then(setReqs).catch(() => {});
  useEffect(() => { loadReqs(); }, []);
  const makeLink = async c => {
    try { const r = await adm.post(`/customers/${c.userId}/reset-link`); setLink({ name: c.name, phone: c.phone, url: window.location.origin + r.path, hours: r.hours }); loadReqs(); } catch (e) { alertBox(e.message); }
  };
  const [pwFor, setPwFor] = useState(null);
  const setPw = c => setPwFor(c);
  const cols = '44px minmax(180px,1fr) 140px 70px 110px 110px 250px';
  return (
    <>
      {pwFor && <SetPasswordModal c={pwFor} onClose={() => setPwFor(null)} onDone={loadReqs} />}
      {reqs.length > 0 && (
        <div className="a-card" style={{ background: 'oklch(0.97 0.03 85)', borderColor: 'oklch(0.9 0.06 85)' }}>
          <h3>🔑 Password reset requests ({reqs.length})</h3>
          {reqs.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid oklch(0.9 0.05 85)' }}>
              <span style={{ flex: 1, minWidth: 200 }}><b>{r.name}</b> · {r.phone} · {r.email}<br /><small style={{ color: '#6b7080' }}>asked {dateF(r.created)}</small></span>
              <button className="a-btn sm" onClick={() => makeLink({ userId: r.userId, name: r.name, phone: r.phone })}>Create reset link</button>
              <button className="a-btn ghost sm" onClick={async () => { await adm.del('/password-resets/' + r.id); loadReqs(); }}>Dismiss</button>
            </div>
          ))}
        </div>
      )}
      {link && (
        <Modal kicker="Password reset" title={'Reset link for ' + link.name} onClose={() => setLink(null)}
          footer={<>
            <button type="button" className="a-btn sm" onClick={() => { navigator.clipboard?.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? 'Copied ✓' : 'Copy link'}</button>
            <a className="a-btn ghost sm" target="_blank" rel="noreferrer" href={`https://wa.me/88${String(link.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent('AR Trade: set a new password here (valid 24 hours): ' + link.url)}`}>Send on WhatsApp</a>
            <button type="button" className="a-btn ghost sm" onClick={() => setLink(null)}>Close</button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#4b5263', lineHeight: 1.5 }}>Send this one-time link to <b>{link.name}</b>{link.phone ? ' (' + link.phone + ')' : ''}. It stays valid for <b>{link.hours} hours</b> and works once. The customer opens it and chooses a new password.</span>
            <input className="a-input" readOnly value={link.url} onFocus={e => e.target.select()} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          </div>
        </Modal>
      )}
      {t.data.summary && (() => {
        const m = t.data.summary, pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
        return <Summary items={[
          ['Customers', m.total, m.accounts + ' with an online account', 'blue', 'users'],
          ['Buyers', m.buyers, pct(m.buyers, m.total) + '% have placed an order', 'green', 'check'],
          ['Lifetime revenue', fmtMoney(m.revenue), 'Avg ' + fmtMoney(m.avg) + ' per buyer', 'violet', 'money'],
          ['Repeat customers', m.repeat, pct(m.repeat, m.buyers) + '% of buyers ordered 2+ times', 'amber', 'repeat'],
          ['New accounts', m.newAccounts, 'Registered in the last 30 days', 'blue', 'plus'],
          ['Top customer', m.top ? m.top.name : '–', m.top ? fmtMoney(m.top.ltv) + ' lifetime' : 'No orders yet', 'amber', 'star']
        ]} />;
      })()}
      <Toolbar t={t} />
      <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
        <div style={{ minWidth: 904 }}>
          <div className="head" style={{ gridTemplateColumns: cols }}><span>SL</span><span>Customer</span><span>Phone</span><span>Orders</span><span>Lifetime</span><span>Last order</span><span>Password</span></div>
          {t.data.rows.map((c, i) => (
            <div key={c.phone + c.name} className="row" style={{ gridTemplateColumns: cols }}>
              <span className="sl">{slNo(t, i)}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}><b>{c.name}</b><span style={{ color: '#5d6270', fontSize: 12 }}>{c.email}</span></span>
              <a href={'tel:' + c.phone}>{c.phone}</a><span>{c.n}</span><b>{fmtMoney(c.ltv)}</b><span style={{ color: '#5d6270' }}>{dateF(c.last)}</span>
              {c.userId ? <span style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}><button className="a-btn ghost sm" style={{ whiteSpace: 'nowrap' }} title="Create a one-time link the customer can use to choose a new password" onClick={() => makeLink(c)}>Reset link</button><button className="a-btn ghost sm" style={{ whiteSpace: 'nowrap' }} title="Type a new password for this customer yourself" onClick={() => setPw(c)}>Set password</button></span> : <span style={{ color: '#8a8f9b', fontSize: 12 }}>no account</span>}
            </div>
          ))}
        </div>
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
