import { AREA } from './constants.js';

export function ContactCard({ o }) {
  return (
    <section className="od-card">
      <h4>Contact &amp; delivery</h4>
      <div className="od-rows">
        <div><span className="od-ic"><svg viewBox="0 0 24 24"><path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5 5l1.3-2 4 1.6V17a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg></span><div><small>Phone</small><a href={'tel:' + o.customer.phone}>{o.customer.phone}</a></div></div>
        {o.customer.email && <div><span className="od-ic"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg></span><div><small>Email</small><span>{o.customer.email}</span></div></div>}
        <div className="wide"><span className="od-ic"><svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg></span><div><small>Delivery address · {AREA[o.area]}</small><span>{o.address}</span></div></div>
        <div><span className="od-ic"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></svg></span><div><small>Payment</small><span><b>{o.payment}</b> · {o.payStatus}</span></div></div>
        {o.company && <div><span className="od-ic"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h2M14 8h2M8 12h2M14 12h2M10 21v-4h4v4" /></svg></span><div><small>Company</small><span>{o.company} · BIN {o.bin}</span></div></div>}
        {o.note && <div><span className="od-ic"><svg viewBox="0 0 24 24"><path d="M5 4h14v12H9l-4 4z" /></svg></span><div><small>Note</small><span>{o.note}</span></div></div>}
      </div>
    </section>
  );
}
