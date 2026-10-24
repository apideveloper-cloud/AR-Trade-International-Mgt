import { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adm, dateF } from '../adminApi.js';
import { Modal, Pill, ROLE_HUE, Summary } from '../ui.jsx';
import { PAY } from '../../data.js';

/** A readable random password that passes the rule (8+ characters with a letter and a number). */
function genPassword() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz', D = '23456789', A = L + D;
  const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  let p = '';
  for (let i = 0; i < 8; i++) p += A[r(A.length)];
  return p + D[r(D.length)] + L[r(L.length)];
}

/** 0-4: how strong a password is (length, letters, digits, mixed case / symbol). */
function pwScore(p) {
  const v = String(p || '');
  let n = 0;
  if (v.length >= 8) n++;
  if (/[A-Za-z]/.test(v) && /\d/.test(v)) n++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++;
  if (v.length >= 12 || /[^A-Za-z0-9]/.test(v)) n++;
  return v.length ? Math.max(1, n) : 0;
}
const PW_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const blankMember = roles => ({ name: '', email: '', phone: '', role: (roles.find(r => r.assignable && !r.legacy && r.name !== 'Master Admin' && r.name !== 'Admin') || roles.find(r => r.assignable) || {}).name || '', password: genPassword(), show: true, nid: '', presentAddress: '', contactAddress: '', same: false, refName: '', refPhone: '' });

