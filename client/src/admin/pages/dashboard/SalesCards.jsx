import { fmtMoney, STATUS_COLORS } from '../../adminApi.js';
import { ColBars, Donut, ForecastChart, HBars } from '../../charts.jsx';
import { Card, Delta, plural } from './parts.jsx';

/** Best weekday of the sales profile (or null). */
export const bestWeekday = s => (s ? [...s.profile].sort((a, b) => b.v - a.v)[0] : null);

/** Revenue history plus the 7-day forecast. */
export function ForecastCard({ s, p, bestWd, noSales }) {
  const k = s.kpis;
  return (
    <Card title="Revenue and forecast" sub={`Last ${p.chartN} days, plus the next 7 days worked out from your own sales`}
      chip={<span className={'conf conf-' + s.confidence} title="How much past data the forecast is based on">Forecast confidence: {s.confidence}</span>}>
      <div className="fc-head">
        <div><small>Expected next 7 days</small><b>{fmtMoney(s.fcTotal)}</b><span>~{s.fcOrders} orders</span></div>
        <div><small>Last 7 days</small><b>{fmtMoney(k.rev7)}</b><Delta v={k.rev7Delta} suffix="vs the 7 days before" /></div>
        {bestWd && bestWd.v > 0 && <div><small>Best weekday</small><b>{bestWd.wd}</b><span>avg {fmtMoney(bestWd.v)}</span></div>}
      </div>
      <div className="fc-chart">
        <ForecastChart series={s.series.slice(-p.chartN)} forecast={s.forecast} />
        {noSales && <div className="ch-empty">No orders in this period. The forecast appears as soon as orders come in.</div>}
      </div>
    </Card>
  );
}

/** Donut of orders by status. */
export function StatusCard({ s }) {
  const parts = Object.entries(s.status).map(([label, value]) => ({ label, value, color: (STATUS_COLORS[label] || ['', '#6b7388'])[1] }));
  const total = parts.reduce((t, x) => t + x.value, 0);
  return (
    <Card title="Orders by status" sub="All orders" chip={<span className="chip">{total}</span>}>
      <Donut parts={parts} center={String(total)} sub="orders" />
    </Card>
  );
}

/** Average revenue per weekday. */
export function BusyDaysCard({ s, bestWd }) {
  return (
    <Card title="Busy days of the week" sub="Average revenue per weekday, last 8 weeks">
      <ColBars rows={s.profile.map(x => ({ label: x.wd, value: x.v, hot: bestWd && x.wd === bestWd.wd && x.v > 0 }))} hue={250} />
    </Card>
  );
}

/** Top selling vs lowest selling products; a click opens the product report. */
export function TopLowCard({ s, p, onProduct }) {
  return (
    <Card title="Top selling vs lowest selling" sub={'Products by units sold, ' + (p.N === 1 ? 'today' : 'last ' + p.lab)}>
      <div className="tvl">
        <section className="tvl-top">
          <h4><i>▲</i> Top selling</h4>
          {s.top.length ? <HBars rows={s.top.map(t => ({ label: t.name, value: t.q, text: t.q + ' sold', sub: fmtMoney(t.v), img: t.img, onClick: () => onProduct(t.id) }))} hue={150} inline /> : <div className="muted">No sales {p.perTxt}.</div>}
        </section>
        <section className="tvl-low">
          <h4><i>▼</i> Lowest selling</h4>
          {s.low.length ? <HBars rows={s.low.map(t => ({ label: t.name, value: t.q, text: t.q ? t.q + ' sold' : 'not sold', sub: t.stock + ' in stock', img: t.img, onClick: () => onProduct(t.id) }))} hue={25} inline /> : <div className="muted">No live products yet.</div>}
        </section>
      </div>
      {s.low.some(t => t.q === 0 && t.stock > 0) && <div className="sc-foot"><span>Unsold products with stock tied up are listed first. Consider a discount or a campaign for them.</span></div>}
    </Card>
  );
}

/** Share of revenue per payment method. */
export function PaymentCard({ s, p }) {
  return (
    <Card title="Payment methods" sub={'Share of revenue, ' + (p.N === 1 ? 'today' : 'last ' + p.lab)}>
      {s.pay.length ? <HBars rows={s.pay.map(x => ({ label: x.p, value: x.v, text: fmtMoney(x.v), sub: plural(x.n, 'order') }))} hue={150} inline /> : <div className="muted">No sales {p.perTxt}.</div>}
    </Card>
  );
}
