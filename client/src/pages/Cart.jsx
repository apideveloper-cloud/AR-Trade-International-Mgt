import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { productPath } from '../slug.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmt } from '../api.js';
import CheckoutSteps from '../components/CheckoutSteps.jsx';
import Fireworks from '../components/Fireworks.jsx';
import DistrictCombo from '../components/DistrictCombo.jsx';
import { DHAKA_THANAS, DISTRICTS, deliveryOf, PAY, PAY_HERO, PAY_LABEL, partnerLogo } from '../data.js';
import { MOBILE_HINT, bdMobile, mobileProblem, showMobile } from '../phone.js';
import { printInvoice } from '../invoice.js';
import { useStore } from '../store.jsx';
import './cart.css';

const Row = ({ k, v, cls }) => <div className={cls ? 'r ' + cls : 'r'}><span>{k}</span><span>{v}</span></div>;
const DeliveryMap = lazy(() => import('../components/DeliveryMap.jsx'));
const ZONE = { inside: 'Inside Dhaka', suburb: 'Dhaka suburbs', outside: 'Outside Dhaka' };

function CouponBox({ value, onChange, ok }) {
  return (
    <>
      <input className="pill-in" value={value} onChange={e => onChange(e.target.value)} placeholder="Coupon code" />
      {ok && <span className="ct-coupon-ok">✓ Coupon applied</span>}
    </>
  );
}

/** List | Grid switch for the cart items. The choice is remembered on this device. */
function ViewSwitch({ view, onChange }) {
  const btn = (v, label, icon) => (
    <button type="button" className={view === v ? 'on' : ''} aria-pressed={view === v} aria-label={label + ' view'} title={label + ' view'} onClick={() => onChange(v)}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg><span className="vl">{label}</span>
    </button>
  );
  return (
    <div className="vsw" role="group" aria-label="Cart view">
      {btn('list', 'List', <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />)}
      {btn('grid', 'Grid', <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />)}
    </div>
  );
}

