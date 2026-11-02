import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard.jsx';
import { api, fmt, fmtDate, fmtTime, setToken } from '../api.js';
import { printInvoice } from '../invoice.js';
import { useStore } from '../store.jsx';
import './accountInline.css';

const acc = {
  get: u => api.get('/account' + u), post: (u, b) => api.post('/account' + u, b), put: (u, b) => api.put('/account' + u, b),
  del: async (u, b) => {
    const res = await fetch('/api/account' + u, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: b ? JSON.stringify(b) : undefined });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Something went wrong');
    return d;
  }
};
const STEPS = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];
const SCOL = { Pending: ['oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'], Confirmed: ['oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)'], Packed: ['oklch(0.95 0.03 300)', 'oklch(0.42 0.14 300)'], Shipped: ['oklch(0.95 0.04 200)', 'oklch(0.42 0.12 210)'], Delivered: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'], Cancelled: ['oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'], New: ['oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'], Scheduled: ['oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)'], 'In progress': ['oklch(0.95 0.03 300)', 'oklch(0.42 0.14 300)'], Completed: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'] };
const Badge = ({ s }) => <span className="ac-badge" style={{ background: (SCOL[s] || [])[0], color: (SCOL[s] || [])[1] }}>{s}</span>;
const H2 = ({ children, right }) => <div className="ac-h2"><h2>{children}</h2>{right}</div>;
const Thumb = ({ src, size = 40 }) => <div className="ac-thumb" style={{ width: size, height: size }}>{src && <div style={{ width: size - 8, height: size - 8, backgroundImage: `url('${src}')` }} />}</div>;
const summary = o => { const n = o.items.reduce((a, i) => a + i.qty, 0); return `${o.items[0]?.name.split(' (')[0] || ''}${o.items.length > 1 ? ` + ${o.items.length - 1} more` : ''} · ${n} item${n > 1 ? 's' : ''}`; };

function useOrders() {
  const [orders, setOrders] = useState(null);
  const { user } = useStore();
  const reload = useCallback(() => (user ? api.get('/orders').then(setOrders).catch(() => setOrders([])) : Promise.resolve()), [user]); // no request while signed out
  useEffect(() => { reload(); }, [reload]);
  return [orders, reload];
}

function useBuyAgain() {
  const { addToCart, find, say } = useStore();
  const nav = useNavigate();
  return items => {
    let n = 0;
    items.forEach(i => { const p = find(i.id); if (p && p.price) { addToCart(p, i.qty); n++; } });
    if (n) nav('/cart'); else say('Those products are no longer available');
  };
}

function Overview({ orders, profile, reminders }) {
  const { wish, find, site } = useStore();
  const active = (orders || []).find(o => !['Delivered', 'Cancelled'].includes(o.status));
  const recent = (orders || []).slice(0, 4);
  const idx = active ? STEPS.indexOf(active.status) : -1;
  const code = site.coupon, pct = profile?.since ? 10 : 5;
  return (
    <>
      {active && (
        <div className="ac-card ac-s1">
          <div className="ac-s2">
            <div className="ac-s3">
              <Thumb src={active.items[0]?.img} size={56} />
              <div className="ac-s4">
                <span className="ac-live"><i />LIVE · {active.id}</span>
                <b className="ac-s5">{active.status === 'Shipped' ? 'On its way to you' : active.status === 'Packed' ? 'Packed and ready' : active.status === 'Confirmed' ? 'Order confirmed' : 'Order received'}</b>
                <span className="ac-s6">{summary(active)}</span>
              </div>
            </div>
            <Link to={'/account/orders/' + active.id} className="ac-btn ghost">Track order</Link>
          </div>
          <div className="ac-s7">
            {STEPS.map((s, i) => <div key={s} className="ac-s8"><span className={i <= idx ? 'ac-bar on' : 'ac-bar'} /><span style={{ fontSize: 12, fontWeight: 600, color: i <= idx ? '#0b1631' : '#9aa1b2' }}>{s}</span></div>)}
          </div>
        </div>
      )}
      <div className="ac-grid2">
        <div className="ac-card ac-s9">
          <div className="ac-card-hd"><b>Recent orders</b><Link to="/account/orders" className="ac-link">View all →</Link></div>
          {orders === null && <div className="ac-s10"><span className="spin" /></div>}
          {orders && !recent.length && <div className="ac-s11">No orders yet. <Link to="/shop/all" className="ac-s12">Start shopping</Link></div>}
          {recent.map(o => (
            <Link key={o.id} to={'/account/orders/' + o.id} className="ac-row">
              <Thumb src={o.items[0]?.img} size={44} />
              <div className="ac-s13"><b className="ac-s14">{o.id} <span className="ac-s15">· {fmtDate(o.date)}</span></b><span className="ac-s16">{summary(o)}</span></div>
              <div className="ac-s17"><b>{fmt(o.total)}</b><Badge s={o.status} /></div>
            </Link>
          ))}
        </div>
        <div className="ac-s18">
          <div className="ac-member">
            <span className="sheen" />
            <div className="ac-s19"><span className="ac-s20">AR TRADE MEMBER</span><img src="/ar-icon-round.png" alt="" className="ac-s21" /></div>
            <div className="ac-s22">
              <span className="ac-s23">{pct}% off your next order</span>
              <div className="ac-s24"><span className="mono ac-s25">{code}</span><span className="ac-s26">Apply at checkout</span></div>
            </div>
          </div>
          <Link to="/account/wishlist" className="ac-card ac-s27">
            <div className="ac-s28"><b className="ac-s29">Wishlist →</b><span className="ac-s6">{wish.length} saved items</span></div>
            <div className="ac-s30">{wish.slice(0, 3).map(find).filter(Boolean).map(p => <div key={p.id} className="ac-stack"><div style={{ backgroundImage: `url('${p.img}')` }} /></div>)}</div>
          </Link>
          {reminders?.some(r => r.active && new Date(r.next) <= new Date(Date.now() + 7 * 864e5)) && (
            <Link to="/account/refill" className="ac-card ac-s31"><b>⏰ A refill is due soon</b><span className="ac-s6">Open Refill reminders to reorder in one tap.</span></Link>
          )}
          <div className="ac-card ac-s27">
            <div className="ac-s32"><span className="ac-s33"><span className="ac-s34" /></span><div className="ac-s35"><b>Support is online</b><span className="ac-s6">Sat–Thu, 10:00–20:00</span></div></div>
            <a href={'https://wa.me/' + site.whatsapp} target="_blank" rel="noreferrer" className="ac-btn ac-s36">WhatsApp</a>
          </div>
        </div>
      </div>
    </>
  );
}

