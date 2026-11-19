import { fmtMoney } from '../../adminApi.js';
import { ColBars, HBars } from '../../charts.jsx';
import { Card, plural } from './parts.jsx';

/** Products that are close to running out at the current sales speed. */
export function StockCard({ stock }) {
  return (
    <Card title="Stock cover" sub="How long the stock lasts at the current sales speed" chip={<span className="chip">{stock.risk.length} at risk</span>}>
      {!stock.risk.length && <div className="muted">No selling product is close to running out.</div>}
      {stock.risk.map(r => (
        <div key={r.id} className="sc">
          <span className="sc-img" style={{ backgroundImage: r.img ? `url('${r.img}')` : 'none' }} />
          <div className="sc-m"><b title={r.name}>{r.name}</b><small>{r.stock} left · {r.sold30} sold in 30 days</small></div>
          <span className={'sc-d ' + (r.stock <= 0 ? 'out' : r.days <= 7 ? 'hot' : 'warm')}>{r.stock <= 0 ? 'Out of stock' : plural(r.days, 'day')}</span>
        </div>
      ))}
      <div className="sc-foot"><span>{stock.live} live products</span><span>Stock value {fmtMoney(stock.value)}</span>{stock.noImg > 0 && <span>{stock.noImg} without a photo</span>}</div>
    </Card>
  );
}

/** Open deliveries by step. */
export function DeliveryCard({ delivery }) {
  const rows = Object.entries(delivery.flow).map(([label, value]) => ({ label, value, text: String(value) }));
  return (
    <Card title="Delivery pipeline" sub="Open orders by step" chip={<span className="chip">{delivery.open} open</span>}>
      {rows.length ? <HBars rows={rows} hue={200} /> : <div className="muted">No open deliveries.</div>}
      <div className="sc-foot"><span>{fmtMoney(delivery.codWith)} cash with riders</span><span>{plural(delivery.returnsPending, 'return request')}</span></div>
    </Card>
  );
}

/** New accounts per week and the top customers. */
export function CustomersCard({ customers }) {
  return (
    <Card title="Customers" sub="New accounts per week, last 8 weeks" chip={<span className="chip">{customers.accounts} accounts</span>}>
      <ColBars rows={customers.newByWeek.map((v, i) => ({ label: i === 7 ? 'now' : '-' + (7 - i) + 'w', value: v }))} hue={300} />
      {customers.top.length > 0 && <div className="tc"><small>Top customers</small>{customers.top.slice(0, 3).map(c => <div key={c.name}><span>{c.name}</span><b>{fmtMoney(c.v)}</b></div>)}</div>}
    </Card>
  );
}

/** Unpaid orders and waiting expense claims. */
export function MoneyCard({ finance: f }) {
  return (
    <Card title="Money to follow up" sub="Unpaid orders and expense claims">
      <div className="mf">
        <div><small>Unpaid orders</small><b>{fmtMoney(f.unpaidV)}</b><span>{plural(f.unpaidN, 'order')}</span></div>
        <div className={f.unpaidOldN ? 'bad' : ''}><small>Unpaid over 7 days</small><b>{fmtMoney(f.unpaidOldV)}</b><span>{plural(f.unpaidOldN, 'order')}</span></div>
        {f.expN > 0 && <div><small>Expense claims</small><b>{fmtMoney(f.expV)}</b><span>{f.expN} waiting</span></div>}
      </div>
    </Card>
  );
}