export function Team({ me }) {
  const [add, setAdd] = useState(null); // null | { id?, name, email, phone, role, password, show, nid, presentAddress, contactAddress, same, refName, refPhone, busy, err, done }
  const [copied, setCopied] = useState(false);
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [err, setErr] = useState('');
  const load = () => adm.get('/staff').then(setRows).catch(e => setErr(e.message));
  useEffect(() => { load(); adm.get('/staff/roles').then(setRoles).catch(e => setErr(e.message)); }, []);
  const act = async (id, body) => { try { await adm.put('/staff/' + id, body); setErr(''); load(); } catch (e) { setErr(e.message); } };
  const hue = r => ROLE_HUE[r] ?? 250;
  const pending = rows.filter(r => r.status === 'Pending').length;
  return (
    <>
      <Summary items={[
        ['Team members', rows.length, rows.filter(r => r.status === 'Active').length + ' active', 'blue', 'users'],
        ['Waiting for approval', pending, pending ? 'Open the list below to approve' : 'Nobody is waiting', 'amber', 'clock'],
        ['Roles in use', new Set(rows.map(r => r.role)).size, roles.filter(r => !r.legacy).length + ' main roles available', 'violet', 'tag'],
        ['Disabled', rows.filter(r => r.status === 'Disabled').length, 'Cannot sign in', 'red', 'alert']
      ]} />
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div className="mk-hd" style={{ padding: '12px 16px' }}><b>User roles</b><span style={{ flex: 1 }} />{me.perms?.includes('roles.manage') ? <Link to="/admin/roles" className="a-btn sm grad">Open the role matrix →</Link> : <span className="muted">What each role can do is set by the Master Admin</span>}</div>
        <div className="rl2-grid">
          {roles.filter(r => !r.legacy).map(r => {
            const mem = rows.filter(x => x.role === r.name);
            const total = Math.max(...roles.map(x => x.perms), 1);
            const body = (
              <>
                <div className="rl2-top"><span className="rl2-ic">{r.icon}</span><em title={mem.length + ' member(s)'}>{mem.length}</em></div>
                <b>{r.name}</b>
                <span className="rl2-desc">{r.desc}</span>
                <div className="rl2-ring" style={{ '--p': Math.round(r.perms / total * 100) }} title={r.perms + ' of ' + total + ' permissions'}><i>{r.perms}<small>/ {total}</small></i></div>
                <div className="rl2-av">
                  {mem.slice(0, 3).map(m => <span key={m.id} title={m.name}>{m.name[0]}</span>)}
                  {mem.length > 3 && <span className="more">+{mem.length - 3}</span>}
                  {!mem.length && <small>No members yet</small>}
                </div>
              </>
            );
            return me.perms?.includes('roles.manage')
              ? <Link key={r.name} to="/admin/roles" className="rl2" style={{ '--h': hue(r.name) }} title="Open the role matrix">{body}</Link>
              : <div key={r.name} className="rl2" style={{ '--h': hue(r.name) }}>{body}</div>;
          })}
        </div>
      </div>
      {err && <div className="a-msg err">{err}</div>}
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div className="mk-hd" style={{ padding: '12px 16px' }}><b>Team accounts</b><span className="chip">{rows.length}</span><span style={{ flex: 1 }} /><button type="button" className="a-btn sm grad" onClick={() => setAdd(blankMember(roles))}>＋ Add team member</button></div>
        {rows.map(a => (
          <div key={a.id} className="tm-row">
            <span className="tm-av" style={{ '--h': hue(a.role) }}>{a.name[0]}</span>
            <div className="tm-who"><b>{a.name}{a.id === me.id && <em>you</em>}</b><span>{a.email} · since {dateF(a.since)}</span></div>
            {a.id === me.id && <span className="tm-role" style={{ '--h': hue(a.role) }}>{a.role}</span>}
            {a.id !== me.id && <select className="a-input" value={a.role} onChange={e => act(a.id, { role: e.target.value })} style={{ width: 'auto', padding: '5px 8px', fontSize: 12, fontWeight: 700 }}>{roles.filter(r => r.assignable || r.name === a.role).map(r => <option key={r.name} disabled={!r.assignable}>{r.name}</option>)}</select>}
            <Pill s={a.status === 'Pending' ? 'New' : a.status} label={a.status} />
            <button type="button" className="a-btn sm ghost" onClick={() => setAdd({ id: a.id, name: a.name, email: a.email, phone: a.phone, role: a.role, nid: a.nid, presentAddress: a.presentAddress, contactAddress: a.contactAddress, same: !!a.presentAddress && a.presentAddress === a.contactAddress, refName: a.refName, refPhone: a.refPhone })}>Details</button>
            {a.id !== me.id && a.status !== 'Active' && <button className="a-btn sm" onClick={() => act(a.id, { status: 'Active' })}>Approve</button>}
            {me.role === 'Master Admin' && a.id !== me.id && a.status === 'Active' && <button type="button" className="a-btn sm ghost" title="Make this person the Master Admin; you become an Admin" onClick={async () => { const c = window.prompt('There is only one Master Admin. This makes ' + a.name + ' the Master Admin and turns you into an Admin.\n\nType TRANSFER to confirm.'); if (c === null) return; try { await adm.post('/staff/' + a.id + '/make-master', { confirm: c.trim() }); window.location.reload(); } catch (e) { setErr(e.message); } }}>★ Make Master</button>}
            {a.id !== me.id && a.status === 'Active' && <button className="a-btn sm ghost" onClick={() => act(a.id, { status: 'Disabled' })}>Disable</button>}
          </div>
        ))}
      </div>
      {add && (
        <Modal side kicker="Team" title={add.done ? 'Account created' : add.id ? 'Team member details' : 'Add a team member'} onClose={() => { setAdd(null); setCopied(false); }}
          onSubmit={async e => {
            e.preventDefault();
            setAdd(x => ({ ...x, busy: true, err: '' }));
            const body = { name: add.name, email: add.email, phone: add.phone, nid: add.nid, presentAddress: add.presentAddress, contactAddress: add.same ? add.presentAddress : add.contactAddress, refName: add.refName, refPhone: add.refPhone };
            try {
              if (add.id) { await adm.put('/staff/' + add.id + '/details', body); setAdd(null); }
              else { await adm.post('/staff', { ...body, role: add.role, password: add.password }); setAdd(x => ({ ...x, busy: false, done: true })); }
              load();
            } catch (x) { setAdd(v => ({ ...v, busy: false, err: x.message })); }
          }}
          footer={add.done
            ? <button type="button" className="a-btn" onClick={() => { setAdd(null); setCopied(false); }}>Done</button>
            : <><button type="button" className="a-btn ghost" onClick={() => setAdd(null)}>Cancel</button><button className="a-btn grad" disabled={add.busy}>{add.busy ? 'Saving…' : add.id ? 'Save details' : 'Create account'}</button></>}>
          {add.done ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="a-msg ok" style={{ fontSize: 14 }}>✓ <b>{add.name}</b> can sign in now as <b>{add.role}</b>.</div>
              <div className="tm-cred">
                <div><small>Sign in at</small><b>{window.location.origin}/admin</b></div>
                <div><small>Email or mobile</small><b>{add.email} · {add.phone}</b></div>
                <div><small>Password</small><b className="mono">{add.password}</b></div>
              </div>
              <button type="button" className="a-btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => { try { navigator.clipboard.writeText(`AR Trade admin console\n${window.location.origin}/admin\nLogin: ${add.email} or ${add.phone}\nPassword: ${add.password}`); } catch { /* clipboard unavailable */ } setCopied(true); }}>{copied ? 'Copied ✓' : '⧉ Copy login details'}</button>
              <span style={{ fontSize: 12.5, color: '#6b7388', lineHeight: 1.5 }}>Give these details to {add.name} privately. The password is not shown again, and they can change it from their own account.</span>
            </div>
          ) : (
            <div className="tm-form">
              <h4 className="cx-h">Account</h4>
              <label className="a-lbl">Full name<input className="a-input" required value={add.name} onChange={e => setAdd(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Nusrat Jahan" /></label>
              <label className="a-lbl">NID number<input className="a-input" inputMode="numeric" maxLength={17} value={add.nid} onChange={e => setAdd(x => ({ ...x, nid: e.target.value.replace(/D/g, '') }))} placeholder="10, 13 or 17 digits" /></label>
              <label className="a-lbl">Work email<input className="a-input" type="email" required value={add.email} onChange={e => setAdd(x => ({ ...x, email: e.target.value }))} placeholder="name@company.com" /></label>
              <label className="a-lbl">Mobile number<input className="a-input" type="tel" required maxLength={11} value={add.phone} onChange={e => setAdd(x => ({ ...x, phone: e.target.value.replace(/D/g, '') }))} placeholder="01XXXXXXXXX" /></label>
              {!add.id && (
                <>
                  <label className="a-lbl">Role<select className="a-input" required value={add.role} onChange={e => setAdd(x => ({ ...x, role: e.target.value }))}>{roles.filter(r => r.assignable).map(r => <option key={r.name} value={r.name}>{r.name}{r.legacy ? ' (existing role)' : ''}</option>)}</select>
                    <small className="tm-hint">There is only one Master Admin. Use "Make Master" on the list to hand it over.</small>
                  </label>
                  <div className="a-lbl">Password
                    <div className="pw">
                      <i>🔑</i>
                      <input type={add.show ? 'text' : 'password'} required minLength={8} value={add.password} onChange={e => setAdd(x => ({ ...x, password: e.target.value }))} autoComplete="new-password" aria-label="Password" />
                      <button type="button" className="pw-eye" onClick={() => setAdd(x => ({ ...x, show: !x.show }))} aria-label={add.show ? 'Hide the password' : 'Show the password'}>{add.show ? '🙈' : '👁'}</button>
                      <button type="button" className="pw-gen" onClick={() => setAdd(x => ({ ...x, password: genPassword(), show: true }))}>⟳ Generate</button>
                    </div>
                    <div className="pw-meter" data-s={pwScore(add.password)}><i /><i /><i /><i /><b>{PW_LABEL[pwScore(add.password)]}</b></div>
                  </div>
                </>
              )}
              <h4 className="cx-h">Addresses</h4>
              <label className="a-lbl">Present address<textarea className="a-input" rows={3} value={add.presentAddress} onChange={e => setAdd(x => ({ ...x, presentAddress: e.target.value }))} placeholder="House, road, area, city" /></label>
              <label className="a-lbl">Contact address
                <textarea className="a-input" rows={3} disabled={add.same} value={add.same ? add.presentAddress : add.contactAddress} onChange={e => setAdd(x => ({ ...x, contactAddress: e.target.value }))} placeholder="Permanent or village address, where we can write to the person" />
                <span className="tm-same"><input type="checkbox" checked={add.same} onChange={e => setAdd(x => ({ ...x, same: e.target.checked }))} />Same as the present address</span>
              </label>
              <h4 className="cx-h">Reference contact</h4>
              <label className="a-lbl">Reference contact person<input className="a-input" value={add.refName} onChange={e => setAdd(x => ({ ...x, refName: e.target.value }))} placeholder="Name of someone who can vouch for this person" /></label>
              <label className="a-lbl">Reference person's cell<input className="a-input" type="tel" maxLength={11} value={add.refPhone} onChange={e => setAdd(x => ({ ...x, refPhone: e.target.value.replace(/D/g, '') }))} placeholder="01XXXXXXXXX" /></label>
              {add.err && <div className="a-msg err full">{add.err}</div>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}


/** What the website will show for the top ticker, the home banner and the offer banner; updates as the admin types. */
/** Big sample of one piece of storefront text, shown from the Preview button next to a field. */
function PvSample({ kind, s }) {
  if (kind === 'ticker') {
    return (
      <>
        <p className="pv-note">The ticker runs along the very top of every page{!s.showPromo ? ' (it is switched off at the moment, so visitors do not see it)' : ''}.</p>
        <div className="pv-frame">
          <div className={'pv-ticker big' + (s.showPromo ? '' : ' off')}><div><span>{s.promo}</span><i>◆</i><span>{s.promo}</span><i>◆</i><span>{s.promo}</span><i>◆</i></div></div>
          <div className="pv-fake"><i style={{ width: 120 }} /><i style={{ width: '38%' }} /><i style={{ width: 70 }} /></div>
        </div>
      </>
    );
  }
  if (kind === 'hero') return <div className="pv-hero big"><b>{s.heroTitle || 'Headline'}</b><span>{s.heroSub}</span><div className="pv-btns"><i>Shop now →</i><i>Our services</i></div></div>;
  return <div className="pv-offer big"><b>{s.offerTitle || 'Headline'}</b><span>{s.offerSub}</span><div className="pv-btns"><i>Create an account →</i></div></div>;
}

/** Active | Inactive choice for one block of the website. */
function ActiveToggle({ on, onChange, label }) {
  return (
    <div className="act" role="group" aria-label={label}>
      <span className="act-l">{label}</span>
      <div className="vt">
        <button type="button" className={on ? 'on ok' : ''} aria-pressed={on} onClick={() => onChange(true)}>● Active</button>
        <button type="button" className={!on ? 'on off' : ''} aria-pressed={!on} onClick={() => onChange(false)}>○ Inactive</button>
      </div>
    </div>
  );
}

function PromoViewer({ s }) {
  return (
    <div className="a-card pv">
      <div className="card-hd"><h3>Promo viewer</h3><span className="chip">live preview · updates as you type</span></div>
      <div className="pv-label">Top promo ticker{!s.showPromo && <em>hidden: the ticker is switched off</em>}</div>
      <div className={'pv-ticker' + (s.showPromo ? '' : ' off')}><div><span>{s.promo}</span><i>◆</i><span>{s.promo}</span><i>◆</i><span>{s.promo}</span><i>◆</i></div></div>
      <div className="pv-pair">
        <div><div className="pv-label">Home banner</div><div className="pv-hero"><b>{s.heroTitle || 'Headline'}</b><span>{s.heroSub}</span></div></div>
        <div><div className="pv-label">Offer banner</div><div className="pv-offer"><b>{s.offerTitle || 'Headline'}</b><span>{s.offerSub}</span></div></div>
      </div>
    </div>
  );
}

const SettingsCtx = createContext(null);
/** Text field bound to one setting. Defined at module level on purpose: a component created inside Settings would be re-created on every keystroke. */
function F({ k, label, type = 'text', style, prefix, suffix }) {
  const { s, set } = useContext(SettingsCtx);
  const input = <input className="a-input" type={type} value={s[k] ?? ''} onChange={set(k)} style={style} />;
  return <label className="a-lbl">{label}{prefix || suffix ? <span className="adorn">{prefix && <i>{prefix}</i>}{input}{suffix && <i>{suffix}</i>}</span> : input}</label>;
}

/** Coloured icon + title + one-line explanation at the top of a settings section. */
function SecHead({ icon, title, sub, children }) {
  return (
    <div className="st-hd">
      <span className="st-ic">{icon}</span>
      <div><b>{title}</b><small>{sub}</small></div>
      <span style={{ flex: 1 }} />
      {children}
    </div>
  );
}
const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function Settings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pv, setPv] = useState(null); // which sample the Preview button is showing
  useEffect(() => { adm.get('/settings').then(setS).catch(e => setErr(e.message)); }, []);
  if (!s) return err ? <div className="a-msg err">{err}</div> : <span className="spin" />;
  const set = k => e => setS(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setPay = (k, v) => setS(x => ({ ...x, payments: { ...x.payments, [k]: v } }));
  const setSvc = (i, k, v) => setS(x => ({ ...x, svcPrices: x.svcPrices.map((p, j) => (j === i ? { ...p, [k]: +v } : p)) }));
  const save = async e => {
    e.preventDefault(); setErr(''); setMsg('');
    try { setS(await adm.put('/settings', s)); setMsg('Saved — the storefront updates immediately.'); } catch (er) { setErr(er.message); }
  };
  const pvBtn = kind => <button type="button" className="pv-btn" onClick={() => setPv(kind)} title="Show a sample of how this looks on the website">👁 Preview</button>;
  return (
    <SettingsCtx.Provider value={{ s, set }}>
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="dash-hero">
        <div><small>Store settings</small><h2>Everything customers see and pay</h2><p>Website text and banners, home page, popups, delivery fees, coupon, payment methods and contact details. Save once at the bottom.</p></div>
        <div className="qa">{[['st-store', 'Storefront'], ['st-home', 'Home rows'], ['st-popups', 'Popups'], ['st-checkout', 'Checkout & payments'], ['st-contact', 'Contact'], ['st-svc', 'Servicing prices']].map(([id, l]) => <button key={id} type="button" onClick={() => jump(id)}>{l} <i>↓</i></button>)}</div>
      </section>
      <PromoViewer s={s} />
      <div className="a-card st-sec" id="st-store" style={{ '--h': 250 }}>
        <SecHead icon="🖥️" title="Storefront content" sub="The ticker, home hero and offer banner every visitor sees" />
        <section className="obj">
          <div className="obj-hd"><b>Promo ticker</b><ActiveToggle label="" on={!!s.showPromo} onChange={v => setS(x => ({ ...x, showPromo: v }))} /><span className="sp" />{pvBtn('ticker')}</div>
          <F k="promo" label="Ticker text" />
        </section>
        <section className="obj">
          <div className="obj-hd"><b>Home hero</b><span className="sp" />{pvBtn('hero')}</div>
          <div className="a-fields"><F k="heroTitle" label="Headline" /><label className="a-lbl">Subtext<textarea className="a-input" rows={2} value={s.heroSub || ''} onChange={set('heroSub')} /></label></div>
        </section>
        <section className="obj">
          <div className="obj-hd"><b>Offer banner</b><ActiveToggle label="" on={s.showOffer !== false} onChange={v => setS(x => ({ ...x, showOffer: v }))} /><span className="sp" />{pvBtn('offer')}</div>
          <div className="a-fields"><F k="offerTitle" label="Headline" /><F k="offerSub" label="Subtext" /></div>
        </section>
      </div>
      <div className="a-card st-sec" id="st-home" style={{ '--h': 160 }}>
        <SecHead icon="🛍️" title="Home page · category product rows" sub="Best products of each category, scrolling round and round"><ActiveToggle label="" on={s.homeRails !== false} onChange={v => setS(x => ({ ...x, homeRails: v }))} /></SecHead>
        <div className="a-fields"><label className="a-lbl">Products per category row (1–20)<input className="a-input" type="number" min="1" max="20" value={s.homeRailLimit ?? 20} onChange={set('homeRailLimit')} /></label></div>
        <span style={{ fontSize: 12, color: '#6b7080' }}>Each category shows its best products (with photo, price, popular or discounted first) up to this limit, scrolling round and round.</span>
      </div>
      <div className="a-card st-sec" id="st-popups" style={{ '--h': 330 }}>
        <SecHead icon="🔔" title="Popups" sub="The sale popup and the newsletter popup; only one opens at a time" />
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
        <ActiveToggle label="Newsletter popup also when the visitor is about to leave" on={s.nlExit !== false} onChange={v => setS(x => ({ ...x, nlExit: v }))} />
        <span style={{ fontSize: 12, color: '#6b7080' }}>Each popup shows at most once per visit. A popup never opens while another is open.</span>
      </div>
      <div className="a-card st-sec" id="st-checkout" style={{ '--h': 85 }}>
        <SecHead icon="🚚" title="Checkout & delivery" sub="Delivery fees, free-delivery limit, coupon code and payment methods" />
        <div className="a-fields">
          <F k="insideFee" type="number" prefix="৳" label="Delivery fee: inside Dhaka" /><F k="suburbFee" type="number" prefix="৳" label="Delivery fee: suburbs" /><F k="outsideFee" type="number" prefix="৳" label="Delivery fee: outside Dhaka" /><F k="freeOver" type="number" prefix="৳" label="Free delivery over" />
          <F k="coupon" prefix="🏷️" label="Coupon code" style={{ textTransform: 'uppercase' }} /><F k="couponPct" type="number" suffix="%" label="Coupon discount" />
        </div>
        <div className="card-hd"><span style={{ fontSize: 13, fontWeight: 800 }}>Payment methods</span><span className="muted" style={{ fontSize: 12 }}>Tick the ones customers can choose at checkout</span></div>
        <div className="pm-grid">
          {PAY.map(([k, name, note, [txt, size, bg, img]]) => {
            const on = s.payments?.[k] !== false;
            return (
              <label key={k} className={'pm' + (on ? ' on' : '')}>
                <input type="checkbox" checked={on} onChange={e => setPay(k, e.target.checked)} />
                <span className="pm-logo" style={img ? undefined : { background: bg, color: '#fff', fontSize: size }}>{img ? <img src={img} alt="" /> : txt}</span>
                <span className="pm-t"><b>{name}</b><small>{note}</small></span>
                <span className="pm-st">{on ? 'Active' : 'Inactive'}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="a-card st-sec" id="st-contact" style={{ '--h': 200 }}>
        <SecHead icon="📞" title="Store contact" sub="Shown in the header, footer, contact page and on invoices" />
        <div className="a-fields"><F k="phone" prefix="☎" label="Phone" /><F k="whatsapp" prefix="💬" label="WhatsApp number" /><F k="email" prefix="✉" label="Email" /><F k="address" prefix="📍" label="Address" /></div>
      </div>
      <div className="a-card st-sec" id="st-svc" style={{ '--h': 15, gap: 8 }}>
        <SecHead icon="🛠️" title="Servicing price list" sub="Regular price and the current offer price for each service" />
        <div className="svc-row svc-head"><span>Service</span><span>Regular</span><span>Offer</span></div>
        {s.svcPrices.map((p, i) => (
          <div key={p.t} className="svc-row">
            <span className="svc-n"><i>{i + 1}</i>{p.t}</span>
            <span className="adorn"><i>৳</i><input className="a-input" type="number" title="Regular" value={p.reg} onChange={e => setSvc(i, 'reg', e.target.value)} /></span>
            <span className="adorn"><i>৳</i><input className="a-input" type="number" title="Offer" value={p.offer} onChange={e => setSvc(i, 'offer', e.target.value)} /></span>
          </div>
        ))}
      </div>
      <div className="a-save"><span>{err ? <b style={{ color: '#ffb4ab' }}>{err}</b> : msg || 'Changes apply to the storefront as soon as you save.'}</span><button className="a-btn" style={{ background: 'oklch(0.82 0.13 85)', color: '#16181d', fontWeight: 800 }}>Save all settings</button></div>
    </form>
    {pv && <Modal kicker="Preview" title="How it looks on the website" onClose={() => setPv(null)} footer={<button type="button" className="a-btn" onClick={() => setPv(null)}>Close</button>}><PvSample kind={pv} s={s} /></Modal>}
    </SettingsCtx.Provider>
  );
}