function Orders({ orders }) {
  const buyAgain = useBuyAgain();
  const [f, setF] = useState('All');
  const list = (orders || []).filter(o => f === 'All' || (f === 'Active' ? !['Delivered', 'Cancelled'].includes(o.status) : o.status === f));
  return (
    <>
      <H2 right={<div className="ac-seg">{['All', 'Active', 'Delivered', 'Cancelled'].map(x => <button key={x} className={f === x ? 'on' : ''} onClick={() => setF(x)}>{x}</button>)}</div>}>Orders</H2>
      <div className="ac-card ac-s37">
        <div className="ac-s38">
          <div className="ac-thead ac-s39"><span>Order</span><span>Items</span><span>Date</span><span>Status</span><span className="ac-s40">Total</span><span /></div>
          {orders === null && <div className="ac-s10"><span className="spin" /></div>}
          {list.map(o => (
            <div key={o.id} className="ac-trow ac-s39">
              <Link to={'/account/orders/' + o.id} className="ac-s41">{o.id}</Link>
              <div className="ac-s42"><Thumb src={o.items[0]?.img} /><span className="ac-s43">{summary(o)}</span></div>
              <span className="ac-s44">{fmtDate(o.date)}</span><Badge s={o.status} /><b className="ac-s40">{fmt(o.total)}</b>
              <div className="ac-s45"><Link to={'/account/orders/' + o.id} className="ac-btn ghost sm">Details</Link><button className="ac-btn ghost sm" onClick={() => buyAgain(o.items)}>Buy again</button></div>
            </div>
          ))}
        </div>
      </div>
      {orders && !list.length && <div className="ac-card ac-s46">No orders in this view.</div>}
    </>
  );
}

