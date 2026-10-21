import { useEffect, useState } from 'react';
import { printInvoice } from '../../invoice.js';
import { adm, ago, dateF, dateTimeF, fmtMoney, STATUS_COLORS, useTable } from '../adminApi.js';
import { Drawer, Empty, Pager, Pill, Toolbar } from '../ui.jsx';

const STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
const AREA = { inside: 'Inside Dhaka', suburb: 'Dhaka suburbs', outside: 'Outside Dhaka' };

export function Dashboard({ go }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { adm.get('/dashboard').then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <div className="a-msg err">{err}</div>;
  if (!d) return <span className="spin" />;
  const k = d.kpis;
  const max = Math.max(...d.chart.map(c => c.value), 1);
  return (
    <>
      <div className="kpis">
        {[['Revenue · 7 days', fmtMoney(k.weekRevenue), k.weekOrders + ' orders'], ['Pending orders', k.pending, 'Need confirmation call'], ['Avg. order value', fmtMoney(k.avgOrder), 'All time'], ['Service requests', k.openServices, k.newServices + ' new']]
          .map(([t, v, s]) => <div className="kpi" key={t}><small>{t}</small><b>{v}</b><span>{s}</span></div>)}
      </div>
      <div className="grid2">
        <div className="a-card">
          <h3>Revenue · last 7 days</h3>
          <div className="bars">{d.chart.map(c => <div key={c.label}><span>{c.value ? Math.round(c.value / 1000) + 'k' : ''}</span><i style={{ height: Math.round(c.value / max * 100) + '%' }} /><small>{c.label}</small></div>)}</div>
        </div>
        <div className="a-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3>Low stock</h3><a href="/admin/products" onClick={e => { e.preventDefault(); go('products'); }} style={{ fontWeight: 700 }}>Manage</a></div>
          {!d.lowStock.length && <span style={{ color: '#5d6270' }}>Nothing is running low.</span>}
          {d.lowStock.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '4px 0' }}>
              <div className="a-thumb" style={{ width: 40, height: 40, backgroundImage: p.img ? `url('${p.img}')` : 'none' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <b style={{ color: 'oklch(0.5 0.2 350)' }}>{p.stock} left</b>
            </div>
          ))}
        </div>
      </div>
      <div className="a-card" style={{ padding: '8px 20px 12px', gap: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}><h3>Recent orders</h3><a href="/admin/orders" onClick={e => { e.preventDefault(); go('orders'); }} style={{ fontWeight: 700 }}>All orders</a></div>
        {!d.recent.length && <span style={{ color: '#5d6270', padding: '8px 0' }}>No orders yet.</span>}
        {d.recent.map(o => (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '100px minmax(0,1fr) 110px 110px', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid #efede8' }}>
            <b>{o.id}</b><span>{o.customer} · <span style={{ color: '#5d6270' }}>{ago(o.at)}</span></span><Pill s={o.status} /><b style={{ textAlign: 'right' }}>{fmtMoney(o.total)}</b>
          </div>
        ))}
      </div>
    </>
  );
}

