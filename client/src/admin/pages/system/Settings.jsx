import { createContext, lazy, Suspense, useContext, useState } from 'react';
import { adm } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import { PAY } from '../../../data.js';
import { useApiData } from '../../hooks/useApiData.js';
import { useBusy } from '../../hooks/useBusy.js';
import '../../styles/admin-delivery-rules.css';

const OfficeMap = lazy(() => import('./OfficeMap.jsx')); // Leaflet loads only when this screen is opened

const DEFAULT_DELIVERY = {
  office: { lat: 23.739316, lng: 90.415567, label: '159 Santinagar, Dhaka-1217' },
  freeKm: 2,
  roadFactor: 1.25,
  tiers: [{ upToKm: 5, fee: 100 }, { upToKm: 8, fee: 150 }, { upToKm: 12, fee: 200 }, { upToKm: 18, fee: 250 }],
  maxFee: 350,
  partners: [['redx', 'RedX'], ['sa-paribahan', 'SA Paribahan'], ['steadfast', 'Steadfast Courier'], ['sundarban', 'Sundarban Courier']].map(([id, name]) => ({ id, name })),
};
/** Delivery object with every missing piece filled from the defaults (values may still be strings while the admin types). */
const getDelivery = d => {
  const x = d && typeof d === 'object' ? d : {};
  return {
    office: { ...DEFAULT_DELIVERY.office, ...(x.office || {}) },
    freeKm: x.freeKm ?? DEFAULT_DELIVERY.freeKm,
    roadFactor: x.roadFactor ?? DEFAULT_DELIVERY.roadFactor,
    tiers: Array.isArray(x.tiers) ? x.tiers : DEFAULT_DELIVERY.tiers,
    maxFee: x.maxFee ?? DEFAULT_DELIVERY.maxFee,
    partners: Array.isArray(x.partners) ? x.partners : DEFAULT_DELIVERY.partners,
  };
};
const isNum = v => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
const slug = n => String(n || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
/** Partners with ids: existing ids stay, new entries get a slug of the name. */
const withIds = ps => ps.map(p => ({ id: p.id || slug(p.name), name: String(p.name || '').trim() }));

function validateDelivery(raw) {
  const d = getDelivery(raw), e = [];
  const lat = d.office.lat, lng = d.office.lng;
  if (!isNum(lat) || +lat < -90 || +lat > 90) e.push('Latitude must be a number between -90 and 90.');
  if (!isNum(lng) || +lng < -180 || +lng > 180) e.push('Longitude must be a number between -180 and 180.');
  if (String(d.office.label || '').length > 120) e.push('Office label is too long (max 120 characters).');
  if (!isNum(d.freeKm) || +d.freeKm < 0) e.push('Free distance must be 0 or more.');
  if (!isNum(d.roadFactor) || +d.roadFactor < 1 || +d.roadFactor > 3) e.push('Road factor must be a number between 1 and 3.');
  d.tiers.forEach((t, i) => {
    const n = i + 1;
    if (!isNum(t.upToKm) || +t.upToKm <= 0) e.push(`Step ${n}: enter the distance in km (more than 0).`);
    else if (i > 0 && isNum(d.tiers[i - 1].upToKm) && +t.upToKm <= +d.tiers[i - 1].upToKm) e.push(`Step ${n}: km must be more than the step above.`);
    else if (+t.upToKm <= +d.freeKm && isNum(d.freeKm)) e.push(`Step ${n}: km must be more than the free distance.`);
    if (!isNum(t.fee) || +t.fee < 0) e.push(`Step ${n}: enter the fee (0 or more).`);
    else if (i > 0 && isNum(d.tiers[i - 1].fee) && +t.fee < +d.tiers[i - 1].fee) e.push(`Step ${n}: fee cannot be lower than the step above.`);
  });
  if (!isNum(d.maxFee) || +d.maxFee < 0) e.push('Fee beyond the last step must be 0 or more.');
  else if (d.tiers.length && isNum(d.tiers[d.tiers.length - 1].fee) && +d.maxFee < +d.tiers[d.tiers.length - 1].fee) e.push('Fee beyond the last step cannot be lower than the last step.');
  if (!d.partners.length) e.push('Keep at least one shipping partner, otherwise orders outside Dhaka cannot be placed.');
  const seen = new Set();
  d.partners.forEach((p, i) => {
    const name = String(p.name || '').trim();
    if (!name) { e.push(`Partner ${i + 1}: name is empty.`); return; }
    if (name.length > 60) e.push(`Partner ${i + 1}: name is too long (max 60).`);
    const id = p.id || slug(name);
    if (!id) { e.push(`Partner "${name}": use English letters or numbers in the name.`); return; }
    if (seen.has(id)) e.push(`Partner "${name}" is listed twice.`);
    seen.add(id);
  });
  return e;
}

/** Numbers as numbers, partners with ids; call only after validateDelivery passes. */
function deliveryPayload(raw) {
  const d = getDelivery(raw);
  return {
    office: { lat: +d.office.lat, lng: +d.office.lng, label: String(d.office.label || '').trim() },
    freeKm: +d.freeKm,
    roadFactor: +d.roadFactor,
    tiers: d.tiers.map(t => ({ upToKm: +t.upToKm, fee: +t.fee })),
    maxFee: +d.maxFee,
    partners: withIds(d.partners),
  };
}

function DeliveryRules({ s, setS, errors }) {
  const d = getDelivery(s.delivery);
  const upd = fn => setS(x => ({ ...x, delivery: fn(getDelivery(x.delivery)) }));
  const setTop = (k, v) => upd(c => ({ ...c, [k]: v }));
  const setOffice = (k, v) => upd(c => ({ ...c, office: { ...c.office, [k]: v } }));
  const setTier = (i, k, v) => upd(c => ({ ...c, tiers: c.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const setPartner = (i, name) => upd(c => ({ ...c, partners: c.partners.map((p, j) => (j === i ? { ...p, name } : p)) }));
  const num = (label, value, onChange, extra = {}) => (
    <label className="a-lbl">{label}<input className="a-input" type="number" step="any" inputMode="decimal" value={value ?? ''} onChange={e => onChange(e.target.value)} {...extra} /></label>
  );
  const f = n => (isNum(n) ? +n : '?');
  const parts = [`Free up to ${f(d.freeKm)} km`];
  let from = d.freeKm;
  d.tiers.forEach(t => { parts.push(`${f(from)}-${f(t.upToKm)} km ৳${f(t.fee)}`); from = t.upToKm; });
  parts.push(`over ${f(from)} km ৳${f(d.maxFee)}`);
  const mapOk = isNum(d.office.lat) && isNum(d.office.lng);
  const mapUrl = `https://www.openstreetmap.org/?mlat=${+d.office.lat}&mlon=${+d.office.lng}#map=16/${+d.office.lat}/${+d.office.lng}`;
  return (
    <>
      <div className="dr-box">
        <b>Delivery by distance (inside Dhaka)</b>
        <p className="dr-hint">Distances are measured from here. Open the map and confirm the pin is on your office door.</p>
        <div className="a-fields">
          <label className="a-lbl">Office location label<input className="a-input" type="text" maxLength={120} value={d.office.label ?? ''} onChange={e => setOffice('label', e.target.value)} /></label>
          {num('Latitude', d.office.lat, v => setOffice('lat', v))}
          {num('Longitude', d.office.lng, v => setOffice('lng', v))}
        </div>
        {mapOk && <a className="dr-map" href={mapUrl} target="_blank" rel="noopener noreferrer">Check on map</a>}
        <Suspense fallback={<div className="dr-hint">Loading map…</div>}>
          <OfficeMap lat={d.office.lat} lng={d.office.lng} onPick={p => { setOffice('lat', p.lat); setOffice('lng', p.lng); }} />
        </Suspense>
        <div className="a-fields">
          {num('Free distance (km)', d.freeKm, v => setTop('freeKm', v), { min: 0 })}
          {num('Road factor', d.roadFactor, v => setTop('roadFactor', v), { min: 1, max: 3 })}
        </div>
        <p className="dr-hint">Straight-line distance x this number approximates the road distance</p>
        <div className="dr-steps" role="group" aria-label="Distance steps">
          {d.tiers.map((t, i) => (
            <div className="dr-row" key={i}>
              {num(`Step ${i + 1}: up to (km)`, t.upToKm, v => setTier(i, 'upToKm', v), { min: 0 })}
              <span aria-hidden="true">→</span>
              <label className="a-lbl">Fee<span className="adorn"><i>৳</i><input className="a-input" type="number" step="any" inputMode="decimal" min="0" value={t.fee ?? ''} onChange={e => setTier(i, 'fee', e.target.value)} /></span></label>
              <button type="button" className="a-btn" aria-label={`Remove step ${i + 1}`} onClick={() => upd(c => ({ ...c, tiers: c.tiers.filter((_, j) => j !== i) }))}>Remove</button>
            </div>
          ))}
          <div>
            <button type="button" className="a-btn" disabled={d.tiers.length >= 8} onClick={() => upd(c => {
              const last = c.tiers[c.tiers.length - 1];
              const km = last && isNum(last.upToKm) ? +last.upToKm + 3 : (isNum(c.freeKm) ? +c.freeKm + 2 : 2);
              return { ...c, tiers: [...c.tiers, { upToKm: km, fee: last && isNum(last.fee) ? +last.fee + 50 : 100 }] };
            })}>+ Add step</button>
            {d.tiers.length >= 8 && <span className="dr-hint"> Maximum 8 steps.</span>}
          </div>
        </div>
        <div className="dr-last">
          <label className="a-lbl">Beyond the last step<span className="adorn"><i>৳</i><input className="a-input" type="number" step="any" inputMode="decimal" min="0" value={d.maxFee ?? ''} onChange={e => setTop('maxFee', e.target.value)} /></span></label>
        </div>
        <div className="dr-prev" aria-live="polite"><b>Preview: </b>{parts.join(' · ')}</div>
      </div>
      <div className="dr-box">
        <b>Shipping partners (outside Dhaka)</b>
        <div className="dr-steps">
          {d.partners.map((p, i) => (
            <div className="dr-row" key={i}>
              <label className="a-lbl">Partner {i + 1}<input className="a-input" type="text" maxLength={60} value={p.name ?? ''} onChange={e => setPartner(i, e.target.value)} /></label>
              <button type="button" className="a-btn" aria-label={`Remove partner ${i + 1}`} onClick={() => upd(c => ({ ...c, partners: c.partners.filter((_, j) => j !== i) }))}>Remove</button>
            </div>
          ))}
          <div>
            <button type="button" className="a-btn" disabled={d.partners.length >= 12} onClick={() => upd(c => ({ ...c, partners: [...c.partners, { name: '' }] }))}>+ Add partner</button>
            {d.partners.length >= 12 && <span className="dr-hint"> Maximum 12 partners.</span>}
          </div>
        </div>
      </div>
      {errors.length > 0 && <div role="alert">{errors.map(m => <p className="dr-err" key={m}>{m}</p>)}</div>}
    </>
  );
}

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
  const delErrs = s ? validateDelivery(s.delivery) : [];
  if (!s) return err ? <div className="a-msg err">{err}</div> : <span className="spin" />;
  const set = k => e => setS(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setPay = (k, v) => setS(x => ({ ...x, payments: { ...x.payments, [k]: v } }));
  const setSvc = (i, k, v) => setS(x => ({ ...x, svcPrices: x.svcPrices.map((p, j) => (j === i ? { ...p, [k]: +v } : p)) }));
  const save = async e => {
    e.preventDefault(); setErr(''); setMsg('');
    if (delErrs.length) { setErr('Fix the delivery settings first: ' + delErrs[0]); document.getElementById('st-checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    await runSave(async () => {
      try { setS(await adm.put('/settings', { ...s, delivery: deliveryPayload(s.delivery) })); setMsg('Saved — the storefront updates immediately.'); } catch (er) { setErr(er.message); }
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
          <F k="outsideFee" type="number" prefix="৳" label="Delivery fee: outside Dhaka" /><F k="expressFee" type="number" prefix="৳" label="Express delivery fee" /><F k="freeOver" type="number" prefix="৳" label="Free delivery over (Dhaka orders, 0 = off)" />
          <F k="coupon" prefix="🏷️" label="Coupon code" style={{ textTransform: 'uppercase' }} /><F k="couponPct" type="number" suffix="%" label="Coupon discount" />
        </div>
        <DeliveryRules s={s} setS={setS} errors={delErrs} />
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