function OrderDetail({ orders, reload }) {
  const { id } = useParams();
  const { site, say } = useStore();
  const buyAgain = useBuyAgain();
  const o = (orders || []).find(x => x.id === id);
  if (orders === null) return <span className="spin" />;
  if (!o) return <div className="ac-card">Order not found. <Link to="/account/orders" className="ac-s41">Back to orders</Link></div>;
  const cancel = async () => {
    if (!window.confirm('Cancel order ' + o.id + '?')) return;
    try { await acc.post(`/orders/${o.id}/cancel`); say('Order cancelled'); reload(); } catch (e) { say(e.message); }
  };
  const idx = STEPS.indexOf(o.status);
  const steps = o.status === 'Cancelled' ? o.history.map(h => h.s) : STEPS;
  return (
    <>
      <div className="crumbs ac-s47"><Link to="/account/orders">Orders</Link><span>/</span><span className="ac-s48">{o.id}</span></div>
      <div className="ac-s49">
        <div className="ac-s28"><h2 className="ac-title">Order {o.id}</h2><span className="ac-s50">Placed {fmtDate(o.date)} · {o.payment}</span></div>
        <div className="ac-s51">
          <Badge s={o.status} />
          {o.status === 'Delivered' && <button className="ac-btn grad" onClick={() => printInvoice(o, site)}>⤓ Invoice (PDF)</button>}
          <button className="ac-btn ghost" onClick={() => buyAgain(o.items)}>Buy again</button>
          {['Pending', 'Confirmed'].includes(o.status) && <button className="ac-btn ghost ac-s52" onClick={cancel}>Cancel order</button>}
        </div>
      </div>
      <div className="ac-grid2">
        <div className="ac-card ac-s53">
          <b className="ac-s54">Tracking</b>
          {steps.map((s, i) => {
            const h = o.history.find(x => x.s === s);
            const done = o.status === 'Cancelled' ? true : i <= idx;
            return (
              <div key={s} className="ac-s55">
                <div className="ac-s56">
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: done ? 'oklch(0.55 0.17 258)' : '#fff', border: '2px solid ' + (done ? 'oklch(0.55 0.17 258)' : '#cfd5e1'), marginTop: 3 }} />
                  {i < steps.length - 1 && <span style={{ flex: 1, width: 2, minHeight: 26, background: done && (o.status === 'Cancelled' || i < idx) ? 'oklch(0.55 0.17 258)' : '#e6e9f0' }} />}
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, color: done ? '#16181d' : '#9aa1b2', paddingBottom: 20 }}>{s}</span>
                <span className="ac-s57">{h ? fmtTime(h.at) : ''}</span>
              </div>
            );
          })}
        </div>
        <div className="ac-s18">
          <div className="ac-card ac-s58">
            <b className="ac-s59">Items</b>
            {o.items.map(i => <div key={i.id} className="ac-s60"><Thumb src={i.img} size={48} /><span>{i.name} <span className="ac-s61">× {i.qty}</span>{i.backorder > 0 && <b className="ac-s62"> (+{i.backorder} to follow)</b>}</span><b>{fmt(i.price * i.qty)}</b></div>)}
            <div className="ac-s63">
              <div className="ac-sum"><span>Subtotal</span><span>{fmt(o.subtotal)}</span></div>
              <div className="ac-sum"><span>Discount</span><span>− {fmt(o.discount)}</span></div>
              <div className="ac-sum"><span>Delivery</span><span>{o.delivery ? fmt(o.delivery) : 'Free'}</span></div>
              <div className="ac-sum ac-s64"><span className="ac-s65">Total</span><span>{fmt(o.total)}</span></div>
            </div>
          </div>
          <div className="ac-card ac-s66">
            <b className="ac-s67">Delivery address</b>
            <span><b>{o.customer.name}</b> · {o.customer.phone}</span><span>{o.address}</span>
            <span className="ac-s50">{o.area === 'outside' ? 'Outside Dhaka' : o.area === 'suburb' ? 'Dhaka suburbs' : 'Inside Dhaka'}{o.slot ? ' · ' + o.slot : ''}</span>
            {o.note && <span className="ac-s50">Note: {o.note}</span>}
          </div>
        </div>
      </div>
    </>
  );
}

function Wishlist() {
  const { wish, find } = useStore();
  const items = wish.map(find).filter(Boolean);
  return (
    <>
      <H2>Wishlist</H2>
      <div className="ac-s68">{items.map(p => <ProductCard key={p.id} p={p} />)}</div>
      {!items.length && <div className="ac-card ac-s46">Tap ♡ on any product to save it here.</div>}
    </>
  );
}

function Servicing() {
  const [rows, setRows] = useState(null);
  useEffect(() => { acc.get('/services').then(setRows).catch(() => setRows([])); }, []);
  return (
    <>
      <H2 right={<Link to="/services" className="ac-btn dark">Book new service</Link>}>Service requests</H2>
      <div className="ac-card ac-s9">
        {rows === null && <div className="ac-s10"><span className="spin" /></div>}
        {rows?.map(v => (
          <div key={v.id} className="ac-s69">
            <div className="ac-s70"><b>{v.type} <span className="ac-s15">· {v.id}</span></b><span>{v.model} — {v.issue}</span><span className="ac-s6">Preferred date: {v.date ? fmtDate(v.date) : '—'}</span></div>
            <Badge s={v.status} />
          </div>
        ))}
        {rows && !rows.length && <div className="ac-s46">No service requests yet.</div>}
      </div>
    </>
  );
}

