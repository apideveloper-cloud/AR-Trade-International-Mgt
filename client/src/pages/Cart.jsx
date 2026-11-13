import { useEffect, useRef, useState } from 'react';
import { productPath } from '../slug.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmt } from '../api.js';
import Fireworks from '../components/Fireworks.jsx';
import { PAY, PAY_HERO, PAY_LABEL, SLOT_TIMES } from '../data.js';
import { printInvoice } from '../invoice.js';
import { useStore } from '../store.jsx';
import './cart.css';

const Row = ({ k, v, cls }) => <div className={cls ? 'r ' + cls : 'r'}><span>{k}</span><span>{v}</span></div>;
const ZONE = { inside: 'Inside Dhaka', suburb: 'Dhaka suburbs', outside: 'Outside Dhaka' };

function CouponBox({ value, onChange, ok }) {
  return (
    <>
      <input className="pill-in" value={value} onChange={e => onChange(e.target.value)} placeholder="Coupon code" />
      {ok && <span className="ct-coupon-ok">✓ Coupon applied</span>}
    </>
  );
}

export function Cart() {
  const { cartLines, setQty, user, totals } = useStore();
  const [coupon, setCoupon] = useState('');
  const t = totals({ area: user?.area || 'inside', coupon });
  return (
    <section className="page ct-page">
      <h1 className="h1 ct-h1">Your cart</h1>
      {!cartLines.length ? (
        <div className="empty"><span className="ct-empty-t">Your cart is empty</span><Link to="/shop/all" className="btn btn-dark btn-pill ct-btn-start">Start shopping</Link></div>
      ) : (
        <div className="cart-body">
          <div className="cart-lines">
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
  const [area, setArea] = useState(user?.area || 'inside');
  const [coupon, setCoupon] = useState('');
  const [express, setExpress] = useState(false);
  const [partial, setPartial] = useState('split');
  const [pay, setPay] = useState('COD');
  const [gw, setGw] = useState('SSLCommerz');
  const [vatInv, setVatInv] = useState(false);
  const [slotDay, setSlotDay] = useState(0);
  const [slotTime, setSlotTime] = useState(0);
  const [paying, setPaying] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const t = totals({ area, coupon, express, partial });
  const exOn = express && area === 'inside';
  const online = ['bKash', 'Nagad', 'Rocket', 'Card'].includes(pay);
  const startDay = area === 'outside' ? 2 : 0;
  const day = i => { const d = new Date(Date.now() + i * 864e5); return { t: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short' }), d: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }; };
  const slotLabel = exOn ? 'Express · within 3 hours' : (() => { const x = day(slotDay + startDay); return `${x.t}, ${x.d} · ${SLOT_TIMES[slotTime]}`; })();
  const shortL = t.lines.filter(l => l.short > 0);
  const form = useRef(null);

  if (!cartLines.length) return <section className="page"><div className="empty">Your cart is empty. <Link to="/shop/all" className="ct-link-bold">Browse products</Link></div></section>;

  const finish = async (d, paid) => {
    setBusy(true); setErr('');
    try {
      const o = await api.post('/orders', {
        items: cartLines.map(l => ({ id: l.p.id, qty: l.qty })), customer: { name: d.name, phone: d.phone, email: d.email }, address: d.address, area,
        payment: pay === 'Card' ? 'Card · ' + gw : PAY_LABEL[pay] || pay, gateway: pay === 'Card' ? gw : '', paid, note: d.note, coupon, express: exOn,
        partial, slot: slotLabel, vatInvoice: vatInv, company: d.company, bin: d.bin
      });
      try { sessionStorage.setItem('ar_last_order', JSON.stringify(o)); } catch { /* storage unavailable */ }
      if (d.mkt && d.email) optIn(d.email, 'Checkout · ' + o.id).catch(() => {});
      clearCart(); setPaying(null); nav('/success/' + o.id);
    } catch (e) { setErr(e.message); setPaying(null); setBusy(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const submit = e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    if (online) setPaying(d); else finish(d, false);
  };

  const payOpts = PAY.filter(([k]) => site.payments[k] !== false);
  const payNote = online ? "You'll confirm the payment on the next screen. Demo only — no money is charged." : pay === 'COD' ? 'Pay cash or bKash to the rider when your order arrives.' : 'We email bank details with your invoice. Dispatch after payment clears.';
  const zones = [['inside', 'Inside Dhaka', (site.insideFee ? fmt(site.insideFee) : 'Free') + ' · same / next day'], ['suburb', 'Dhaka suburbs', fmt(site.suburbFee) + ' · Savar, Gazipur, Narayanganj'], ['outside', 'Outside Dhaka', fmt(site.outsideFee) + ' · courier, 2–4 days']];

  return (
    <section className="page co ct-page">
      <div className="crumbs"><Link to="/cart">Cart</Link><span>/</span><span>Checkout</span></div>
      <div className="co-top"><h1 className="h1">Secure checkout</h1><div className="co-steps"><span className="done">Cart</span><span className="cur">Details</span><span>Confirmation</span></div></div>
      <form ref={form} onSubmit={submit} className="cart-body">
        <div className="ct-co-main">
          {err && <div className="err">{err}</div>}
          <div className="cardbox">
            <div className="co-h"><i>1</i><div><b>Contact</b><small>Who should we call about this order?</small></div></div>
            <div className="two">
              <label className="lbl">Full name<input className="field" name="name" required defaultValue={user?.name} /></label>
              <label className="lbl">Mobile number<input className="field" name="phone" required defaultValue={user?.phone} placeholder="01XXX-XXXXXX" /></label>
              <label className="lbl">Email (optional)<input className="field" name="email" type="email" defaultValue={user?.email} /></label>
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
            <div className="two ct-two-180">
              {zones.map(([k, tt, d]) => <button type="button" key={k} className={sel(area === k)} onClick={() => { setArea(k); if (k !== 'inside') setExpress(false); }}><span className="ct-zone-t">{tt}</span><small>{d}</small></button>)}
            </div>
            {area !== 'outside' && (
              <div className="free-bar"><span>{t.freeElig ? '🎉 You unlocked free delivery' : `Add ${fmt(t.freeLeft)} more for free delivery (orders over ${fmt(t.freeOver)})`}</span><i><b style={{ width: Math.min(100, Math.round(t.subtotal / t.freeOver * 100)) + '%' }} /></i></div>
            )}
            {area === 'inside' && (
              <button type="button" className={'express' + (exOn ? ' on' : '')} onClick={() => setExpress(x => !x)}>
                <span className="bolt">⚡</span>
                <div className="ct-express-col"><b className="ct-fs14">Express delivery · within 3 hours</b><span className="ct-express-d">For urgent toner and cartridges inside Dhaka · + {fmt(site.expressFee)}</span></div>
                <span className={'sw ct-sw' + (exOn ? ' on' : '')} />
              </button>
            )}
            {!exOn && (
              <div className="ct-col8">
                <span className="ct-label13">Delivery slot</span>
                <div className="ct-wrap8">{[0, 1, 2, 3].map(i => { const x = day(i + startDay); return <button type="button" key={i} className={'slot' + (slotDay === i ? ' on' : '')} onClick={() => setSlotDay(i)}><b className="ct-fs13">{x.t}</b><small>{x.d}</small></button>; })}</div>
                <div className="ct-wrap8">{SLOT_TIMES.map((x, i) => <button type="button" key={x} className={'slot-t' + (slotTime === i ? ' on' : '')} onClick={() => setSlotTime(i)}>{x}</button>)}</div>
              </div>
            )}
            <label className="lbl">Full address<textarea className="field2 ct-resize" name="address" required rows={3} defaultValue={user?.address} /></label>
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
          <div className="cardbox2 ct-gap10">
            <label className="ct-vat-lbl"><input type="checkbox" checked={vatInv} onChange={e => setVatInv(e.target.checked)} className="ct-chk16" />I need a VAT invoice (Mushak 6.3) for my company</label>
            {vatInv && <div className="two ct-two-200"><label className="lbl">Company name<input className="field2" name="company" /></label><label className="lbl">BIN number<input className="field2" name="bin" placeholder="13-digit BIN" /></label></div>}
            <span className="ct-note">Your invoice is downloadable as PDF after the order.</span>
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
          <Row k={'Delivery · ' + ZONE[t.zone]} v={t.delivery ? fmt(t.delivery) : 'Free'} />
          {t.express > 0 && <Row k="incl. express" v={fmt(t.express)} cls="ct-incl" />}
          <div className="tot"><b className="ct-tot-l">Total</b><b>{fmt(t.total)}</b></div>
          <span className="ct-vat-note">Includes VAT {t.vatPct}% · {fmt(t.vat)}</span>
          <button className="btn btn-blue" disabled={busy}>{busy ? 'Placing order…' : (online ? 'Pay & place order · ' : 'Place order · ') + fmt(t.total)}</button>
          <div className="trust"><span>🔒 Secure checkout</span><span>🚚 Fast delivery</span><span>✓ Genuine products</span></div>
          <span className="ct-call">We will call you on your mobile number to confirm this order.</span>
        </aside>
      </form>
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
      <div className="ct-flex"><span className="ct-dot ct-dot-1" /><span className="ct-dot ct-dot-2" /><span className="ct-dot ct-dot-3" /></div>
      <h1>Thank you! Order placed.</h1>
      <p className="ct-succ-p">Order <b>{o.id}</b> for <b>{fmt(o.total)}</b> is confirmed. We'll call {o.customer.phone} shortly to verify. Payment: {o.payment}.</p>
      {o.hold && <div className="ct-succ-note ct-succ-hold">⏸ {o.holdNote}. We'll call you to confirm before dispatch.</div>}
      {back.length > 0 && <div className="ct-succ-note ct-succ-back">{(o.partial === 'together' ? 'We will ship everything together once these are restocked: ' : 'Shipping available items now. To follow: ') + back.map(i => `${i.backorder} × ${i.name.split(' (')[0]}`).join(', ')}</div>}
      <div className="ct-succ-info"><span className="info-pill">🚚 {o.slot || 'Standard delivery'}</span><span className="info-pill">{o.payStatus === 'Paid' ? '✓ Paid · ' + o.payment : 'Payment: ' + o.payment}</span></div>
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
