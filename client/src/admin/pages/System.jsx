import { useEffect, useState } from 'react';
import { adm, dateF } from '../adminApi.js';
import { Pill } from '../ui.jsx';

const ROLE_INFO = [
  ['Super admin', '★', 'Everything, including approving staff', ['Orders', 'Products', 'Customers', 'Marketing', 'Team', 'Settings']],
  ['Admin', '◆', 'Runs the store day to day', ['Orders', 'Products', 'Customers', 'Services', 'Careers', 'Team']],
  ['Delivery rider', '⚑', 'Sees packed and shipped orders only', ['Pick up', 'Mark delivered']],
  ['Marketing manager', '✉', 'Campaigns, subscribers and inbox', ['Campaigns', 'Subscribers', 'Inbox']],
  ['Content writer', '✎', 'Writes and publishes blog articles', ['Blog articles', 'Image upload']]
];

export function Team({ me }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const load = () => adm.get('/staff').then(setRows).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = async (id, body) => { try { await adm.put('/staff/' + id, body); load(); } catch (e) { setErr(e.message); } };
  return (
    <>
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><b style={{ fontSize: 15 }}>User roles</b><span style={{ color: '#5d6270' }}>Who can do what across the store and console</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, padding: '16px 20px' }}>
          {ROLE_INFO.map(([name, icon, desc, can]) => (
            <div key={name} style={{ border: '1px solid #e6e9f0', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: '#fbfcfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 34, height: 34, borderRadius: 10, background: 'oklch(0.95 0.03 240)', color: 'oklch(0.42 0.15 250)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{icon}</span><b style={{ fontSize: 14 }}>{name}</b></div>
              <span style={{ fontSize: 13, color: '#3a3f4b', lineHeight: 1.45 }}>{desc}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{can.map(c => <span key={c} style={{ fontSize: 11, fontWeight: 700, background: '#eef2f8', color: '#2b3550', borderRadius: 6, padding: '3px 7px' }}>{c}</span>)}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#5d6270' }}>{rows.filter(r => r.role === name).length} member(s)</span>
            </div>
          ))}
        </div>
      </div>
      {err && <div className="a-msg err">{err}</div>}
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4' }}><b style={{ fontSize: 15 }}>Team accounts</b></div>
        {rows.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f3f4f7', flexWrap: 'wrap' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#16181d', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{a.name[0]}</span>
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column' }}><b style={{ fontSize: 14 }}>{a.name}{a.id === me.id && ' (you)'}</b><span style={{ fontSize: 12, color: '#5d6270' }}>{a.email} · {a.role} · since {dateF(a.since)}</span></div>
            {a.id !== me.id && <select className="a-input" value={a.role} onChange={e => act(a.id, { role: e.target.value })} style={{ width: 'auto', padding: '7px 10px', fontSize: 12, fontWeight: 700 }}>{ROLE_INFO.map(([r]) => <option key={r}>{r}</option>)}</select>}
            <Pill s={a.status === 'Pending' ? 'New' : a.status} label={a.status} />
            {a.id !== me.id && a.status !== 'Active' && <button className="a-btn sm" onClick={() => act(a.id, { status: 'Active' })}>Approve</button>}
            {a.id !== me.id && a.status === 'Active' && <button className="a-btn sm ghost" onClick={() => act(a.id, { status: 'Disabled' })}>Disable</button>}
          </div>
        ))}
      </div>
    </>
  );
}

const PAYS = [['COD', 'Cash on delivery'], ['bKash', 'bKash'], ['Nagad', 'Nagad'], ['Rocket', 'Rocket'], ['Card', 'Card'], ['Bank', 'Bank transfer']];