function Compare() {
  const { compare, setCompare, products, find, cats } = useStore();
  const slots = [0, 1, 2].map(i => compare[i] || '');
  const pick = (i, v) => { const n = [...slots]; n[i] = v ? Number(v) : ''; setCompare(n.filter(Boolean).filter((x, k, a) => a.indexOf(x) === k)); };
  const items = compare.map(find).filter(Boolean);
  const specOf = p => Object.fromEntries([['Brand', p.brand], ['Part no.', p.part], ['Technology', p.tech], ['Colour', p.color], ['Yield', p.yield], ['Compatible', p.compat], ...(p.extra || [])].filter(r => r[1] && r[1] !== '—'));
  const sp = items.map(specOf);
  const keys = ['Price', 'Category', 'Stock', ...new Set(sp.flatMap(o => Object.keys(o)))];
  const val = (k, p, j) => (k === 'Price' ? (p.price ? fmt(p.price) : 'Ask') : k === 'Category' ? cats.find(c => c.id === p.cat)?.t || '—' : k === 'Stock' ? (p.stock > 0 ? `In stock (${p.stock})` : 'Out of stock') : sp[j][k] || '—');
  return (
    <>
      <H2 right={<button className="ac-btn ghost" onClick={() => setCompare([])}>Clear all</button>}>Compare products</H2>
      <span className="ac-s71">Pick 2 or 3 products to see their specs side by side.</span>
      <div className="ac-s72">
        {slots.map((v, i) => { const p = find(v); return (
          <div key={i} className="ac-card ac-s73">
            <span className="mono ac-s74">PRODUCT {i + 1}</span>
            <select className="ac-input" value={v} onChange={e => pick(i, e.target.value)}><option value="">Select a product…</option>{products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            {p && <div className="ac-s75"><Thumb src={p.img} size={64} /><span className="ac-s35"><b className="ac-s76">{p.name}</b><b className="ac-s77">{p.price ? fmt(p.price) : 'Ask price'}</b></span></div>}
          </div>
        ); })}
      </div>
      {items.length >= 2 ? (
        <div className="ac-s78">
          <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${items.length},minmax(200px,1fr))`, minWidth: 600 }}>
            {keys.map((k, i) => (
              <div key={k} className="ac-s79">
                <div style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#5d6270', background: i % 2 ? '#fafbfd' : '#fff', borderBottom: '1px solid #f1f3f7' }}>{k}</div>
                {items.map((p, j) => <div key={p.id} style={{ padding: '12px 16px', fontSize: 13.5, background: i % 2 ? '#fafbfd' : '#fff', borderLeft: '1px solid #f1f3f7', borderBottom: '1px solid #f1f3f7', fontWeight: k === 'Price' ? 800 : 400 }}>{val(k, p, j)}</div>)}
              </div>
            ))}
          </div>
        </div>
      ) : <div className="ac-s80">Select at least 2 products to compare.</div>}
    </>
  );
}

function Profile({ profile, setProfile }) {
  const { setUser, say } = useStore();
  const [f, setF] = useState(profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => setF(profile), [profile]);
  const on = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const age = f.dob ? Math.floor((Date.now() - new Date(f.dob)) / 31557600000) : null;
  const submit = async e => {
    e.preventDefault();
    try { const p = await acc.put('/profile', f); setProfile(p); setUser(u => ({ ...u, name: p.name, phone: p.phone, email: p.email, address: p.address, area: p.area })); setSaved(true); setTimeout(() => setSaved(false), 2500); } catch (er) { say(er.message); }
  };
  return (
    <>
      <H2>Profile</H2>
      <form className="ac-card ac-s81" onSubmit={submit} >
        <div className="ac-fields">
          <label className="ac-lbl">Full name<input className="ac-input" value={f.name || ''} onChange={on('name')} /></label>
          <label className="ac-lbl">Mobile<input className="ac-input" value={f.phone || ''} onChange={on('phone')} /></label>
          <label className="ac-lbl">Email<input className="ac-input" value={f.email || ''} onChange={on('email')} /></label>
          <label className="ac-lbl">Gender<select className="ac-input" value={f.gender || ''} onChange={on('gender')}><option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Other</option></select></label>
          <label className="ac-lbl">Date of birth {age != null && <span className="ac-s61">· {age} yrs</span>}<input className="ac-input" type="date" value={f.dob || ''} onChange={on('dob')} /></label>
          <label className="ac-lbl">Organisation (optional)<input className="ac-input" value={f.org || ''} onChange={on('org')} placeholder="Company, office or school" /></label>
          <label className="ac-lbl">BIN / VAT no. (for invoices)<input className="ac-input" value={f.bin || ''} onChange={on('bin')} placeholder="Optional" /></label>
          <label className="ac-lbl">Delivery area<select className="ac-input" value={f.area || 'inside'} onChange={on('area')}><option value="inside">Inside Dhaka</option><option value="suburb">Dhaka suburbs</option><option value="outside">Outside Dhaka</option></select></label>
        </div>
        <label className="ac-lbl">Default address<textarea className="ac-input" rows={3} value={f.address || ''} onChange={on('address')} /></label>
        <label className="ac-lbl">My printer / copier models<input className="ac-input" value={f.devices || ''} onChange={on('devices')} placeholder="e.g. HP M12w, Toshiba 2508A" /></label>
        <div className="ac-s82"><button className="ac-btn dark">Save changes</button>{saved && <span className="ac-s83">Changes saved</span>}</div>
      </form>
      <PasswordForm />
    </>
  );
}

function PasswordForm() {
  const [msg, setMsg] = useState('');
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { await acc.put('/password', d); setMsg('Password changed'); e.target.reset(); } catch (er) { setMsg(er.message); }
  };
  return (
    <form className="ac-card ac-s84" onSubmit={submit} >
      <b>Change password</b>
      <div className="ac-fields"><label className="ac-lbl">Current password<input className="ac-input" type="password" name="current" required /></label><label className="ac-lbl">New password<input className="ac-input" type="password" name="next" required minLength={8} /></label></div>
      <div className="ac-s32"><button className="ac-btn ghost">Update password</button>{msg && <span className="ac-s85">{msg}</span>}</div>
    </form>
  );
}

const THANAS = ['Ramna', 'Motijheel', 'Dhanmondi', 'Mirpur', 'Uttara', 'Gulshan', 'Banani', 'Tejgaon', 'Mohammadpur', 'Paltan', 'Khilgaon', 'Savar', 'Gazipur Sadar', 'Narayanganj Sadar', 'Kotwali', 'Panchlaish'];
const DISTRICTS = ['Dhaka', 'Gazipur', 'Narayanganj', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi', 'Barishal', 'Rangpur', 'Mymensingh'];

function Addresses() {
  const [rows, setRows] = useState(null);
  const [pin, setPin] = useState({ lat: 23.7394, lng: 90.4119 });
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const load = () => acc.get('/addresses').then(setRows);
  useEffect(() => { load(); }, []);
  const map = (lat, lng, z = 16) => `https://maps.google.com/maps?q=${lat},${lng}&z=${z}&output=embed`;
  const nudge = (dy, dx) => setPin(p => ({ lat: +(p.lat + dy).toFixed(6), lng: +(p.lng + dx).toFixed(6) }));
  const locate = () => navigator.geolocation?.getCurrentPosition(p => setPin({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }), () => setErr('Location permission was denied'));
  const add = async e => {
    e.preventDefault(); setErr('');
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { await acc.post('/addresses', { ...d, isDefault: !!d.def, lat: pin.lat, lng: pin.lng }); e.target.reset(); setSaved(true); setTimeout(() => setSaved(false), 2500); load(); } catch (er) { setErr(er.message); }
  };
  return (
    <>
      <H2 right={<span className="ac-s6">Pick one at checkout. The default is used first.</span>}>Saved addresses</H2>
      <div className="ac-s86">
        {rows?.map(a => (
          <div key={a.id} className="ac-card ac-s9">
            <div className="ac-s87">{a.lat && <iframe src={map(a.lat, a.lng, 15)} title="Map" loading="lazy" className="ac-s88" />}</div>
            <div className="ac-s89">
              <div className="ac-s90"><b className="ac-s91">{a.label}</b>{a.isDefault && <span className="ac-s92">Default</span>}</div>
              <span className="ac-s93">{a.line}</span>
              <span className="ac-s94">{a.area} · {a.thana} · {a.district}</span>
              {a.lat && <span className="mono ac-s95">📍 {a.lat}, {a.lng}</span>}
            </div>
            <div className="ac-s96">
              {!a.isDefault && <button className="ac-btn ghost sm" onClick={async () => { await acc.put(`/addresses/${a.id}/default`); load(); }}>Set default</button>}
              <button className="ac-btn ghost sm ac-s52" onClick={async () => { await acc.del('/addresses/' + a.id); load(); }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {rows && !rows.length && <div className="ac-card ac-s97">No saved addresses yet.</div>}
      <form className="ac-card ac-s98" onSubmit={add} >
        <div className="ac-s99">
          <b className="ac-s91">Add a new address</b>
          <div className="ac-s100">
            <label className="ac-lbl">Label<select className="ac-input" name="label">{['Home', 'Office', 'Warehouse', 'Parents', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="ac-lbl">District<select className="ac-input" name="district">{DISTRICTS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="ac-lbl">Thana<input className="ac-input" name="thana" list="ar-thanas" required placeholder="e.g. Ramna" /></label>
            <label className="ac-lbl">Area<input className="ac-input" name="area" required placeholder="e.g. Shantinagar" /></label>
          </div>
          <datalist id="ar-thanas">{THANAS.map(t => <option key={t} value={t} />)}</datalist>
          <label className="ac-lbl">House, road, floor<textarea className="ac-input" name="line" rows={2} required placeholder="House 12, Road 4, 3rd floor" /></label>
          <label className="ac-s101"><input type="checkbox" name="def" />Make this my default address</label>
          {err && <span className="ac-s102">{err}</span>}
          <div className="ac-s75"><button className="ac-btn dark">Save address</button>{saved && <span className="ac-s83">Address saved</span>}</div>
        </div>
        <div className="ac-s103">
          <div className="ac-s104"><b className="ac-s105">Map pin</b><button type="button" className="ac-btn ghost sm" onClick={locate}>◎ Use my location</button></div>
          <div className="ac-s106"><iframe src={map(pin.lat, pin.lng)} title="Pin map" className="ac-s107" /></div>
          <div className="ac-s108">{[['↑', .0008, 0], ['↓', -.0008, 0], ['←', 0, -.0008], ['→', 0, .0008]].map(([l, dy, dx]) => <button key={l} type="button" className="ac-btn ghost sm" onClick={() => nudge(dy, dx)}>{l}</button>)}</div>
          <span className="mono ac-s109">{pin.lat}, {pin.lng}</span>
        </div>
      </form>
    </>
  );
}

function Family() {
  const [rows, setRows] = useState(null);
  const [addrs, setAddrs] = useState([]);
  const { user, say } = useStore();
  const nav = useNavigate();
  const load = () => acc.get('/family').then(setRows);
  useEffect(() => { load(); acc.get('/addresses').then(setAddrs); }, []);
  const add = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { await acc.post('/family', { name: d.name, relation: d.rel, phone: d.phone, address: d.addr }); e.target.reset(); load(); } catch (er) { say(er.message); }
  };
  const options = [...addrs.map(a => `${a.label} — ${a.line}, ${a.area}`), user?.address].filter(Boolean);
  const COLORS = ['oklch(0.55 0.15 250)', 'oklch(0.6 0.15 150)', 'oklch(0.62 0.18 350)', 'oklch(0.65 0.15 60)'];
  return (
    <>
      <H2 right={<span className="ac-s6">Order for parents, children or colleagues from one account.</span>}>Family &amp; team</H2>
      <div className="ac-s110">
        {rows?.map((f, i) => (
          <div key={f.id} className="ac-card ac-s111">
            <div className="ac-s112"><span style={{ width: 44, height: 44, borderRadius: '50%', background: COLORS[i % 4], color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 17 }}>{f.name[0]}</span><div className="ac-s113"><b className="ac-s91">{f.name}</b><span className="ac-s94">{f.relation} · {f.phone}</span></div></div>
            <span className="ac-s94">Delivers to: <b className="ac-s114">{f.address}</b></span>
            <div className="ac-s115">
              <button className="ac-btn dark sm" onClick={() => { try { sessionStorage.setItem('ar_order_for', JSON.stringify(f)); } catch { /* storage unavailable */ } nav('/shop/all'); }}>Order for {f.name.split(' ')[0]}</button>
              <button className="ac-btn ghost sm ac-s52" onClick={async () => { await acc.del('/family/' + f.id); load(); }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {rows && !rows.length && <div className="ac-card ac-s97">No sub-profiles yet. Add a family member or colleague below.</div>}
      <form className="ac-card ac-s116" onSubmit={add} >
        <b className="ac-s91">Add a sub-profile</b>
        <div className="ac-s117">
          <label className="ac-lbl">Name<input className="ac-input" name="name" required placeholder="Full name" /></label>
          <label className="ac-lbl">Relation<select className="ac-input" name="rel">{['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Sibling', 'Colleague', 'Branch office'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="ac-lbl">Mobile<input className="ac-input" name="phone" pattern="01[0-9]{9}" placeholder="01XXXXXXXXX" /></label>
          <label className="ac-lbl">Delivery address<select className="ac-input" name="addr">{options.length ? options.map(o => <option key={o}>{o}</option>) : <option>Same as mine</option>}</select></label>
        </div>
        <div><button className="ac-btn dark">Add sub-profile</button></div>
      </form>
    </>
  );
}

function Refill({ orders, reload: reloadRem, rems }) {
  const { find, addToCart, say } = useStore();
  const nav = useNavigate();
  const buyAgain = useMemo(() => {
    const seen = new Map();
    (orders || []).forEach(o => o.items.forEach(i => { if (!seen.has(i.id)) seen.set(i.id, { ...i, last: o.date }); }));
    return [...seen.values()].slice(0, 12);
  }, [orders]);
  const order = (id, qty) => { const p = find(id); if (p?.price) { addToCart(p, qty); nav('/cart'); } else say('This product is not available right now'); };
  const remind = async i => { await acc.post('/reminders', { productId: i.id, qty: i.qty, every: 30 }); reloadRem(); };
  const due = r => { const d = Math.ceil((new Date(r.next) - Date.now()) / 864e5); return d <= 0 ? ['Due now', 'oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'] : d <= 7 ? [`In ${d} days`, 'oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'] : [`In ${d} days`, 'oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)']; };
  return (
    <>
      <H2 right={<span className="ac-s6">We'll remind you before your toner or ink runs out.</span>}>Refill reminders</H2>
      <div className="ac-card ac-s9">
        <div className="ac-card-hd"><b>Active reminders</b><span className="ac-s94">{rems?.filter(r => r.active).length || 0} active</span></div>
        {rems && !rems.length && <div className="ac-s118">No reminders yet. Tap “Remind me” on an item below.</div>}
        {rems?.map(r => {
          const [chip, bg, fg] = due(r);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f3f4f7', flexWrap: 'wrap', opacity: r.active ? 1 : .55 }}>
              <Thumb src={r.img} size={52} />
              <div className="ac-s119"><b className="ac-s120">{r.name}</b><span className="ac-s94">Qty {r.qty} · next on {fmtDate(r.next)}</span></div>
              <span style={{ fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 999, background: bg, color: fg }}>{chip}</span>
              <select className="ac-input ac-s121" value={r.every} onChange={async e => { await acc.put('/reminders/' + r.id, { every: e.target.value }); reloadRem(); }}>{[15, 30, 45, 60, 90].map(d => <option key={d} value={d}>Every {d} days</option>)}</select>
              <label className="ac-s122"><input type="checkbox" checked={r.active} onChange={async e => { await acc.put('/reminders/' + r.id, { active: e.target.checked }); reloadRem(); }} />On</label>
              <button className="ac-btn dark sm" onClick={() => order(r.productId, r.qty)}>Order now</button>
              <button className="ac-btn ghost sm" title="Remove" onClick={async () => { await acc.del('/reminders/' + r.id); reloadRem(); }}>✕</button>
            </div>
          );
        })}
      </div>
      <div className="ac-card ac-s9">
        <div className="ac-card-hd ac-s123"><b>Buy again</b><span className="ac-s94">From your past orders</span></div>
        {!buyAgain.length && <div className="ac-s118">Items you order will appear here.</div>}
        <div className="ac-s124">
          {buyAgain.map(b => (
            <div key={b.id} className="ac-s125">
              <Thumb src={b.img} size={48} />
              <div className="ac-s126"><b className="ac-s127">{b.name}</b><span className="ac-s94">{fmt(b.price)} · last {fmtDate(b.last)}</span></div>
              <button className="ac-btn dark sm" onClick={() => order(b.id, b.qty)}>Reorder</button>
              {!rems?.some(r => r.productId === b.id) && <button className="ac-btn ghost sm" onClick={() => remind(b)}>Remind me</button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const TOPICS = [['orders', 'Order updates', 'Confirmation, packing and delivery status'], ['delivery', 'Delivery alerts', 'Rider on the way and OTP codes'], ['offers', 'Offers & deals', 'Friday deals and new arrivals'], ['refill', 'Refill reminders', 'Before your toner or ink runs out'], ['service', 'Servicing', 'Technician visits and repair updates']];

function Settings({ profile, setProfile }) {
  const { logout, say } = useStore();
  const nav = useNavigate();
  const [ask, setAsk] = useState(false);
  const toggle = async (topic, ch, on) => {
    const notifs = { ...profile.notifs, [topic]: { ...profile.notifs[topic], [ch]: on } };
    setProfile({ ...profile, notifs });
    try { await acc.put('/profile', { ...profile, notifs }); } catch (e) { say(e.message); }
  };
  const download = async () => {
    const d = await acc.get('/export');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'ar-trade-my-data.json'; a.click();
  };
  const del = async e => {
    e.preventDefault();
    try { await acc.del('/me', { confirm: new FormData(e.target).get('c') }); setToken(null); logout(); nav('/'); } catch (er) { say(er.message); }
  };
  return (
    <>
      <H2>Notifications &amp; privacy</H2>
      <div className="ac-card ac-s128">
        <div className="ac-card-hd"><b>Notification settings</b><span className="ac-s94">Changes save automatically</span></div>
        <div className="ac-ntop"><span>TOPIC</span><span>SMS</span><span>EMAIL</span><span>PUSH</span></div>
        {TOPICS.map(([k, t, d]) => (
          <div key={k} className="ac-nrow">
            <div className="ac-s13"><b className="ac-s120">{t}</b><span className="ac-s94">{d}</span></div>
            {['sms', 'email', 'push'].map(c => <label key={c} className="ac-s129"><input type="checkbox" checked={!!profile.notifs[k]?.[c]} onChange={e => toggle(k, c, e.target.checked)} className="ac-s130" /></label>)}
          </div>
        ))}
      </div>
      <div className="ac-s131">
        <div className="ac-card ac-s132"><b>Download my data</b><span className="ac-s133">Get a copy of your profile, addresses, sub-profiles, orders and reminders as a JSON file.</span><div><button className="ac-btn ghost" onClick={download}>⤓ Download data</button></div></div>
        <div className="ac-card ac-s134">
          <b className="ac-s135">Delete account</b>
          <span className="ac-s133">Removes your account and saved details. Invoices for past orders are kept as required by law.</span>
          {!ask ? <div><button className="ac-btn ghost ac-s136" onClick={() => setAsk(true)}>Request deletion</button></div> : (
            <form onSubmit={del} className="ac-s8">
              <label className="ac-lbl">Type DELETE to confirm<input className="ac-input" name="c" required pattern="DELETE" autoComplete="off" /></label>
              <div className="ac-s115"><button className="ac-btn ac-s137">Delete my account</button><button type="button" className="ac-btn ghost" onClick={() => setAsk(false)}>Cancel</button></div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export default function Account() {
  const { user, logout, cartCount, wish } = useStore();
  const [orders, reloadOrders] = useOrders();
  const [profile, setProfile] = useState(null);
  const [rems, setRems] = useState(null);
  const loadRems = useCallback(() => acc.get('/reminders').then(setRems).catch(() => setRems([])), []);
  useEffect(() => { if (user) { acc.get('/profile').then(setProfile).catch(() => {}); loadRems(); } }, [user, loadRems]);
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="ac-s138"><span className="spin" /></div>;

  const live = (orders || []).filter(o => o.status !== 'Cancelled');
  const spent = live.reduce((a, o) => a + o.total, 0);
  const hour = new Date().getHours();
  const greet = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${user.name.split(' ')[0]}`;
  const kpis = [['▤', 'Orders', live.length], ['৳', 'Total spent', fmt(spent)], ['♡', 'Wishlist', wish.length], ['⌂', 'In cart', cartCount]];
  const nav = [['', 'Overview'], ['orders', 'Orders', orders?.length], ['wishlist', 'Wishlist', wish.length], ['services', 'Servicing'], ['compare', 'Compare'], ['profile', 'Profile'], ['addresses', 'Addresses'], ['family', 'Family & team'], ['refill', 'Refill reminders', rems?.length], ['settings', 'Notifications & privacy']];

  return (
    <div className="ac-page">
      <section className="ac-hero">
        <div className="in">
          <div className="ac-s139">
            <div className="ac-s140">
              <div className="ac-av"><div>{user.name[0].toUpperCase()}</div></div>
              <div className="ac-s141">
                <span className="ac-eyebrow"><i />Member since {new Date(profile.since).getFullYear()}</span>
                <h1>{greet}</h1>
              </div>
            </div>
            <div className="ac-s142">
              <Link to="/services" className="ac-hbtn">Book servicing</Link>
              <Link to="/shop/toner" className="ac-hbtn solid">Re-order toner →</Link>
            </div>
          </div>
          <div className="ac-kpis">{kpis.map(([ic, t, v]) => <div key={t}><span>{ic}</span><div><small>{t}</small><b>{v}</b></div></div>)}</div>
        </div>
      </section>
      <div className="ac-wrap">
        <aside className="ac-side">
          <span className="ac-menu">MENU</span>
          {nav.map(([to, t, c]) => (
            <NavLink key={to} to={'/account' + (to ? '/' + to : '')} end={!to} className={({ isActive }) => 'ac-nav' + (isActive ? ' on' : '')}>
              <i /><span>{t}</span>{c > 0 && <em>{c}</em>}
            </NavLink>
          ))}
          <div className="ac-s143" />
          <button className="ac-nav out" onClick={logout}><i />Sign out</button>
        </aside>
        <main className="ac-main">
          <Routes>
            <Route index element={<Overview orders={orders} profile={profile} reminders={rems} />} />
            <Route path="orders" element={<Orders orders={orders} />} />
            <Route path="orders/:id" element={<OrderDetail orders={orders} reload={reloadOrders} />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="services" element={<Servicing />} />
            <Route path="compare" element={<Compare />} />
            <Route path="profile" element={<Profile profile={profile} setProfile={setProfile} />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="family" element={<Family />} />
            <Route path="refill" element={<Refill orders={orders} rems={rems} reload={loadRems} />} />
            <Route path="settings" element={<Settings profile={profile} setProfile={setProfile} />} />
            <Route path="*" element={<Navigate to="/account" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
