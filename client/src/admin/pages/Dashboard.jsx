import { useState } from 'react';
import { fmtMoney } from '../adminApi.js';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/toplevel.js';
import '../i18n/dict/catalog.js';
import { locFor } from './dashboard/dashText.jsx';
import { ProductReport } from './ProductReport.jsx';
import { useOverview } from './dashboard/useOverview.js';
import { buildKpis, periodText } from './dashboard/buildKpis.jsx';
import { DashHero, PeriodBar } from './dashboard/Header.jsx';
import { KpiGrid } from './dashboard/KpiGrid.jsx';
import { SmartGuide } from './dashboard/SmartGuide.jsx';
import { BusyDaysCard, ForecastCard, PaymentCard, StatusCard, TopLowCard, bestWeekday } from './dashboard/SalesCards.jsx';
import { CustomersCard, DeliveryCard, MoneyCard, StockCard } from './dashboard/OpsCards.jsx';
import '../dash.css';
import './dashboard/dashboard.css';

/** Dashboard that fits the signed-in person: only the figures, charts and advice their role may see. */
export function Dashboard({ go, staff }) {
  const tr = useT();
  const asOf = new URLSearchParams(window.location.search).get('asOf');
  const { o, err, range, busy, pick } = useOverview(asOf);
  const [report, setReport] = useState(null);
  if (err && !o) return <div className="a-msg err">{tr(err)}</div>;
  if (!o) return <span className="spin" />;

  const s = o.sales, k = s?.kpis;
  const p = periodText(s);
  const noSales = s && s.series.every(x => x.v === 0);
  const bestWd = bestWeekday(s);
  const first = (staff?.name || '').split(' ')[0];
  const summary = s
    ? (noSales ? tr('There were no orders in the last 60 days.') : tr(k.ord30 === 1 ? '{n} order and {money} {period}. Next 7 days look like about {next}.' : '{n} orders and {money} {period}. Next 7 days look like about {next}.', { n: k.ord30, money: fmtMoney(k.rev30), period: locFor(tr).period(p.perTxt), next: fmtMoney(s.fcTotal) }))
    : tr('Here is what needs your attention.');

  // left column: the card this role cares about most, then charts; the Smart guide is the right-hand block and stays in view while scrolling
  const stockCard = o.stock && <StockCard stock={o.stock} />;
  const forecastCard = s && <ForecastCard s={s} p={p} bestWd={bestWd} noSales={noSales} />;
  const stockLead = o.focus === 'stock' && stockCard;
  const pair = s ? <div className="db-pair"><StatusCard s={s} /><BusyDaysCard s={s} bestWd={bestWd} /></div> : null;
  const left = [stockLead || forecastCard, stockLead ? forecastCard : null, pair, s && <TopLowCard s={s} p={p} onProduct={setReport} />, s && <PaymentCard s={s} p={p} />].filter(Boolean);
  const rest = [!stockLead ? stockCard : null, o.delivery && <DeliveryCard delivery={o.delivery} />, o.customers && <CustomersCard customers={o.customers} />, o.finance && (o.finance.expN > 0 || o.finance.unpaidN > 0) && <MoneyCard finance={o.finance} />].filter(Boolean);

  return (
    <>
      {err && <div className="a-msg err">{tr(err)}</div>}
      {report && <ProductReport id={report} range={range} asOf={asOf} onClose={() => setReport(null)} go={go} />}
      {asOf && <div className="a-msg dash-asof">{tr('Showing the picture as of {date}.', { date: o.asOf })} <a href="/admin/dashboard">{tr('Back to today')}</a></div>}
      <DashHero o={o} first={first} summary={summary} go={go} />
      {s && <PeriodBar range={range} busy={busy} onPick={pick} />}
      <KpiGrid kpis={buildKpis(o, p)} />
      <div className="db-main">
        <div className="db-lead">{left.map((x, i) => <div key={i}>{x}</div>)}</div>
        <aside className="db-guide2"><SmartGuide insights={o.insights} go={go} /></aside>
      </div>
      <div className="db-masonry">{rest.map((c, i) => <div key={i}>{c}</div>)}</div>
    </>
  );
}