export function Settings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { adm.get('/settings').then(setS).catch(e => setErr(e.message)); }, []);
  if (!s) return err ? <div className="a-msg err">{err}</div> : <span className="spin" />;
  const set = k => e => setS(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setPay = (k, v) => setS(x => ({ ...x, payments: { ...x.payments, [k]: v } }));
  const setSvc = (i, k, v) => setS(x => ({ ...x, svcPrices: x.svcPrices.map((p, j) => (j === i ? { ...p, [k]: +v } : p)) }));
  const save = async e => {
    e.preventDefault(); setErr(''); setMsg('');
    try { setS(await adm.put('/settings', s)); setMsg('Saved — the storefront updates immediately.'); } catch (er) { setErr(er.message); }
  };
  const F = ({ k, label, type = 'text', style }) => <label className="a-lbl">{label}<input className="a-input" type={type} value={s[k] ?? ''} onChange={set(k)} style={style} /></label>;
  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="a-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3>Storefront content</h3><label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={!!s.showPromo} onChange={set('showPromo')} />Show promo ticker</label></div>
        <F k="promo" label="Promo ticker text" /><F k="heroTitle" label="Home hero headline" />
        <label className="a-lbl">Home hero subtext<textarea className="a-input" rows={2} value={s.heroSub || ''} onChange={set('heroSub')} /></label>
        <div className="a-fields"><F k="offerTitle" label="Offer banner headline" /><F k="offerSub" label="Offer banner subtext" /></div>
      </div>
      <div className="a-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><h3>Home page · category product rows</h3><label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={s.homeRails !== false} onChange={set('homeRails')} />Show on home page</label></div>
        <div className="a-fields"><label className="a-lbl">Products per category row (1–20)<input className="a-input" type="number" min="1" max="20" value={s.homeRailLimit ?? 20} onChange={set('homeRailLimit')} /></label></div>
        <span style={{ fontSize: 12, color: '#6b7080' }}>Each category shows its best products (with photo, price, popular or discounted first) up to this limit, scrolling round and round.</span>
      </div>
      <div className="a-card">
        <h3>Popups</h3>
        <div className="a-fields">
          <label className="a-lbl">Which popups show<select className="a-input" value={s.popupMode || 'one'} onChange={set('popupMode')}>
            <option value="one">Only one popup per visit (recommended)</option>
            <option value="sequential">Both, one after the other (never together)</option>
            <option value="promo">Mega toner sale popup only</option>
            <option value="newsletter">Newsletter popup only</option>
            <option value="off">No popups</option>
          </select></label>
          <label className="a-lbl">Sale popup appears after (seconds)<input className="a-input" type="number" min="0" max="120" value={s.promoDelay ?? 1} onChange={set('promoDelay')} /></label>
          <label className="a-lbl">Newsletter popup appears after (seconds)<input className="a-input" type="number" min="1" max="600" value={s.nlDelay ?? 30} onChange={set('nlDelay')} /></label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={s.nlExit !== false} onChange={set('nlExit')} />Newsletter popup also when the visitor is about to leave (exit intent)</label>
        <span style={{ fontSize: 12, color: '#6b7080' }}>Each popup shows at most once per visit. A popup never opens while another is open.</span>
      </div>
      <div className="a-card">
        <h3>Checkout &amp; delivery</h3>
        <div className="a-fields">
          <F k="insideFee" type="number" label="Delivery fee — inside Dhaka (৳)" /><F k="suburbFee" type="number" label="Delivery fee — suburbs (৳)" /><F k="outsideFee" type="number" label="Delivery fee — outside Dhaka (৳)" /><F k="freeOver" type="number" label="Free delivery over (৳)" />
          <F k="coupon" label="Coupon code" style={{ textTransform: 'uppercase' }} /><F k="couponPct" type="number" label="Coupon discount (%)" />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Payment methods</span>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>{PAYS.map(([k, l]) => <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={s.payments?.[k] !== false} onChange={e => setPay(k, e.target.checked)} />{l}</label>)}</div>
      </div>
      <div className="a-card">
        <h3>Store contact</h3>
        <div className="a-fields"><F k="phone" label="Phone" /><F k="whatsapp" label="WhatsApp number" /><F k="email" label="Email" /><F k="address" label="Address" /></div>
      </div>
      <div className="a-card" style={{ gap: 8 }}>
        <h3>Servicing price list</h3>
        {s.svcPrices.map((p, i) => (
          <div key={p.t} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 110px', gap: 10, alignItems: 'center', borderTop: '1px solid #efede8', paddingTop: 8 }}>
            <span>{p.t}</span><input className="a-input" type="number" title="Regular" value={p.reg} onChange={e => setSvc(i, 'reg', e.target.value)} /><input className="a-input" type="number" title="Offer" value={p.offer} onChange={e => setSvc(i, 'offer', e.target.value)} />
          </div>
        ))}
      </div>
      <div className="a-save"><span>{err ? <b style={{ color: '#ffb4ab' }}>{err}</b> : msg || 'Changes apply to the storefront as soon as you save.'}</span><button className="a-btn" style={{ background: 'oklch(0.82 0.13 85)', color: '#16181d', fontWeight: 800 }}>Save all settings</button></div>
    </form>
  );
}
