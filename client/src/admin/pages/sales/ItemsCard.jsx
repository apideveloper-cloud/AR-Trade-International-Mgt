import { fmtMoney } from '../../adminApi.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';

export function ItemsCard({ o }) {
  const tr = useT();
  return (
    <section className="od-card">
      <h4>{tr('Items')} <em>{o.items.reduce((t, i) => t + i.qty, 0)}</em></h4>
      <div className="od-items">
        {o.items.map(i => (
          <div key={i.id} className="od-item">
            <div className="a-thumb" style={{ backgroundImage: i.img ? `url('${i.img}')` : 'none' }} />
            <span className="od-nm">{i.name}{i.backorder > 0 && <b className="od-bo"> {tr('+{n} on back-order', { n: i.backorder })}</b>}<small>{tr('{price} each', { price: fmtMoney(i.price) })}</small></span>
            <i className="od-q">× {i.qty}</i>
            <b>{fmtMoney(i.price * i.qty)}</b>
          </div>
        ))}
      </div>
      <div className="od-sum">
        <div><span>{tr('Subtotal')}</span><span>{fmtMoney(o.subtotal)}</span></div>
        <div><span>{tr('Discount')}</span><span>− {fmtMoney(o.discount)}</span></div>
        <div><span>{tr('Delivery')}</span><span>{o.delivery ? fmtMoney(o.delivery) : tr('Free')}</span></div>
        <div className="tot"><span>{tr('Total')}</span><span>{fmtMoney(o.total)}</span></div>
      </div>
    </section>
  );
}
