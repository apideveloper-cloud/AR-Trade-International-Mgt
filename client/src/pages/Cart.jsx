import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmt } from '../api.js';
import { PAY, PAY_HERO, PAY_LABEL, SLOT_TIMES } from '../data.js';
import { printInvoice } from '../invoice.js';
import { useStore } from '../store.jsx';

const Row = ({ k, v, style }) => <div className="r" style={style}><span>{k}</span><span>{v}</span></div>;
const ZONE = { inside: 'Inside Dhaka', suburb: 'Dhaka suburbs', outside: 'Outside Dhaka' };

function CouponBox({ value, onChange, ok }) {
  return (
    <>
      <input className="pill-in" value={value} onChange={e => onChange(e.target.value)} placeholder="Coupon code" />
      {ok && <span style={{ fontSize: 13, color: 'oklch(0.45 0.15 150)', fontWeight: 700 }}>✓ Coupon applied</span>}
    </>
  );
}

export function Cart() {
  const { cartLines, setQty, user, totals } = useStore();
  const [coupon, setCoupon] = useState('');
  const t = totals({ area: user?.area || 'inside', coupon });
  return (
    <section className="page" style={{ padding: '28px 28px 72px' }}>
      <h1 className="h1" style={{ marginBottom: 24 }}>Your cart</h1>
      {!cartLines.length ? (
        <div className="empty"><span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 24 }}>Your cart is empty</span><Link to="/shop/all" className="btn btn-dark btn-pill" style={{ padding: '13px 22px' }}>Start shopping</Link></div>
      ) : (
        <div className="cart-body">
          <div className="cart-lines">
            {t.lines.map(l => (
              <div className="cline" key={l.id}>
                <Link to={'/product/' + l.id}><div className="im" style={{ backgroundImage: l.img ? `url('${l.img}')` : 'none' }} /></Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <Link to={'/product/' + l.id} style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>{l.name}</Link>
                  <span style={{ fontSize: 13, color: '#5d6270' }}>{fmt(l.price)} each</span>
                  {l.short > 0 && <span style={{ fontSize: 12.5, color: 'oklch(0.5 0.15 60)', fontWeight: 700 }}>Only {l.avail} in stock — you can choose how to handle the rest at checkout</span>}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="qty2"><button onClick={() => setQty(l.id, l.qty - 1)}>−</button><span>{l.qty}</span><button onClick={() => setQty(l.id, l.qty + 1)}>+</button></div>
                    <button onClick={() => setQty(l.id, 0)} style={{ border: 0, background: 'transparent', color: '#5d6270', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>Remove</button>
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 20 }}>{fmt(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <aside className="summary">
            <span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 22 }}>Order summary</span>
            <CouponBox value={coupon} onChange={setCoupon} ok={t.okCoupon} />
            <Row k={`Subtotal (${t.count} items)`} v={fmt(t.subtotal)} />
            <Row k="Discount" v={'− ' + fmt(t.discount + t.member)} />
            <Row k="Delivery (inside Dhaka)" v={t.delivery ? fmt(t.delivery) : 'Free'} />
            <Row k="You save vs. regular price" v={fmt(t.saved)} style={{ color: 'oklch(0.5 0.2 350)' }} />
            <div className="tot"><b style={{ fontFamily: 'inherit', fontSize: 16 }}>Total</b><b>{fmt(t.total)}</b></div>
            <Link to="/checkout" className="btn btn-blue" style={{ textAlign: 'center' }}>Proceed to checkout</Link>
            <Link to="/shop/all" style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#3d424d' }}>Continue shopping</Link>
          </aside>
        </div>
      )}
    </section>
  );
}

const sel = on => 'opt' + (on ? ' on' : '');

export function Checkout() {
  const { cartLines, user, site, totals, clearCart, setLoginOpen, optIn, say } = useStore();
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

  if (!cartLines.length) return <section className="page"><div className="empty">Your cart is empty. <Link to="/shop/all" style={{ fontWeight: 700, textDecoration: 'underline' }}>Browse products</Link></div></section>;

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
    <section className="page" style={{ padding: '28px 28px 72px' }}>
      <div className="crumbs"><Link to="/cart">Cart</Link><span>/</span><span>Checkout</span></div>
      <h1 className="h1" style={{ marginBottom: 24 }}>Checkout</h1>
      <form ref={form} onSubmit={submit} className="cart-body">
        <div style={{ flex: '999 1 520px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {err && <div className="err">{err}</div>}
          <div className="cardbox">
            <span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20 }}>1. Contact</span>
            <div className="two">
              <label className="lbl">Full name<input className="field" name="name" required defaultValue={user?.name} /></label>
              <label className="lbl">Mobile number<input className="field" name="phone" required defaultValue={user?.phone} placeholder="01XXX-XXXXXX" /></label>
              <label className="lbl">Email (optional)<input className="field" name="email" type="email" defaultValue={user?.email} /></label>
            </div>
          </div>
          {shortL.length > 0 && (
            <div className="note-warn">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><span className="ex">!</span><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><b style={{ fontSize: 15, color: '#0b1631' }}>Some items are short on stock</b><span style={{ fontSize: 13, color: '#56607a' }}>{shortL.map(l => `${l.name.split(' (')[0]}: ${l.avail} of ${l.qty} in stock`).join(' · ')}</span></div></div>
              <div className="two" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 }}>
                {[['split', 'Ship available now', 'Rest follows when restocked — no extra delivery fee'], ['together', 'Wait, ship together', 'We hold the order until everything is in stock'], ['drop', 'Remove unavailable', 'Pay only for what is in stock today']].map(([k, tt, d]) => (
                  <button type="button" key={k} className={sel(partial === k)} onClick={() => setPartial(k)}><b style={{ fontSize: 13.5 }}>{tt}</b><small>{d}</small></button>
                ))}
              </div>
            </div>
          )}
          {t.heldN > 0 && (
            <div className="note-hold"><i>⏸</i><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><b style={{ fontSize: 14, color: '#0b1631' }}>{t.heldN} item(s) need approval before dispatch</b><span style={{ fontSize: 12.5, color: '#56607a', lineHeight: 1.5 }}>High-value machines and special orders are held until our team confirms model, installation and payment. Everything else in your cart ships as normal.</span></div></div>
          )}
          <div className="cardbox2">
            <span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20, color: '#0b1631' }}>2. Delivery</span>
            <div className="two" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
              {zones.map(([k, tt, d]) => <button type="button" key={k} className={sel(area === k)} onClick={() => { setArea(k); if (k !== 'inside') setExpress(false); }}><span style={{ fontWeight: 700, fontSize: 14 }}>{tt}</span><small>{d}</small></button>)}
            </div>
            {area !== 'outside' && (
              <div className="free-bar"><span>{t.freeElig ? '🎉 You unlocked free delivery' : `Add ${fmt(t.freeLeft)} more for free delivery (orders over ${fmt(t.freeOver)})`}</span><i><b style={{ width: Math.min(100, Math.round(t.subtotal / t.freeOver * 100)) + '%' }} /></i></div>
            )}
            {area === 'inside' && (
              <button type="button" className={'express' + (exOn ? ' on' : '')} onClick={() => setExpress(x => !x)}>
                <span className="bolt">⚡</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 14 }}>Express delivery · within 3 hours</b><span style={{ fontSize: 12.5, color: '#5d6270' }}>For urgent toner and cartridges inside Dhaka · + {fmt(site.expressFee)}</span></div>
                <span className={'sw' + (exOn ? ' on' : '')} style={{ width: 44, height: 26 }} />
              </button>
            )}
            {!exOn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Delivery slot</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[0, 1, 2, 3].map(i => { const x = day(i + startDay); return <button type="button" key={i} className={'slot' + (slotDay === i ? ' on' : '')} onClick={() => setSlotDay(i)}><b style={{ fontSize: 13 }}>{x.t}</b><small>{x.d}</small></button>; })}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{SLOT_TIMES.map((x, i) => <button type="button" key={x} className={'slot-t' + (slotTime === i ? ' on' : '')} onClick={() => setSlotTime(i)}>{x}</button>)}</div>
              </div>
            )}
            <label className="lbl">Full address<textarea className="field2" name="address" required rows={3} defaultValue={user?.address} style={{ resize: 'vertical' }} /></label>
            <label className="lbl">Order note (optional)<input className="field2" name="note" placeholder="e.g. Printer model, floor / office name" /></label>
          </div>
          <div className="cardbox2">
            <span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20, color: '#0b1631' }}>3. Payment</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,190px),1fr))', gap: 10 }}>
              {payOpts.map(([k, tt, d, [logo, fs, bg]]) => (
                <button type="button" key={k} className={'pay' + (pay === k ? ' on' : '')} onClick={() => setPay(k)}>
                  <span className="logo2" style={{ background: bg, fontSize: fs }}>{logo}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}><b>{tt}</b><small>{d}</small></span>
                  <span className="rad"><i /></span>
                </button>
              ))}
            </div>
            {pay === 'Card' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Card gateway <span style={{ fontWeight: 500, color: '#6b7080' }}>· Visa, Mastercard, Amex, DBBL Nexus</span></span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{['SSLCommerz', 'aamarPay', 'ShurjoPay'].map(g => <button type="button" key={g} className={'slot-t' + (gw === g ? ' on' : '')} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 800 }} onClick={() => setGw(g)}>{g}</button>)}</div>
              </div>
            )}
            <span style={{ fontSize: 12, color: '#6b7080' }}>{payNote}</span>
          </div>
          <div className="cardbox2" style={{ gap: 10 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}><input type="checkbox" checked={vatInv} onChange={e => setVatInv(e.target.checked)} style={{ width: 16, height: 16 }} />I need a VAT invoice (Mushak 6.3) for my company</label>
            {vatInv && <div className="two" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}><label className="lbl">Company name<input className="field2" name="company" /></label><label className="lbl">BIN number<input className="field2" name="bin" placeholder="13-digit BIN" /></label></div>}
            <span style={{ fontSize: 12, color: '#6b7080' }}>Your invoice is downloadable as PDF after the order.</span>
          </div>
          <div className="cardbox" style={{ padding: '18px 24px' }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.45, color: '#3a3f4b', cursor: 'pointer' }}>
              <input type="checkbox" name="mkt" value="1" style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
              <span>Keep me posted — email me deals, refill reminders &amp; new arrivals. <span style={{ color: '#7a8090' }}>Optional. We'll send a confirmation link first; unsubscribe anytime.</span></span>
            </label>
          </div>
        </div>
        <aside className="summary">
          <span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 22 }}>Your order</span>
          {t.lines.map(l => (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <div style={{ backgroundImage: l.img ? `url('${l.img}')` : 'none', backgroundSize: '118%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', width: 48, height: 48 }} />
              <span style={{ lineHeight: 1.3 }}>{l.name} × {l.qty}</span><b>{fmt(l.price * l.chargeQty)}</b>
            </div>
          ))}
          <CouponBox value={coupon} onChange={setCoupon} ok={t.okCoupon} />
          {!user && <button type="button" onClick={() => setLoginOpen(true)} style={{ textAlign: 'left', border: '1px dashed oklch(0.7 0.1 250)', background: 'oklch(0.97 0.02 250)', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, color: '#0b1631' }}><b>Members save {site.memberPct}% extra.</b> Sign in to apply member pricing →</button>}
          <div className="r" style={{ borderTop: '1px solid #e4e2dc', paddingTop: 12 }}><span>Subtotal</span><span>{fmt(t.subtotal)}</span></div>
          {t.discount > 0 && <Row k="Coupon" v={'− ' + fmt(t.discount)} style={{ color: 'oklch(0.45 0.15 150)' }} />}
          {t.member > 0 && <Row k={`Member price (${t.memberPct}%)`} v={'− ' + fmt(t.member)} style={{ color: 'oklch(0.45 0.15 150)' }} />}
          <Row k={'Delivery · ' + ZONE[t.zone]} v={t.delivery ? fmt(t.delivery) : 'Free'} />
          {t.express > 0 && <Row k="incl. express" v={fmt(t.express)} style={{ fontSize: 12.5, color: '#6b7080' }} />}
          <div className="tot"><b style={{ fontFamily: 'inherit', fontSize: 16 }}>Total</b><b>{fmt(t.total)}</b></div>
          <span style={{ fontSize: 12, color: '#6b7080', textAlign: 'right', marginTop: -8 }}>Includes VAT {t.vatPct}% · {fmt(t.vat)}</span>
          <button className="btn btn-blue" disabled={busy}>{busy ? 'Placing order…' : (online ? 'Pay & place order · ' : 'Place order · ') + fmt(t.total)}</button>
          <span style={{ fontSize: 12, color: '#5d6270', textAlign: 'center' }}>We will call you on your mobile number to confirm this order.</span>
        </aside>
      </form>
      {paying && (
        <div className="modal-bg">
          <div className="paybox">
            <div className="hero2" style={{ background: PAY_HERO[pay] || PAY_HERO.Card }}><span style={{ fontSize: 12, fontWeight: 700, opacity: .85 }}>Secure payment · demo</span><b>{pay === 'Card' ? gw : pay}</b></div>
            <div className="bd">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ color: '#56607a', fontSize: 14 }}>AR Trade International</span><b style={{ fontFamily: 'var(--disp)', fontSize: 26 }}>{fmt(t.total)}</b></div>
              <span style={{ fontSize: 12.5, color: '#6b7080', lineHeight: 1.5 }}>{pay === 'Card' ? `You would enter card details on the ${gw} secure page.` : `You would enter your ${pay} number, OTP and PIN on the ${pay} payment page.`} Demo only — no money is charged.</span>
              <button className="btn btn-dark btn-pill" style={{ padding: 14 }} onClick={() => finish(paying, true)} disabled={busy}>Pay {fmt(t.total)}</button>
              <button onClick={() => setPaying(null)} style={{ border: 0, background: 'transparent', color: '#56607a', fontSize: 13, fontWeight: 700 }}>Cancel and go back</button>
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
  useEffect(() => { window.scrollTo(0, 0); }, []);
  if (!o) {
    return <div className="success"><h1>Thank you!</h1><p>Your order <b>{id}</b> is placed. Use the Track order page with your mobile number to see its status.</p><Link className="btn btn-dark btn-pill" to="/track" style={{ padding: '14px 24px' }}>Track this order</Link></div>;
  }
  const back = o.items.filter(i => i.backorder > 0);
  const note = { border: '1px solid', borderRadius: 14, padding: '12px 16px', fontSize: 13.5, color: '#0b1631', maxWidth: 560 };
  return (
    <section className="success">
      <div style={{ display: 'flex' }}><span style={{ width: 44, height: 44, borderRadius: '50%', background: 'oklch(0.72 0.13 220)' }} /><span style={{ width: 44, height: 44, borderRadius: '50%', background: 'oklch(0.6 0.2 350)', marginLeft: -14 }} /><span style={{ width: 44, height: 44, borderRadius: '50%', background: 'oklch(0.82 0.13 85)', marginLeft: -14 }} /></div>
      <h1>Thank you! Order placed.</h1>
      <p style={{ margin: 0, color: '#3d424d', fontSize: 16, lineHeight: 1.6, maxWidth: 520 }}>Order <b>{o.id}</b> for <b>{fmt(o.total)}</b> is confirmed. We'll call {o.customer.phone} shortly to verify. Payment: {o.payment}.</p>
      {o.hold && <div style={{ ...note, background: 'oklch(0.97 0.02 250)', borderColor: 'oklch(0.86 0.05 250)' }}>⏸ {o.holdNote}. We'll call you to confirm before dispatch.</div>}
      {back.length > 0 && <div style={{ ...note, background: 'oklch(0.98 0.02 85)', borderColor: 'oklch(0.85 0.08 75)' }}>{(o.partial === 'together' ? 'We will ship everything together once these are restocked: ' : 'Shipping available items now. To follow: ') + back.map(i => `${i.backorder} × ${i.name.split(' (')[0]}`).join(', ')}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', fontSize: 13, color: '#56607a' }}><span className="info-pill">🚚 {o.slot || 'Standard delivery'}</span><span className="info-pill">{o.payStatus === 'Paid' ? '✓ Paid · ' + o.payment : 'Payment: ' + o.payment}</span></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn-pill" style={{ background: 'linear-gradient(135deg,oklch(0.6 0.14 240),oklch(0.46 0.16 256))', padding: '13px 20px' }} onClick={() => { if (!printInvoice(o, site)) say('Allow pop-ups to download the invoice'); }}>⤓ Invoice (PDF)</button>
        <button className="btn btn-ghost btn-pill" style={{ padding: '13px 20px' }} onClick={() => { if (o.customer.email) { setMailed(true); say('Invoice sent to ' + o.customer.email); } else say('Add an email at checkout to receive the invoice'); }}>{mailed ? '✓ Invoice emailed' : '✉ Email invoice'}</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link className="btn btn-dark btn-pill" style={{ padding: '14px 24px' }} to={`/track?id=${o.id}&phone=${encodeURIComponent(o.customer.phone)}`}>Track this order</Link>
        <Link className="btn btn-ghost btn-pill" style={{ padding: '14px 24px', borderColor: '#16181d' }} to="/shop/all">Continue shopping</Link>
      </div>
    </section>
  );
}
