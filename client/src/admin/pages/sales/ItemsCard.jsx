import { fmtMoney } from '../../adminApi.js';

export function ItemsCard({ o }) {
  return (
    <section className="od-card">
      <h4>Items <em>{o.items.reduce((t, i) => t + i.qty, 0)}</em></h4>
      <div className="od-items">
        {o.items.map(i => (
          <div key={i.id} className="od-item">
            <div className="a-thumb" style={{ backgroundImage: i.img ? `url('${i.img}')` : 'none' }} />
            <span className="od-nm">{i.name}{i.backorder > 0 && <b className="od-bo"> +{i.backorder} on back-order</b>}<small>{fmtMoney(i.price)} each</small></span>
            <i className="od-q">× {i.qty}</i>
            <b>{fmtMoney(i.price * i.qty)}</b>
          </div>
        ))}
      </div>
      <div className="od-sum">
        <div><span>Subtotal</span><span>{fmtMoney(o.subtotal)}</span></div>
        <div><span>Discount</span><span>− {fmtMoney(o.discount)}</span></div>
        <div><span>Delivery</span><span>{o.delivery ? fmtMoney(o.delivery) : 'Free'}</span></div>
        <div className="tot"><span>Total</span><span>{fmtMoney(o.total)}</span></div>
      </div>
    </section>
  );
}
