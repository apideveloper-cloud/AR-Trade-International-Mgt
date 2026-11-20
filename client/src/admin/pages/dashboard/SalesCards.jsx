import { fmtMoney, STATUS_COLORS } from '../../adminApi.js';
import { ColBars, Donut, ForecastChart, HBars } from '../../charts.jsx';
import { Card, Delta } from './parts.jsx';
import { useT } from '../../i18n/lang.jsx';
import { locFor } from './dashText.jsx';
import '../../i18n/dict/catalog.js';

/** Best weekday of the sales profile (or null). */
export const bestWeekday = s => (s ? [...s.profile].sort((a, b) => b.v - a.v)[0] : null);

/** Revenue history plus the 7-day forecast. */
export function ForecastCard({ s, p, bestWd, noSales }) {
  const tr = useT();
  const k = s.kpis;
  return (
    <Card title="Revenue and forecast" sub={tr('Last {n} days, plus the next 7 days worked out from your own sales', { n: p.chartN })}
      chip={<span className={'conf conf-' + s.confidence} title={tr('How much past data the forecast is based on')}>{tr('Forecast confidence: {level}', { level: tr(s.confidence) })}</span>}>
      <div className="fc-head">
        <div><small>{tr('Expected next 7 days')}</small><b>{fmtMoney(s.fcTotal)}</b><span>{tr('~{n} orders', { n: s.fcOrders })}</span></div>
        <div><small>{tr('Last 7 days')}</small><b>{fmtMoney(k.rev7)}</b><Delta v={k.rev7Delta} suffix="vs the 7 days before" /></div>
        {bestWd && bestWd.v > 0 && <div><small>{tr('Best weekday')}</small><b>{tr(bestWd.wd)}</b><span>{tr('avg {money}', { money: fmtMoney(bestWd.v) })}</span></div>}
      </div>
      <div className="fc-chart">
        <ForecastChart series={s.series.slice(-p.chartN)} forecast={s.forecast} />
        {noSales && <div className="ch-empty">{tr('No orders in this period. The forecast appears as soon as orders come in.')}</div>}
      </div>
    </Card>
  );
}

/** Donut of orders by status. */
export function StatusCard({ s }) {
  const tr = useT();
  const parts = Object.entries(s.status).map(([label, value]) => ({ label: tr(label), value, color: (STATUS_COLORS[label] || ['', '#6b7388'])[1] }));
  const total = parts.reduce((t, x) => t + x.value, 0);
  return (
    <Card title="Orders by status" sub="All orders" chip={<span className="chip">{total}</span>}>
      <Donut parts={parts} center={String(total)} sub={tr('orders')} />
    </Card>
  );
}

/** Average revenue per weekday. */
export function BusyDaysCard({ s, bestWd }) {
  const tr = useT();
  return (
    <Card title="Busy days of the week" sub="Average revenue per weekday, last 8 weeks">
      <ColBars rows={s.profile.map(x => ({ label: tr(x.wd), value: x.v, hot: bestWd && x.wd === bestWd.wd && x.v > 0 }))} hue={250} />
    </Card>
  );
}

/** Top selling vs lowest selling products; a click opens the product report. */
export function TopLowCard({ s, p, onProduct }) {
  const tr = useT();
  const L = locFor(tr);
  const none = <div className="muted">{tr('No sales {period}', { period: L.period(p.perTxt) })}</div>;
  return (
    <Card title="Top selling vs lowest selling" sub={p.N === 1 ? tr('Products by units sold, today') : tr('Products by units sold, last {period}', { period: L.lab(p.lab) })}>
      <div className="tvl">
        <section className="tvl-top">
          <h4><i>▲</i> {tr('Top selling')}</h4>
          {s.top.length ? <HBars rows={s.top.map(t => ({ label: t.name, value: t.q, text: tr('{n} sold', { n: t.q }), sub: fmtMoney(t.v), img: t.img, onClick: () => onProduct(t.id) }))} hue={150} inline /> : none}
        </section>
        <section className="tvl-low">
          <h4><i>▼</i> {tr('Lowest selling')}</h4>
          {s.low.length ? <HBars rows={s.low.map(t => ({ label: t.name, value: t.q, text: t.q ? tr('{n} sold', { n: t.q }) : tr('not sold'), sub: tr('{n} in stock', { n: t.stock }), img: t.img, onClick: () => onProduct(t.id) }))} hue={25} inline /> : <div className="muted">{tr('No live products yet.')}</div>}
        </section>
      </div>
      {s.low.some(t => t.q === 0 && t.stock > 0) && <div className="sc-foot"><span>{tr('Unsold products with stock tied up are listed first. Consider a discount or a campaign for them.')}</span></div>}
    </Card>
  );
}

/** Share of revenue per payment method. */
export function PaymentCard({ s, p }) {
  const tr = useT();
  const L = locFor(tr);
  return (
    <Card title="Payment methods" sub={p.N === 1 ? tr('Share of revenue, today') : tr('Share of revenue, last {period}', { period: L.lab(p.lab) })}>
      {s.pay.length ? <HBars rows={s.pay.map(x => ({ label: tr(x.p), value: x.v, text: fmtMoney(x.v), sub: L.pl(x.n, 'order') }))} hue={150} inline /> : <div className="muted">{tr('No sales {period}', { period: L.period(p.perTxt) })}</div>}
    </Card>
  );
}
