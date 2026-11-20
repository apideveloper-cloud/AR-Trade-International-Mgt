import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';
import { Modal } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { useBusy } from '../../hooks/useBusy.js';
import { deliveryPayload, validateDelivery } from './settings/deliveryModel.js';
import { DeliveryRules } from './settings/DeliveryRules.jsx';
import { PaymentMethods } from './settings/PaymentMethods.jsx';
import { PromoViewer, PvSample } from './settings/PromoPreview.jsx';
import { ServicePrices } from './settings/ServicePrices.jsx';
import { ActiveToggle, F, SecHead, SettingsCtx, jump } from './settings/parts.jsx';

const NAV = [['st-store', 'Storefront'], ['st-home', 'Home rows'], ['st-popups', 'Popups'], ['st-checkout', 'Checkout & payments'], ['st-contact', 'Contact'], ['st-svc', 'Servicing prices']];
const HINT = { fontSize: 12, color: '#6b7080' };

/** Store settings page: storefront text, popups, checkout and delivery, payments, contact and servicing prices; one Save for all. */
export function Settings() {
  const tr = useT();
  const q = useApiData(() => adm.get('/settings'));
  const s = q.data, setS = q.setData;
  const [msg, setMsg] = useState('');
  const [saveErr, setErr] = useState('');
  const [saving, runSave] = useBusy();
  const [pv, setPv] = useState(null); // which sample the Preview button is showing
  const err = saveErr || (q.error ? tr(q.error) : '');
  const delErrs = s ? validateDelivery(s.delivery, tr) : [];
  if (!s) return err ? <div className="a-msg err">{err}</div> : <span className="spin" />;
  const set = k => e => setS(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setFlag = k => v => setS(x => ({ ...x, [k]: v }));
  const setPay = (k, v) => setS(x => ({ ...x, payments: { ...x.payments, [k]: v } }));
  const setSvc = (i, k, v) => setS(x => ({ ...x, svcPrices: x.svcPrices.map((p, j) => (j === i ? { ...p, [k]: +v } : p)) }));
  const save = async e => {
    e.preventDefault(); setErr(''); setMsg('');
    if (delErrs.length) { setErr(tr('Fix the delivery settings first: {m}', { m: delErrs[0] })); jump('st-checkout'); return; }
    await runSave(async () => {
      try { setS(await adm.put('/settings', { ...s, delivery: deliveryPayload(s.delivery) })); setMsg('Saved — the storefront updates immediately.'); } catch (er) { setErr(tr(er.message)); }
    });
  };
  const pvBtn = kind => <button type="button" className="pv-btn" onClick={() => setPv(kind)} title={tr('Show a sample of how this looks on the website')}>👁 {tr('Preview')}</button>;
  return (
    <SettingsCtx.Provider value={{ s, set }}>
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="dash-hero">
        <div><small>{tr('Store settings')}</small><h2>{tr('Everything customers see and pay')}</h2><p>{tr('Website text and banners, home page, popups, delivery fees, coupon, payment methods and contact details. Save once at the bottom.')}</p></div>
        <div className="qa">{NAV.map(([id, l]) => <button key={id} type="button" onClick={() => jump(id)}>{tr(l)} <i>↓</i></button>)}</div>
      </section>
      <PromoViewer s={s} />
      <div className="a-card st-sec" id="st-store" style={{ '--h': 250 }}>
        <SecHead icon="🖥️" title={tr('Storefront content')} sub={tr('The ticker, home hero and offer banner every visitor sees')} />
        <section className="obj">
          <div className="obj-hd"><b>{tr('Promo ticker')}</b><ActiveToggle label="" on={!!s.showPromo} onChange={setFlag('showPromo')} /><span className="sp" />{pvBtn('ticker')}</div>
          <F k="promo" label={tr('Ticker text')} />
        </section>
        <section className="obj">
          <div className="obj-hd"><b>{tr('Home hero')}</b><span className="sp" />{pvBtn('hero')}</div>
          <div className="a-fields"><F k="heroTitle" label={tr('Headline')} /><label className="a-lbl">{tr('Subtext')}<textarea className="a-input" rows={2} value={s.heroSub || ''} onChange={set('heroSub')} /></label></div>
        </section>
        <section className="obj">
          <div className="obj-hd"><b>{tr('Offer banner')}</b><ActiveToggle label="" on={s.showOffer !== false} onChange={setFlag('showOffer')} /><span className="sp" />{pvBtn('offer')}</div>
          <div className="a-fields"><F k="offerTitle" label={tr('Headline')} /><F k="offerSub" label={tr('Subtext')} /></div>
        </section>
      </div>
      <div className="a-card st-sec" id="st-home" style={{ '--h': 160 }}>
        <SecHead icon="🛍️" title={tr('Home page · category product rows')} sub={tr('Best products of each category, scrolling round and round')}><ActiveToggle label="" on={s.homeRails !== false} onChange={setFlag('homeRails')} /></SecHead>
        <div className="a-fields"><label className="a-lbl">{tr('Products per category row (1–20)')}<input className="a-input" type="number" min="1" max="20" value={s.homeRailLimit ?? 20} onChange={set('homeRailLimit')} /></label></div>
        <span style={HINT}>{tr('Each category shows its best products (with photo, price, popular or discounted first) up to this limit, scrolling round and round.')}</span>
      </div>
      <div className="a-card st-sec" id="st-popups" style={{ '--h': 330 }}>
        <SecHead icon="🔔" title={tr('Popups')} sub={tr('The sale popup and the newsletter popup; only one opens at a time')} />
        <div className="a-fields">
          <label className="a-lbl">{tr('Which popups show')}<select className="a-input" value={s.popupMode || 'one'} onChange={set('popupMode')}>
            <option value="one">{tr('Only one popup per visit (recommended)')}</option>
            <option value="sequential">{tr('Both, one after the other (never together)')}</option>
            <option value="promo">{tr('Mega toner sale popup only')}</option>
            <option value="newsletter">{tr('Newsletter popup only')}</option>
            <option value="off">{tr('No popups')}</option>
          </select></label>
          <label className="a-lbl">{tr('Sale popup appears after (seconds)')}<input className="a-input" type="number" min="0" max="120" value={s.promoDelay ?? 1} onChange={set('promoDelay')} /></label>
          <label className="a-lbl">{tr('Newsletter popup appears after (seconds)')}<input className="a-input" type="number" min="1" max="600" value={s.nlDelay ?? 30} onChange={set('nlDelay')} /></label>
        </div>
        <ActiveToggle label={tr('Newsletter popup also when the visitor is about to leave')} on={s.nlExit !== false} onChange={setFlag('nlExit')} />
        <span style={HINT}>{tr('Each popup shows at most once per visit. A popup never opens while another is open.')}</span>
      </div>
      <div className="a-card st-sec" id="st-checkout" style={{ '--h': 85 }}>
        <SecHead icon="🚚" title={tr('Checkout & delivery')} sub={tr('Delivery fees, free-delivery limit, coupon code and payment methods')} />
        <div className="a-fields">
          <F k="outsideFee" type="number" prefix="৳" label={tr('Delivery fee: outside Dhaka')} /><F k="expressFee" type="number" prefix="৳" label={tr('Express delivery fee')} /><F k="freeOver" type="number" prefix="৳" label={tr('Free delivery over (Dhaka orders, 0 = off)')} />
          <F k="coupon" prefix="🏷️" label={tr('Coupon code')} style={{ textTransform: 'uppercase' }} /><F k="couponPct" type="number" suffix="%" label={tr('Coupon discount')} />
        </div>
        <DeliveryRules s={s} setS={setS} errors={delErrs} />
        <PaymentMethods payments={s.payments} onToggle={setPay} />
      </div>
      <div className="a-card st-sec" id="st-contact" style={{ '--h': 200 }}>
        <SecHead icon="📞" title={tr('Store contact')} sub={tr('Shown in the header, footer, contact page and on invoices')} />
        <div className="a-fields"><F k="phone" prefix="☎" label={tr('Phone')} /><F k="whatsapp" prefix="💬" label={tr('WhatsApp number')} /><F k="email" prefix="✉" label={tr('Email')} /><F k="address" prefix="📍" label={tr('Address')} /></div>
      </div>
      <div className="a-card st-sec" id="st-svc" style={{ '--h': 15, gap: 8 }}>
        <SecHead icon="🛠️" title={tr('Servicing price list')} sub={tr('Regular price and the current offer price for each service')} />
        <ServicePrices prices={s.svcPrices} onChange={setSvc} />
      </div>
      <div className="a-save"><span>{err ? <b style={{ color: '#ffb4ab' }}>{err}</b> : msg ? tr(msg) : tr('Changes apply to the storefront as soon as you save.')}</span><button className="a-btn" disabled={saving} style={{ background: 'oklch(0.82 0.13 85)', color: '#16181d', fontWeight: 800 }}>{tr('Save all settings')}</button></div>
    </form>
    {pv && <Modal kicker={tr('Preview')} title={tr('How it looks on the website')} narrow cls="pv-modal" onClose={() => setPv(null)} footer={<button type="button" className="a-btn" onClick={() => setPv(null)}>{tr('Close')}</button>}><PvSample kind={pv} s={s} /></Modal>}
    </SettingsCtx.Provider>
  );
}
