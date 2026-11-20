import { fmtMoney } from '../../adminApi.js';
import { ColBars, HBars } from '../../charts.jsx';
import { Card } from './parts.jsx';
import { useT } from '../../i18n/lang.jsx';
import { locFor } from './dashText.jsx';
import '../../i18n/dict/catalog.js';

/** Products that are close to running out at the current sales speed. */
export function StockCard({ stock }) {
  const tr = useT();
  const L = locFor(tr);
  return (
    <Card title="Stock cover" sub="How long the stock lasts at the current sales speed" chip={<span className="chip">{tr('{n} at risk', { n: stock.risk.length })}</span>}>
      {!stock.risk.length && <div className="muted">{tr('No selling product is close to running out.')}</div>}
      {stock.risk.map(r => (
        <div key={r.id} className="sc">
          <span className="sc-img" style={{ backgroundImage: r.img ? `url('${r.img}')` : 'none' }} />
          <div className="sc-m"><b title={r.name}>{r.name}</b><small>{tr('{stock} left · {sold} sold in 30 days', { stock: r.stock, sold: r.sold30 })}</small></div>
          <span className={'sc-d ' + (r.stock <= 0 ? 'out' : r.days <= 7 ? 'hot' : 'warm')}>{r.stock <= 0 ? tr('Out of stock') : L.pl(r.days, 'day')}</span>
        </div>
      ))}
      <div className="sc-foot"><span>{tr('{n} live products', { n: stock.live })}</span><span>{tr('Stock value {money}', { money: fmtMoney(stock.value) })}</span>{stock.noImg > 0 && <span>{tr('{n} without a photo', { n: stock.noImg })}</span>}</div>
    </Card>
  );
}

/** Open deliveries by step. */
export function DeliveryCard({ delivery }) {
  const tr = useT();
  const L = locFor(tr);
  const rows = Object.entries(delivery.flow).map(([label, value]) => ({ label: tr(label), value, text: String(value) }));
  return (
    <Card title="Delivery pipeline" sub="Open orders by step" chip={<span className="chip">{tr('{n} open', { n: delivery.open })}</span>}>
      {rows.length ? <HBars rows={rows} hue={200} /> : <div className="muted">{tr('No open deliveries.')}</div>}
      <div className="sc-foot"><span>{tr('{money} cash with riders', { money: fmtMoney(delivery.codWith) })}</span><span>{L.pl(delivery.returnsPending, 'return request')}</span></div>
    </Card>
  );
}

/** New accounts per week and the top customers. */
export function CustomersCard({ customers }) {
  const tr = useT();
  return (
    <Card title="Customers" sub="New accounts per week, last 8 weeks" chip={<span className="chip">{tr('{n} accounts', { n: customers.accounts })}</span>}>
      <ColBars rows={customers.newByWeek.map((v, i) => ({ label: i === 7 ? tr('now') : tr('-{n}w', { n: 7 - i }), value: v }))} hue={300} />
      {customers.top.length > 0 && <div className="tc"><small>{tr('Top customers')}</small>{customers.top.slice(0, 3).map(c => <div key={c.name}><span>{c.name}</span><b>{fmtMoney(c.v)}</b></div>)}</div>}
    </Card>
  );
}

/** Unpaid orders and waiting expense claims. */
export function MoneyCard({ finance: f }) {
  const tr = useT();
  const L = locFor(tr);
  return (
    <Card title="Money to follow up" sub="Unpaid orders and expense claims">
      <div className="mf">
        <div><small>{tr('Unpaid orders')}</small><b>{fmtMoney(f.unpaidV)}</b><span>{L.pl(f.unpaidN, 'order')}</span></div>
        <div className={f.unpaidOldN ? 'bad' : ''}><small>{tr('Unpaid over 7 days')}</small><b>{fmtMoney(f.unpaidOldV)}</b><span>{L.pl(f.unpaidOldN, 'order')}</span></div>
        {f.expN > 0 && <div><small>{tr('Expense claims')}</small><b>{fmtMoney(f.expV)}</b><span>{tr('{n} waiting', { n: f.expN })}</span></div>}
      </div>
    </Card>
  );
}
