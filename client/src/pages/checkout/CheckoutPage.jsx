import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fmt } from '../../api.js';
import CheckoutSteps from '../../components/CheckoutSteps.jsx';
import { DISTRICTS, deliveryOf } from '../../data.js';
import { useStore } from '../../store.jsx';
import CheckoutForm from './CheckoutForm.jsx';
import { LAST_ORDER_KEY, ONLINE_PAYS, writeSession } from './constants.js';
import { orderPayload, paymentName, totalBeforeDelivery } from './helpers.js';
import { useCoupon, useFieldErrors } from './parts.jsx';
import PayModal from './PayModal.jsx';
import ReviewPage from './ReviewPage.jsx';
import { normalizeCheckout, validateCheckout } from './validate.js';

/** Where the browser should look first for the first wrong field. */
function fieldToFocus(form, key) {
  if (key === 'dest' || key === 'partner') return document.getElementById('co-' + key);
  return key === 'district' ? document.getElementById('co-district-in') : form.elements[key];
}

/**
 * The checkout page: owns all state, places the order, and hands one context object `c` to the form sections.
 * Flow: form -> review (a page of its own) -> optional demo payment screen -> POST /orders -> /success/:id.
 */
export default function CheckoutPage() {
  const { cartLines, user, site, totals, clearCart, setLoginOpen, optIn } = useStore();
  const nav = useNavigate();
  const [coupon, setCoupon] = useCoupon();
  const [express, setExpress] = useState(false);
  const [partial, setPartial] = useState('split');
  const [pay, setPay] = useState('COD');
  const [gw, setGw] = useState('SSLCommerz');
  const [paying, setPaying] = useState(null); // the checked form while the demo payment screen is open
  const [review, setReview] = useState(null); // the checked form, shown for a last look before the order is placed
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [district, setDistrict] = useState(DISTRICTS.includes(user?.district) ? user.district : '');
  const [dest, setDest] = useState(null); // { lat, lng, km, fee } from the map
  const [partner, setPartner] = useState('');
  const f = useFieldErrors(); // inline messages, one per wrong field (the browser's own pop-up is switched off with noValidate)
  const form = useRef(null);
  const draft = useRef({}); // what the customer typed; restored when the form remounts after a sign-in
  const inflight = useRef(false); // blocks a second POST while one is running
  const wasReview = useRef(false);

  const dl = deliveryOf(site);
  const area = district && district !== 'Dhaka' ? 'outside' : 'inside';
  const t = totals({ area, coupon, express, partial, deliveryBase: dest && Number.isFinite(dest.fee) ? dest.fee : undefined });
  const exOn = express && area === 'inside' && !!district;
  const codOn = site.payments?.COD !== false; // the shop takes cash on delivery
  const stdFee = dest ? (t.freeElig || !(t.base > 0) ? 'Free' : fmt(t.base)) : 'By distance'; // the standard delivery charge shown on its card
  const online = ONLINE_PAYS.includes(pay);
  const pendingQuote = district === 'Dhaka' && !dest; // Dhaka is priced by the map: no delivery amount until it is picked
  const shownTotal = pendingQuote ? totalBeforeDelivery(t) : t.total;
  const typed = draft.current, first = (k, fallback) => typed[k] || fallback;
  const defaults = {
    name: first('name', user?.name), phone: first('phone', user?.phone), email: first('email', user?.email), address: first('address', user?.address),
    postcode: typed.postcode, thana: typed.thana, districtOther: typed.districtOther, note: typed.note, mkt: typed.mkt === '1'
  };

  useEffect(() => { // the review is a page: go to its top; when the form comes back focus its first field and measure the map again
    window.scrollTo({ top: 0 });
    if (review) { wasReview.current = true; return; }
    if (wasReview.current) { wasReview.current = false; form.current?.elements.name?.focus({ preventScroll: true }); }
    const timer = setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    return () => clearTimeout(timer);
  }, [review]);

  if (!cartLines.length) return <section className="page"><div className="empty">Your cart is empty. <Link to="/shop/all" className="ct-link-bold">Browse products</Link></div></section>;

  const saveDraft = () => { if (form.current) draft.current = Object.fromEntries(new FormData(form.current).entries()); };
  const pickDistrict = v => { setDistrict(v); setPartner(''); f.clr('district'); f.clr('partner'); };

  /** Places the order. `d` is the checked form, `paid` tells the server the demo payment was confirmed. */
  const finish = async (d, paid) => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true); setErr('');
    try {
      const o = await api.post('/orders', orderPayload({ d, lines: cartLines, area, dest, partner, pay, gw, paid, coupon, exOn, partial }));
      writeSession(LAST_ORDER_KEY, o);
      if (d.mkt && d.email) optIn(d.email, 'Checkout · ' + o.id).catch(() => {});
      setCoupon(''); clearCart(); setPaying(null); nav('/success/' + o.id);
    } catch (e) {
      inflight.current = false;
      setErr(e.message); setPaying(null); setBusy(false); window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const submit = e => {
    e.preventDefault();
    saveDraft();
    const d = Object.fromEntries(new FormData(e.target).entries());
    const problems = validateCheckout(d, { dest, partner });
    f.setErrs(problems);
    const key = Object.keys(problems)[0];
    if (key) {
      const el = fieldToFocus(e.target, key);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setReview(normalizeCheckout(d));
  };
  const confirmOrder = () => { const d = review; setReview(null); if (online) setPaying(d); else finish(d, false); };

  const c = { f, defaults, t, site, dl, user, setLoginOpen, coupon, setCoupon, partial, setPartial, pay, setPay, gw, setGw, district, pickDistrict, dest, setDest, partner, setPartner,
    express, setExpress, area, exOn, codOn, online, busy, stdFee, pendingQuote, shownTotal };

  return (
    <section className="page co ct-page">
      <div className="crumbs"><Link to="/cart">Cart</Link><span>/</span><span>Checkout</span></div>
      <div className="co-top"><h1 className="h1">Secure checkout</h1><CheckoutSteps step={1} /></div>
      {err && <div className="err" role="alert">{err}</div>}
      <CheckoutForm key={user?.id ?? 'guest'} c={c} formRef={form} onSubmit={submit} onDraft={saveDraft} hidden={!!review} />
      {review && (
        <ReviewPage review={review} onEdit={() => setReview(null)} onConfirm={confirmOrder}
          info={{ t, area, dest, exOn, partnerName: dl.partners.find(x => x.id === partner)?.name, payName: paymentName(pay, gw), online, busy }} />
      )}
      {paying && <PayModal pay={pay} gw={gw} total={shownTotal} busy={busy} onPay={() => finish(paying, true)} onCancel={() => setPaying(null)} />}
    </section>
  );
}