export function Cart() {
  const { cartLines, setQty, user, totals } = useStore();
  const [coupon, setCoupon] = useState('');
  const [view, setViewState] = useState(() => { try { return localStorage.getItem('ar_cart_view') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; } });
  const setView = v => { setViewState(v); try { localStorage.setItem('ar_cart_view', v); } catch { /* storage blocked: the choice just is not remembered */ } };
  const t = totals({ area: user?.area || 'inside', coupon });
  return (
    <section className="page ct-page">
      <div className="ct-head"><h1 className="h1 ct-h1">Your cart</h1>{cartLines.length > 0 && <ViewSwitch view={view} onChange={setView} />}</div>
      {!cartLines.length ? (
        <div className="empty"><span className="ct-empty-t">Your cart is empty</span><Link to="/shop/all" className="btn btn-dark btn-pill ct-btn-start">Start shopping</Link></div>
      ) : (
        <div className="cart-body">
          <div className={'cart-lines' + (view === 'grid' ? ' grid' : '')}>
            {t.lines.map(l => (
              <div className="cline" key={l.id}>
                <Link to={productPath(l)}><div className="im" style={{ backgroundImage: l.img ? `url('${l.img}')` : 'none' }} /></Link>
                <div className="ct-line-col">
                  <Link to={productPath(l)} className="ct-line-name">{l.name}</Link>
                  <span className="ct-line-each">{fmt(l.price)} each</span>
                  {l.short > 0 && <span className="ct-line-short">Only {l.avail} in stock — you can choose how to handle the rest at checkout</span>}
                  <div className="ct-line-actions">
                    <div className="qty2"><button onClick={() => setQty(l.id, l.qty - 1)}>−</button><span>{l.qty}</span><button onClick={() => setQty(l.id, l.qty + 1)}>+</button></div>
                    <button onClick={() => setQty(l.id, 0)} className="ct-line-remove">Remove</button>
                  </div>
                </div>
                <span className="ct-line-total">{fmt(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <aside className="summary">
            <span className="ct-sum-t">Order summary</span>
            <CouponBox value={coupon} onChange={setCoupon} ok={t.okCoupon} />
            <Row k={`Subtotal (${t.count} items)`} v={fmt(t.subtotal)} />
            <Row k="Discount" v={'− ' + fmt(t.discount + t.member)} />
            <Row k="Delivery (inside Dhaka)" v={t.delivery ? fmt(t.delivery) : 'Free'} />
            <Row k="You save vs. regular price" v={fmt(t.saved)} cls="ct-save" />
            <div className="tot"><b className="ct-tot-l">Total</b><b>{fmt(t.total)}</b></div>
            <Link to="/checkout" className="btn btn-blue ct-center">Proceed to checkout</Link>
            <Link to="/shop/all" className="ct-more">Continue shopping</Link>
          </aside>
        </div>
      )}
    </section>
  );
}

const sel = on => 'opt' + (on ? ' on' : '');

export function Checkout() {
  const { cartLines, user, site, totals, clearCart, setLoginOpen, optIn } = useStore();
  const nav = useNavigate();
  const [coupon, setCoupon] = useState('');
  const [express, setExpress] = useState(false);
  const [partial, setPartial] = useState('split');
  const [pay, setPay] = useState('COD');
  const [gw, setGw] = useState('SSLCommerz');
  const [vatInv, setVatInv] = useState(false);
  const [paying, setPaying] = useState(null);
  const [review, setReview] = useState(null); // the filled-in form, shown for a last look before the order is placed
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [district, setDistrict] = useState(DISTRICTS.includes(user?.district) ? user.district : '');
  const [errs, setErrs] = useState({}); // inline messages, one per wrong field (the browser's own pop-up is switched off with noValidate)

  const [dest, setDest] = useState(null); // { lat, lng, km, fee } from the map
  const [partner, setPartner] = useState('');
  const dl = deliveryOf(site);
  const area = district && district !== 'Dhaka' ? 'outside' : 'inside';
  const t = totals({ area, coupon, express, partial, deliveryBase: dest && Number.isFinite(dest.fee) ? dest.fee : undefined });
  const exOn = express && area === 'inside' && !!district;
  const codOn = site.payments?.COD !== false; // the shop takes cash on delivery
  const stdFee = dest ? (t.freeElig || !(t.base > 0) ? 'Free' : fmt(t.base)) : 'By distance'; // the standard delivery charge shown on its card
  const online = ['bKash', 'Nagad', 'Rocket', 'Card'].includes(pay);
  const shortL = t.lines.filter(l => l.short > 0);
  const form = useRef(null);

  useEffect(() => { // the review is a page: go to its top; when the form comes back the map is measured again
    window.scrollTo({ top: 0 });
    if (!review) { const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 80); return () => clearTimeout(t); }
  }, [review]);

  if (!cartLines.length) return <section className="page"><div className="empty">Your cart is empty. <Link to="/shop/all" className="ct-link-bold">Browse products</Link></div></section>;

  const finish = async (d, paid) => {
    setBusy(true); setErr('');
    const place = (d.district === 'Others' ? d.districtOther : d.district || '').trim();
    const has = x => x && d.address.toLowerCase().includes(String(x).toLowerCase()); // a saved address may already carry the thana and district
    const fullAddress = [d.address, has(d.thana) ? '' : d.thana, has(place) ? '' : place].filter(Boolean).join(', ') + (d.postcode ? ' - ' + d.postcode : '');
    try {
      const o = await api.post('/orders', {
        items: cartLines.map(l => ({ id: l.p.id, qty: l.qty })), customer: { name: d.name, phone: d.phone, email: d.email }, address: fullAddress, area,
        district: d.district, ...(d.district === 'Dhaka' ? { dest: { lat: dest.lat, lng: dest.lng } } : { partner }),
        payment: pay === 'Card' ? 'Card · ' + gw : PAY_LABEL[pay] || pay, gateway: pay === 'Card' ? gw : '', paid, note: d.note, coupon, express: exOn,
        partial, slot: exOn ? 'Express · within 3 hours' : '', vatInvoice: vatInv, company: d.company, bin: d.bin
      });
      try { sessionStorage.setItem('ar_last_order', JSON.stringify(o)); } catch { /* storage unavailable */ }
      if (d.mkt && d.email) optIn(d.email, 'Checkout · ' + o.id).catch(() => {});
      clearCart(); setPaying(null); nav('/success/' + o.id);
    } catch (e) { setErr(e.message); setPaying(null); setBusy(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const clr = k => setErrs(x => (x[k] ? { ...x, [k]: '' } : x));
  const fe = k => (errs[k] ? <small id={'err-' + k} className="fld-err" role="alert">{errs[k]}</small> : null);
  const bad = k => (errs[k] ? ' bad' : '');
  const submit = e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    const has = k => String(d[k] || '').trim();
    const mobile = bdMobile(d.phone), problems = {};
    if (!has('name')) problems.name = 'Please enter your full name';
    if (!has('phone')) problems.phone = 'Please enter your mobile number';
    else if (!mobile) problems.phone = MOBILE_HINT;
    if (has('email') && !/^\S+@\S+\.\S+$/.test(has('email'))) problems.email = 'Enter a valid email address, e.g. name@example.com';
    if (!has('address')) problems.address = 'Please enter your address (house, road, area)';
    if (has('postcode') && !/^\d{4}$/.test(has('postcode'))) problems.postcode = 'Enter the 4-digit postcode, e.g. 1217';
    if (!d.district) problems.district = 'Please select your district';
    else if (d.district === 'Others' && !has('districtOther')) problems.districtOther = 'Please type your district';
    else if (d.district === 'Others' && DISTRICTS.some(x => x.toLowerCase() === has('districtOther').toLowerCase())) problems.districtOther = 'That district is in the list: please select it above';
    if (!has('thana')) problems.thana = 'Please enter your thana';
    if (d.district === 'Dhaka' && !dest) problems.dest = 'Please pick your delivery location on the map';
    if (d.district && d.district !== 'Dhaka' && !partner) problems.partner = 'Please choose a shipping partner';
    setErrs(problems);
    const first = Object.keys(problems)[0];
    if (first) {
      const el = first === 'dest' || first === 'partner' ? document.getElementById('co-' + first) : first === 'district' ? document.getElementById('co-district-in') : e.target.elements[first];
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    d.phone = mobile;
    for (const k of ['name', 'email', 'address', 'districtOther', 'thana', 'postcode']) if (typeof d[k] === 'string') d[k] = d[k].trim();
    setReview(d);
  };
  const confirmOrder = () => { const d = review; setReview(null); if (online) setPaying(d); else finish(d, false); };

  const payOpts = PAY.filter(([k]) => site.payments[k] !== false);
  const payNote = online ? "You'll confirm the payment on the next screen. Demo only — no money is charged." : pay === 'COD' ? 'Pay cash or bKash to the rider when your order arrives.' : 'We email bank details with your invoice. Dispatch after payment clears.';

  return (
    <section className="page co ct-page">
      <div className="crumbs"><Link to="/cart">Cart</Link><span>/</span><span>Checkout</span></div>
      <div className="co-top"><h1 className="h1">Secure checkout</h1><CheckoutSteps step={1} /></div>
      <form key={user?.id ?? 'guest'} ref={form} onSubmit={submit} className="cart-body" noValidate hidden={!!review}>
        <div className="ct-co-main">
          {err && <div className="err">{err}</div>}
          <div className="cardbox">
            <div className="co-h"><i>1</i><div><b>Contact</b><small>Who should we call about this order?</small></div></div>
            <div className="two co-contact">
              <label className="lbl"><span>Full name <i className="req" aria-hidden="true">*</i></span><input className={'field' + bad('name')} name="name" required aria-required="true" aria-invalid={!!errs.name} aria-describedby={errs.name ? 'err-name' : undefined} autoComplete="name" defaultValue={user?.name} onChange={() => clr('name')} />{fe('name')}</label>
              <label className="lbl"><span>Mobile number <i className="req" aria-hidden="true">*</i></span><input className={'field' + bad('phone')} name="phone" type="tel" required aria-required="true" aria-invalid={!!errs.phone} aria-describedby={errs.phone ? 'err-phone' : undefined} autoComplete="tel" inputMode="tel" maxLength={18} defaultValue={user?.phone} placeholder="01XXX-XXXXXX"
                  onChange={e => { const m = mobileProblem(e.target.value); setErrs(x => (x.phone || m) ? { ...x, phone: m } : x); }}
                  onBlur={e => { const v = e.target.value.trim(), n = bdMobile(v); if (!v) return; if (n) { e.target.value = showMobile(n); clr('phone'); } else setErrs(x => ({ ...x, phone: MOBILE_HINT })); }} />
                {fe('phone')}</label>
              <label className="lbl"><span>Email <span className="lbl-opt">(optional)</span></span><input className={'field' + bad('email')} name="email" type="email" aria-invalid={!!errs.email} aria-describedby={errs.email ? 'err-email' : undefined} autoComplete="email" defaultValue={user?.email} onChange={() => clr('email')} />{fe('email')}</label>
            </div>
          </div>
          {shortL.length > 0 && (
            <div className="note-warn">
              <div className="ct-warn-top"><span className="ex">!</span><div className="ct-col3"><b className="ct-warn-t">Some items are short on stock</b><span className="ct-warn-d">{shortL.map(l => `${l.name.split(' (')[0]}: ${l.avail} of ${l.qty} in stock`).join(' · ')}</span></div></div>
              <div className="two ct-two-190">
                {[['split', 'Ship available now', 'Rest follows when restocked — no extra delivery fee'], ['together', 'Wait, ship together', 'We hold the order until everything is in stock'], ['drop', 'Remove unavailable', 'Pay only for what is in stock today']].map(([k, tt, d]) => (
                  <button type="button" key={k} className={sel(partial === k)} onClick={() => setPartial(k)}><b className="ct-opt-t">{tt}</b><small>{d}</small></button>
                ))}
              </div>
            </div>
          )}
          {t.heldN > 0 && (
            <div className="note-hold"><i>⏸</i><div className="ct-col3"><b className="ct-hold-t">{t.heldN} item(s) need approval before dispatch</b><span className="ct-hold-d">High-value machines and special orders are held until our team confirms model, installation and payment. Everything else in your cart ships as normal.</span></div></div>
          )}
          <div className="cardbox2">
            <div className="co-h"><i>2</i><div><b>Delivery</b><small>Choose your area, speed and address</small></div></div>
            <div className="two co-addr">
              <label className="lbl co-wide"><span>Address <i className="req" aria-hidden="true">*</i></span><input type="text" className={'field2' + bad('address')} name="address" required aria-required="true" aria-invalid={!!errs.address} aria-describedby={errs.address ? 'err-address' : undefined} maxLength={150} placeholder="House / flat, road, area" autoComplete="street-address" defaultValue={user?.address} onChange={() => clr('address')} />{fe('address')}</label>
              <label className="lbl"><span>Postcode <span className="lbl-opt">(optional)</span></span><input className={'field' + bad('postcode')} name="postcode" aria-invalid={!!errs.postcode} aria-describedby={errs.postcode ? 'err-postcode' : undefined} inputMode="numeric" maxLength={4} autoComplete="postal-code" placeholder="e.g. 1217" onChange={e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); clr('postcode'); }} />{fe('postcode')}</label>
              <div className="lbl"><label htmlFor="co-district-in"><span>District <i className="req" aria-hidden="true">*</i></span></label>
                <DistrictCombo id="co-district-in" name="district" value={district} options={DISTRICTS} invalid={!!errs.district} describedBy={errs.district ? 'err-district' : undefined}
                  onChange={v => { setDistrict(v); setPartner(''); clr('district'); clr('partner'); }} />
                {fe('district')}
              </div>
              {district === 'Others' && (
                <label className="lbl co-wide co-other"><span>Type your district <i className="req" aria-hidden="true">*</i></span>
                  <input className={'field' + bad('districtOther')} name="districtOther" required aria-required="true" aria-invalid={!!errs.districtOther} aria-describedby={errs.districtOther ? 'err-districtOther' : undefined} autoFocus maxLength={40} autoComplete="address-level2" placeholder="Your district, e.g. Sherpur" onChange={() => clr('districtOther')} />
                  {fe('districtOther')}
                </label>
              )}
              <label className="lbl"><span>Thana <i className="req" aria-hidden="true">*</i></span><input className={'field' + bad('thana')} name="thana" required aria-required="true" aria-invalid={!!errs.thana} aria-describedby={errs.thana ? 'err-thana' : undefined} list={district === 'Dhaka' ? 'thana-dhaka' : undefined} maxLength={40} autoComplete="off" placeholder={district === 'Dhaka' ? 'Pick or type, e.g. Mirpur' : 'Thana / upazila'} onChange={() => clr('thana')} />{fe('thana')}</label>
              {district === 'Dhaka' && <datalist id="thana-dhaka">{DHAKA_THANAS.map(x => <option key={x} value={x} />)}</datalist>}
            </div>
            {!district && <div className="dm-hint" id="co-delivery-hint">Select your district above to see delivery options</div>}
            {district === 'Dhaka' && (
              <div id="co-dest" tabIndex={-1} className="co-dest">
                <Suspense fallback={<div className="dm-hint">Loading map…</div>}>
                  <DeliveryMap office={dl.office} freeKm={dl.freeKm} label={dl.office.label} value={dest} invalid={!!errs.dest} onChange={q => { setDest(q); if (q) clr('dest'); }} />
                </Suspense>
                {fe('dest')}
              </div>
            )}
            {!!district && district !== 'Dhaka' && (
              <div id="co-partner" tabIndex={-1} className="co-partner">
                <span className="ct-label13">Shipping partner <i className="req" aria-hidden="true">*</i></span>
                <div className="two ct-two-180" role="radiogroup" aria-label="Shipping partner">
                  {dl.partners.map(p => (
                    <button type="button" key={p.id} role="radio" aria-checked={partner === p.id} className={sel(partner === p.id)} onClick={() => { setPartner(p.id); clr('partner'); }}>{partnerLogo(p.id) && <span className="pt-logo"><img src={partnerLogo(p.id)} alt="" loading="lazy" /></span>}<span className="ct-zone-t">{p.name}</span></button>
                  ))}
                </div>
                {fe('partner')}
                <small className="dm-hint">Delivery charge {fmt(site.outsideFee)} · courier, 2–4 days · we will confirm your parcel with the partner</small>
                {codOn && <span className="cod-pill">✓ Cash on delivery available</span>}
              </div>
            )}
            {area === 'inside' && !!district && !dest && Number(site.freeOver) > 0 && (
              <div className="free-bar"><span>{t.freeElig ? '🎉 You unlocked free delivery' : `Add ${fmt(t.freeLeft)} more for free delivery (orders over ${fmt(t.freeOver)})`}</span><i><b style={{ width: Math.min(100, Math.round(t.subtotal / t.freeOver * 100)) + '%' }} /></i></div>
            )}
            {area === 'inside' && !!district && (
              <div className="dmeth">
                <span className="ct-label13">Delivery method</span>
                <div className="dmeth-grid" role="radiogroup" aria-label="Delivery method">
                  <button type="button" role="radio" aria-checked={!exOn} className={'dopt' + (!exOn ? ' on' : '')} onClick={() => setExpress(false)}>
                    <span className="dopt-ic std">🚚</span>
                    <span className="ct-express-col">
                      <span className="ex-ttl"><b className="ct-fs14">Standard delivery</b><span className="ex-badge std">same / next day</span></span>
                      <span className="ct-express-d">Brought to your door by our own rider</span>
                    </span>
                    <span className="ex-fee">{stdFee}</span>
                    <span className="dopt-rad" aria-hidden="true"><i /></span>
                  </button>
                  <button type="button" role="radio" aria-checked={exOn} className={'dopt xp' + (exOn ? ' on' : '')} onClick={() => setExpress(true)}>
                    <span className="dopt-ic">⚡</span>
                    <span className="ct-express-col">
                      <span className="ex-ttl"><b className="ct-fs14">Express delivery</b><span className="ex-badge">within 3 hours</span></span>
                      <span className="ct-express-d">For urgent toner and cartridges inside Dhaka</span>
                    </span>
                    <span className="ex-fee">+ {fmt(site.expressFee)}</span>
                    <span className="dopt-rad" aria-hidden="true"><i /></span>
                  </button>
                </div>
                {codOn && <span className="cod-pill">✓ Cash on delivery available</span>}
              </div>
            )}
            <label className="lbl">Order note (optional)<input className="field2" name="note" placeholder="e.g. Printer model, floor / office name" /></label>
          </div>
          <div className="cardbox2">
            <div className="co-h"><i>3</i><div><b>Payment</b><small>Pick how you would like to pay</small></div></div>
            <div className="ct-pay-grid">
              {payOpts.map(([k, tt, d, [logo, fs, bg, img]]) => (
                <button type="button" key={k} className={'pay' + (pay === k ? ' on' : '')} onClick={() => setPay(k)}>
                  <span className={'logo2' + (img ? ' img' : '')} style={img ? undefined : { background: bg, fontSize: fs }}>{img ? <img src={img} alt={tt} /> : logo}</span>
                  <span className="ct-pay-col"><b>{tt}</b><small>{d}</small></span>
                  <span className="rad"><i /></span>
                </button>
              ))}
            </div>
            {pay === 'Card' && (
              <div className="ct-col8">
                <span className="ct-label13">Card gateway <span className="ct-gw-sub">· Visa, Mastercard, Amex, DBBL Nexus</span></span>
                <div className="ct-wrap8">{['SSLCommerz', 'aamarPay', 'ShurjoPay'].map(g => <button type="button" key={g} className={'slot-t ct-gw-btn' + (gw === g ? ' on' : '')} onClick={() => setGw(g)}>{g}</button>)}</div>
              </div>
            )}
            <span className="ct-note">{payNote}</span>
          </div>
          <div className="cardbox ct-pad18">
            <label className="ct-mkt-lbl">
              <input type="checkbox" name="mkt" value="1" className="ct-mkt-chk" />
              <span>Keep me posted — email me deals, refill reminders &amp; new arrivals. <span className="ct-mkt-opt">Optional. We'll send a confirmation link first; unsubscribe anytime.</span></span>
            </label>
          </div>
        </div>
        <aside className="summary">
          <span className="sum-t">Order summary <em>{t.lines.length} item{t.lines.length > 1 ? 's' : ''}</em></span>
          {t.lines.map(l => (
            <div key={l.id} className="ct-sum-row">
              <div className="ct-sum-img" style={{ backgroundImage: l.img ? `url('${l.img}')` : 'none' }} />
              <span className="ct-sum-name">{l.name} × {l.qty}</span><b>{fmt(l.price * l.chargeQty)}</b>
            </div>
          ))}
          <CouponBox value={coupon} onChange={setCoupon} ok={t.okCoupon} />
          {!user && <button type="button" onClick={() => setLoginOpen(true)} className="ct-member"><b>Members save {site.memberPct}% extra.</b> Sign in to apply member pricing →</button>}
          <div className="r ct-sub-r"><span>Subtotal</span><span>{fmt(t.subtotal)}</span></div>
          {t.discount > 0 && <Row k="Coupon" v={'− ' + fmt(t.discount)} cls="ct-green" />}
          {t.member > 0 && <Row k={`Member price (${t.memberPct}%)`} v={'− ' + fmt(t.member)} cls="ct-green" />}
          <Row k={'Delivery · ' + (district ? ZONE[t.zone] : 'select district')} v={t.delivery ? fmt(t.delivery) : 'Free'} />
          <div className="tot"><b className="ct-tot-l">Total</b><b>{fmt(t.total)}</b></div>
          <span className="ct-vat-note">Excluding all Govt VAT &amp; taxes</span>
          <button className="btn btn-blue ct-place" disabled={busy}>{busy ? 'Placing order…' : online ? 'Pay & place order' : 'Place order'}</button>
          <div className="trust"><span>🔒 Secure checkout</span><span>🚚 Fast delivery</span><span>✓ Genuine products</span></div>
          <span className="ct-call">We will call you on your mobile number to confirm this order.</span>
        </aside>
      </form>
      {review && (() => {
        const place = (review.district === 'Others' ? review.districtOther : review.district || '').trim();
        const hasP = x => x && review.address.toLowerCase().includes(String(x).toLowerCase());
        const addr = [review.address, hasP(review.thana) ? '' : review.thana, hasP(place) ? '' : place].filter(Boolean).join(', ') + (review.postcode ? ' - ' + review.postcode : '');
        const partnerName = dl.partners.find(x => x.id === partner)?.name;
        const payName = pay === 'Card' ? 'Card · ' + gw : PAY_LABEL[pay] || pay;
        return (
          <div className="rvw2-page">
            <div className="rvw2-top"><span className="rvw2-step">Step 2 of 3 · Review</span><h2 id="rvw2-t">Review your order</h2><span>Check everything once, then confirm. You can still edit.</span></div>
            <div className="rvw2-grid">
              <div className="rvw2-main">
                <div className="rvw2-det rvw2-two">
                  <div className="rvw2-r"><i className="rvw2-ic" aria-hidden="true">👤</i><div className="rvw2-c"><h4>Contact</h4><p><b>{review.name}</b></p><p>{showMobile(review.phone)}{review.email ? ' · ' + review.email : ''}</p></div><button type="button" className="rvw2-ed" onClick={() => setReview(null)}>Edit</button></div>
                  <div className="rvw2-r"><i className="rvw2-ic" aria-hidden="true">📍</i><div className="rvw2-c"><h4>Delivery address</h4><p>{addr}</p><p className="rvw2-m">{area === 'inside' ? (dest ? `${Number(dest.km).toFixed(1)} km from our office` : 'Inside Dhaka') : `Courier: ${partnerName || '—'}`}{exOn ? ' · Express (within 3 hours)' : ' · Standard delivery'}</p>{review.note ? <p className="rvw2-note">Note: {review.note}</p> : null}</div><button type="button" className="rvw2-ed" onClick={() => setReview(null)}>Edit</button></div>
                </div>
                <div className="rvw2-det rvw2-itm">
                  <div className="rvw2-ih"><h4>Items · {t.count}</h4></div>
                  <ul className="rvw2-items">{t.lines.map(l => <li key={l.id}><i className="rvw2-th" style={{ backgroundImage: l.img ? `url('${l.img}')` : 'none' }} /><span>{l.name}<small>Qty {l.chargeQty}</small></span><b>{fmt(l.price * l.chargeQty)}</b></li>)}</ul>
                </div>
              </div>
              <div className="rvw2-side">
                <div className="rvw2-det rvw2-pay">
                  <div className="rvw2-r"><i className="rvw2-ic" aria-hidden="true">💳</i><div className="rvw2-c"><h4>Payment</h4><p>{payName}</p></div><button type="button" className="rvw2-ed" onClick={() => setReview(null)}>Edit</button></div>
                </div>
              <aside className="rvw2-sum">
                <h4>Order summary</h4>
                <div className="rvw2-row"><span>Subtotal</span><span>{fmt(t.subtotal)}</span></div>
                {t.discount > 0 && <div className="rvw2-row g"><span>Coupon</span><span>− {fmt(t.discount)}</span></div>}
                {t.member > 0 && <div className="rvw2-row g"><span>Member price</span><span>− {fmt(t.member)}</span></div>}
                <div className="rvw2-row"><span>Delivery{exOn ? ' (express)' : ''}</span><span>{t.delivery ? fmt(t.delivery) : 'Free'}</span></div>
                <div className="rvw2-tot"><span>Total</span><b>{fmt(t.total)}</b></div>
                <small className="rvw2-m">Excluding all Govt VAT &amp; taxes</small>
                <div className="rvw2-btns">
                  <button type="button" className="btn btn-blue ct-place rvw2-ok" autoFocus onClick={confirmOrder} disabled={busy}>{online ? 'Confirm & pay' : 'Confirm order'}</button>
                  <button type="button" className="rvw2-edit" onClick={() => setReview(null)}>✎ Edit</button>
                </div>
              </aside>
              </div>
            </div>
          </div>
        );
      })()}
      {paying && (
        <div className="modal-bg">
          <div className="paybox">
            <div className="hero2" style={{ background: PAY_HERO[pay] || PAY_HERO.Card }}><span className="ct-pay-hero-t">Secure payment · demo</span><b>{pay === 'Card' ? gw : pay}</b></div>
            <div className="bd">
              <div className="ct-pay-row"><span className="ct-pay-co">AR Trade International</span><b className="ct-pay-amt">{fmt(t.total)}</b></div>
              <span className="ct-pay-demo">{pay === 'Card' ? `You would enter card details on the ${gw} secure page.` : `You would enter your ${pay} number, OTP and PIN on the ${pay} payment page.`} Demo only — no money is charged.</span>
              <button className="btn btn-dark btn-pill ct-pad14" onClick={() => finish(paying, true)} disabled={busy}>Pay {fmt(t.total)}</button>
              <button onClick={() => setPaying(null)} className="ct-cancel">Cancel and go back</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function Success() {
  const { id } = useParams();
  const { site, say } = useStore();
  const [o] = useState(() => { try { const s = JSON.parse(sessionStorage.getItem('ar_last_order')); return s?.id === id ? s : null; } catch { return null; } });
  const [mailed, setMailed] = useState(false);
  // fireworks play once per freshly placed order, not again on every refresh of this page
  const [fx] = useState(() => { try { const k = 'ar_fx_' + id; if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, '1'); return true; } catch { return true; } });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  if (!o) {
    return <div className="success"><h1>Thank you!</h1><p>Your order <b>{id}</b> is placed. Use the Track order page with your mobile number to see its status.</p><Link className="btn btn-dark btn-pill ct-pad14-24" to="/track">Track this order</Link></div>;
  }
  const back = o.items.filter(i => i.backorder > 0);
  return (
    <section className="success">
      {fx && <Fireworks />}
      <div className="ct-flex"><CheckoutSteps step={3} /></div>
      <div className="ct-flex"><span className="ct-dot ct-dot-1" /><span className="ct-dot ct-dot-2" /><span className="ct-dot ct-dot-3" /></div>
      <h1>Thank you! Order placed.</h1>
      <p className="ct-succ-p">Order <b>{o.id}</b> for <b>{fmt(o.total)}</b> is confirmed. We'll call {o.customer.phone} shortly to verify. Payment: {o.payment}.</p>
      {o.hold && <div className="ct-succ-note ct-succ-hold">⏸ {o.holdNote}. We'll call you to confirm before dispatch.</div>}
      {back.length > 0 && <div className="ct-succ-note ct-succ-back">{(o.partial === 'together' ? 'We will ship everything together once these are restocked: ' : 'Shipping available items now. To follow: ') + back.map(i => `${i.backorder} × ${i.name.split(' (')[0]}`).join(', ')}</div>}
      <div className="ct-succ-info"><span className="info-pill">🚚 {o.slot || 'Standard delivery'}</span>{o.distanceKm != null && <span className="info-pill">📍 Delivery: {Number(o.distanceKm).toFixed(1)} km · {o.delivery ? fmt(o.delivery) : 'Free'}</span>}{o.shipPartner && <span className="info-pill">📦 Shipping partner: {o.shipPartnerName || (typeof o.shipPartner === 'object' ? o.shipPartner.name : (deliveryOf(site).partners.find(p => p.id === o.shipPartner)?.name || o.shipPartner))}</span>}<span className="info-pill">{o.payStatus === 'Paid' ? '✓ Paid · ' + o.payment : 'Payment: ' + o.payment}</span></div>
      <div className="ct-succ-btns">
        <button className="btn btn-pill ct-btn-inv" onClick={() => { if (!printInvoice(o, site)) say('Allow pop-ups to download the invoice'); }}>⤓ Invoice (PDF)</button>
        <button className="btn btn-ghost btn-pill ct-pad13-20" onClick={() => { if (o.customer.email) { setMailed(true); say('Invoice sent to ' + o.customer.email); } else say('Add an email at checkout to receive the invoice'); }}>{mailed ? '✓ Invoice emailed' : '✉ Email invoice'}</button>
      </div>
      <div className="ct-succ-btns">
        <Link className="btn btn-dark btn-pill ct-pad14-24" to={`/track?id=${o.id}&phone=${encodeURIComponent(o.customer.phone)}`}>Track this order</Link>
        <Link className="btn btn-ghost btn-pill ct-btn-cont" to="/shop/all">Continue shopping</Link>
      </div>
    </section>
  );
}