function OrderDrawer({ id, site, onClose, onChanged, canDelete, riderOnly }) {
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { adm.get('/orders/' + id).then(setO).catch(e => setErr(e.message)); }, [id]);
  const setStatus = async status => {
    try { const n = await adm.put(`/orders/${id}/status`, { status }); setO(n); onChanged(); } catch (e) { setErr(e.message); }
  };
  const del = async () => { if (!window.confirm('Delete order ' + id + '? This cannot be undone.')) return; await adm.del('/orders/' + id); onChanged(); onClose(); };
  return (
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
          {o.status === 'Delivered' && (
            <div style={{ borderRadius: 14, padding: 14, background: 'linear-gradient(135deg,#0b1631,#173a7a)', color: '#fff', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <b>INV-{id.replace('AR-', '')}</b>
              <button className="a-btn sm" style={{ background: '#fff', color: '#0b1631' }} onClick={() => printInvoice(o, site)}>⎙ View invoice</button>
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
    </Drawer>
  );
}

export function Orders({ site, staff }) {
  const t = useTable('/orders', { status: '', pay: '' });
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
      <Toolbar t={t} filters={[{ key: 'pay', label: 'All payments', options: ['bKash', 'Nagad', 'Rocket', 'Card', 'Cash on delivery', 'Bank'] }]} />
      <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
        <div style={{ minWidth: 760 }}>
          <div className="head" style={{ gridTemplateColumns: '100px minmax(160px,1fr) 120px 140px 120px 110px' }}><span>Order</span><span>Customer</span><span>Date</span><span>Payment</span><span>Status</span><span style={{ textAlign: 'right' }}>Total</span></div>
          {t.data.rows.map(o => (
            <button key={o.id} className="row" style={{ gridTemplateColumns: '100px minmax(160px,1fr) 120px 140px 120px 110px' }} onClick={() => setOpen(o.id)}>
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

export function Customers() {
  const t = useTable('/customers');
  const [reqs, setReqs] = useState([]);
  const [link, setLink] = useState(null); // { name, url, phone }
  const loadReqs = () => adm.get('/password-resets').then(setReqs).catch(() => {});
  useEffect(() => { loadReqs(); }, []);
  const makeLink = async c => {
    try { const r = await adm.post(`/customers/${c.userId}/reset-link`); setLink({ name: c.name, phone: c.phone, url: window.location.origin + r.path, hours: r.hours }); loadReqs(); } catch (e) { window.alert(e.message); }
  };
  const setPw = async c => {
    const pw = window.prompt(`New password for ${c.name} (min 6 characters). Tell the customer this password; they can change it from their account.`);
    if (!pw) return;
    try { await adm.put(`/customers/${c.userId}/password`, { password: pw }); window.alert('Password updated.'); loadReqs(); } catch (e) { window.alert(e.message); }
  };
  const cols = 'minmax(180px,1fr) 140px 70px 110px 110px 210px';
  return (
    <>
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
        <div className="a-card" style={{ background: 'oklch(0.96 0.04 150)', borderColor: 'oklch(0.86 0.07 150)' }}>
          <b>Reset link for {link.name} (valid {link.hours} hours, one use)</b>
          <input className="a-input" readOnly value={link.url} onFocus={e => e.target.select()} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="a-btn sm" onClick={() => navigator.clipboard?.writeText(link.url)}>Copy link</button>
            <a className="a-btn ghost sm" target="_blank" rel="noreferrer" href={`https://wa.me/88${String(link.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent('AR Trade: set a new password here (valid 24 hours): ' + link.url)}`}>Send on WhatsApp</a>
            <button className="a-btn ghost sm" onClick={() => setLink(null)}>Close</button>
          </div>
        </div>
      )}
      <Toolbar t={t} />
      <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
        <div style={{ minWidth: 820 }}>
          <div className="head" style={{ gridTemplateColumns: cols }}><span>Customer</span><span>Phone</span><span>Orders</span><span>Lifetime</span><span>Last order</span><span>Password</span></div>
          {t.data.rows.map(c => (
            <div key={c.phone + c.name} className="row" style={{ gridTemplateColumns: cols }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}><b>{c.name}</b><span style={{ color: '#5d6270', fontSize: 12 }}>{c.email}</span></span>
              <a href={'tel:' + c.phone}>{c.phone}</a><span>{c.n}</span><b>{fmtMoney(c.ltv)}</b><span style={{ color: '#5d6270' }}>{dateF(c.last)}</span>
              {c.userId ? <span style={{ display: 'flex', gap: 6 }}><button className="a-btn ghost sm" onClick={() => makeLink(c)}>Reset link</button><button className="a-btn ghost sm" onClick={() => setPw(c)}>Set…</button></span> : <span style={{ color: '#8a8f9b', fontSize: 12 }}>no account</span>}
            </div>
          ))}
        </div>
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
