import ContactSection from './ContactSection.jsx';
import DeliverySection from './DeliverySection.jsx';
import PaymentSection from './PaymentSection.jsx';
import StockNotices from './StockNotices.jsx';
import SummaryAside from './SummaryAside.jsx';

/** The checkout form (contact, delivery, payment, marketing opt-in) with its summary. `c` is the checkout context (see CheckoutPage). */
export default function CheckoutForm({ c, formRef, onSubmit, onDraft, hidden }) {
  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={onDraft} onBlur={onDraft} className="cart-body" noValidate hidden={hidden}>
      <div className="ct-co-main">
        <ContactSection f={c.f} defaults={c.defaults} />
        <StockNotices t={c.t} partial={c.partial} setPartial={c.setPartial} />
        <DeliverySection c={c} />
        <PaymentSection c={c} />
        <div className="cardbox ct-pad18">
          <label className="ct-mkt-lbl">
            <input type="checkbox" name="mkt" value="1" className="ct-mkt-chk" defaultChecked={c.defaults.mkt} />
            <span>Keep me posted — email me deals, refill reminders &amp; new arrivals. <span className="ct-mkt-opt">Optional. We'll send a confirmation link first; unsubscribe anytime.</span></span>
          </label>
        </div>
      </div>
      <SummaryAside c={c} />
    </form>
  );
}
