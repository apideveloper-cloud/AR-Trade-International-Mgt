import { createContext, useContext, useState } from 'react';
import { adm } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import { PAY } from '../../../data.js';
import { useApiData } from '../../hooks/useApiData.js';
import { useBusy } from '../../hooks/useBusy.js';

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

/** What the website will show for the top ticker, the home banner and the offer banner; updates as the admin types. */
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
  const q = useApiData(() => adm.get('/settings'));
  const s = q.data, setS = q.setData;
  const [msg, setMsg] = useState('');
  const [saveErr, setErr] = useState('');
  const [saving, runSave] = useBusy();
  const [pv, setPv] = useState(null); // which sample the Preview button is showing
  const err = saveErr || q.error;
  if (!s) return err ? <div className="a-msg err">{err}</div> : <span className="spin" />;
  const set = k => e => setS(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setPay = (k, v) => setS(x => ({ ...x, payments: { ...x.payments, [k]: v } }));
  const setSvc = (i, k, v) => setS(x => ({ ...x, svcPrices: x.svcPrices.map((p, j) => (j === i ? { ...p, [k]: +v } : p)) }));
  const save = async e => {
    e.preventDefault(); setErr(''); setMsg('');
    await runSave(async () => {
      try { setS(await adm.put('/settings', s)); setMsg('Saved — the storefront updates immediately.'); } catch (er) { setErr(er.message); }
    });
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
        <div className="svc-two">
          <div className="svc-row svc-head"><span>Service</span><span>Regular</span><span>Offer</span></div>
          <div className="svc-row svc-head svc-h2"><span>Service</span><span>Regular</span><span>Offer</span></div>
        {s.svcPrices.map((p, i) => (
          <div key={p.t} className="svc-row">
            <span className="svc-n"><i>{i + 1}</i>{p.t}</span>
            <span className="adorn"><i>৳</i><input className="a-input" type="number" title="Regular" value={p.reg} onChange={e => setSvc(i, 'reg', e.target.value)} /></span>
            <span className="adorn"><i>৳</i><input className="a-input" type="number" title="Offer" value={p.offer} onChange={e => setSvc(i, 'offer', e.target.value)} /></span>
          </div>
        ))}
        </div>
      </div>
      <div className="a-save"><span>{err ? <b style={{ color: '#ffb4ab' }}>{err}</b> : msg || 'Changes apply to the storefront as soon as you save.'}</span><button className="a-btn" disabled={saving} style={{ background: 'oklch(0.82 0.13 85)', color: '#16181d', fontWeight: 800 }}>Save all settings</button></div>
    </form>
    {pv && <Modal kicker="Preview" title="How it looks on the website" narrow cls="pv-modal" onClose={() => setPv(null)} footer={<button type="button" className="a-btn" onClick={() => setPv(null)}>Close</button>}><PvSample kind={pv} s={s} /></Modal>}
    </SettingsCtx.Provider>
  );
}
