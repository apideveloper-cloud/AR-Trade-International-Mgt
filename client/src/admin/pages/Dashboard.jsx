import { useEffect, useState } from 'react';
import { adm, fmtMoney, STATUS_COLORS } from '../adminApi.js';
import { ColBars, Donut, ForecastChart, HBars, Spark } from '../charts.jsx';
import { ProductReport } from './ProductReport.jsx';
import '../dash.css';

const ICONS = {
  money: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.6.8 2.6 2-1.2 2-2.6 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8m0 8v1.5" /></>,
  cart: <><path d="M6 7h12l-1.2 9a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
  avg: <path d="M3 17l5-5 4 4 8-9M15 7h5v5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" /><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" /></>,
  alert: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5z" /><path d="M12 10v4.5" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /></>,
  repeat: <path d="M4 11V9a3 3 0 0 1 3-3h11l-3-3M20 13v2a3 3 0 0 1-3 3H6l3 3" />,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M9 12h6M12 9v6" /></>
};
const Delta = ({ v, suffix = 'vs previous 30 days' }) => (v == null ? <span className="dl flat">no earlier data</span> : <span className={'dl ' + (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')}>{v > 0 ? '▲' : v < 0 ? '▼' : '■'} {Math.abs(v)}% {suffix}</span>);

function Card({ title, sub, chip, children, cls = '' }) {
  return (
    <div className={'a-card db-card ' + cls}>
      <div className="card-hd"><div className="db-t"><h3>{title}</h3>{sub && <small>{sub}</small>}</div>{chip}</div>
      {children}
    </div>
  );
}

const PERIODS = [[7, 'Last 7 days'], [15, 'Last 15 days'], [30, 'Last 30 days'], [90, 'Last 3 months'], [180, 'Last 6 months'], [365, 'Last 12 months'], [1, 'Today']];

/** Dashboard that fits the signed-in person: only the figures, charts and advice their role may see. */
export function Dashboard({ go, staff }) {
  const asOf = new URLSearchParams(window.location.search).get('asOf');
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  const [range, setRange] = useState(() => { try { const v = Number(localStorage.getItem('dash_range')); return PERIODS.some(p => p[0] === v) ? v : 30; } catch { return 30; } });
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  useEffect(() => {
    let stale = false; // a slower, older answer must not overwrite the period picked last
    setBusy(true); setErr('');
    const qs = new URLSearchParams({ range });
    if (asOf) qs.set('asOf', asOf);
    adm.get('/overview?' + qs).then(r => { if (!stale) setO(r); }).catch(e => { if (!stale) setErr(e.message); }).finally(() => { if (!stale) setBusy(false); });
    return () => { stale = true; };
  }, [asOf, range]);
  const pick = v => { setRange(v); try { localStorage.setItem('dash_range', String(v)); } catch { /* storage unavailable */ } };
  if (err && !o) return <div className="a-msg err">{err}</div>;
  if (!o) return <span className="spin" />;

  const has = k => o.sections.includes(k);
  const s = o.sales, k = s?.kpis;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = (staff?.name || '').split(' ')[0];
  const noSales = s && s.series.every(x => x.v === 0);
  const N = s ? s.range : 30, lab = s ? s.label : '30 days';
  const perTxt = N === 1 ? 'today' : 'in the last ' + lab, prevTxt = N === 1 ? 'yesterday' : 'previous ' + lab, cap = N === 1 ? 'Today' : lab;
  const sparkN = Math.max(N, 14);
  const chartN = Math.min(90, Math.max(60, N)); // the daily chart stays readable: at most 90 days

  // ---- KPI cards: sales first, then what else this role works with (max 8) ----
  const cards = [];
  if (s) {
    cards.push({ t: 'Revenue · ' + cap, v: fmtMoney(k.rev30), sub: <Delta v={k.revDelta} suffix={'vs ' + prevTxt} />, tone: 'green', ic: 'money', spark: s.series.slice(-sparkN).map(x => x.v), hue: 155 });
    cards.push({ t: 'Orders · ' + cap, v: k.ord30, sub: <Delta v={k.ordDelta} suffix={'vs ' + prevTxt} />, tone: 'blue', ic: 'cart', spark: s.series.slice(-sparkN).map(x => x.n), hue: 250 });
    cards.push({ t: 'Average order', v: fmtMoney(k.avg), sub: <span className="dl flat">per order, {N === 1 ? 'today' : 'last ' + lab}</span>, tone: 'violet', ic: 'avg' });
    cards.push({ t: 'Today', v: fmtMoney(k.today), sub: <span className="dl flat">{k.todayN} order{k.todayN === 1 ? '' : 's'} · last 7 days {fmtMoney(k.rev7)}</span>, tone: 'amber', ic: 'clock' });
  }
  if (o.stock) cards.push({ t: 'Stock to watch', v: o.stock.out + o.stock.low, sub: <span className="dl flat">{o.stock.out} out · {o.stock.low} low (1 to 5)</span>, tone: o.stock.out ? 'red' : 'amber', ic: 'box' });
  if (o.customers) cards.push({ t: 'Repeat customers', v: o.customers.repeatRate + '%', sub: <span className="dl flat">{o.customers.repeat} of {o.customers.buyers} buyers ordered 2+ times</span>, tone: 'violet', ic: 'repeat' });
  if (o.finance && (has('sales') || !has('delivery'))) cards.push({ t: 'To collect', v: fmtMoney(o.finance.unpaidV), sub: <span className="dl flat">{o.finance.unpaidN} unpaid order{o.finance.unpaidN === 1 ? '' : 's'}{o.finance.unpaidOldN ? ` · ${o.finance.unpaidOldN} over 7 days` : ''}</span>, tone: o.finance.unpaidOldN ? 'red' : 'blue', ic: 'coin' });
  if (o.delivery) cards.push({ t: 'Open deliveries', v: o.delivery.open, sub: <span className="dl flat">{fmtMoney(o.delivery.codWith)} cash with riders</span>, tone: 'blue', ic: 'truck' });
  if (o.focus === 'stock' && o.stock) {
    const st = [
      { t: 'Out of stock', v: o.stock.out, sub: <span className="dl flat">live, priced, none left</span>, tone: 'red', ic: 'alert' },
      { t: 'Low stock', v: o.stock.low, sub: <span className="dl flat">1 to 5 left</span>, tone: 'amber', ic: 'box' },
      { t: 'Stock value', v: fmtMoney(o.stock.value), sub: <span className="dl flat">live products at selling price</span>, tone: 'violet', ic: 'coin' },
      { t: 'Without a photo', v: o.stock.noImg, sub: <span className="dl flat">live products to photograph</span>, tone: 'blue', ic: 'box' }
    ];
    cards.splice(0, cards.length, ...st, ...cards.filter(c => c.t !== 'Stock to watch'));
  }
  const kpis = cards.slice(0, 8);

  const statusParts = s ? Object.entries(s.status).map(([label, value]) => ({ label, value, color: (STATUS_COLORS[label] || ['', '#6b7388'])[1] })) : [];
  const orderTotal = statusParts.reduce((t, p) => t + p.value, 0);
  const flowRows = o.delivery ? Object.entries(o.delivery.flow).map(([label, value]) => ({ label, value, text: String(value) })) : [];
  const bestWd = s ? [...s.profile].sort((a, b) => b.v - a.v)[0] : null;
  const summary = s
    ? (noSales ? 'There were no orders in the last 60 days.' : `${k.ord30} order${k.ord30 === 1 ? '' : 's'} and ${fmtMoney(k.rev30)} ${perTxt}. Next 7 days look like about ${fmtMoney(s.fcTotal)}.`)
    : 'Here is what needs your attention.';

  const PAGE = { orders: 'Orders', products: 'Products', marketing: 'Marketing', settings: 'Settings', deliveries: 'Deliveries', dashboard: 'Dashboard', reviews: 'Reviews', services: 'Servicing', team: 'Team', inbox: 'Inbox', careers: 'Careers', customers: 'Customers' };
  const AREA = { orders: 'Sales', products: 'Stock', marketing: 'Marketing', settings: 'Store', deliveries: 'Delivery', dashboard: 'Finance', customers: 'Customers' };
  const TONE = { warn: 'Needs attention', tip: 'Idea', good: 'Good news' };
  const nWarn = o.insights.filter(i => i.tone === 'warn').length, nTip = o.insights.filter(i => i.tone === 'tip').length, nGood = o.insights.filter(i => i.tone === 'good').length;
  const guide = (
    <section className="sg">
      <header className="sg-hd">
        <span className="sg-spark">✨</span>
        <div><h3>Smart guide</h3><small>Written automatically from your orders, stock, customers and payments</small></div>
        <div className="sg-sum">
          {nWarn > 0 && <span className="s-warn"><b>{nWarn}</b> need attention</span>}
          {nTip > 0 && <span className="s-tip"><b>{nTip}</b> idea{nTip === 1 ? '' : 's'}</span>}
          {nGood > 0 && <span className="s-good"><b>{nGood}</b> good news</span>}
        </div>
      </header>
      <div className="sg-body">
        {!o.insights.length && <div className="sg-empty">🎉 Nothing needs attention right now. New suggestions appear as orders and stock change.</div>}
        <div className="sg-grid">
          {o.insights.map((i, n) => (
            <button type="button" key={n} className={'sg-t sg-' + i.tone} style={{ '--i': n }} onClick={() => go(i.page)} title={i.text}>
              <span className="sg-ic">{i.icon}</span>
              <div className="sg-main">
                <div className="sg-meta"><em>{TONE[i.tone]}</em>{AREA[i.page] && <span>{AREA[i.page]}</span>}</div>
                <b>{i.title}</b>
                <small>{i.text}</small>
                <span className="sg-go">Open {PAGE[i.page] || 'page'} <i>→</i></span>
              </div>
            </button>
          ))}
        </div>
        <p className="sg-note">How it works: figures come straight from the application's own transactions; the forecast is the average of each weekday over the last 8 weeks, adjusted by the recent trend. It is a guide, not a promise.</p>
      </div>
    </section>
  );

  const stockCard = o.stock && (
    <Card title="Stock cover" sub="How long the stock lasts at the current sales speed" chip={<span className="chip">{o.stock.risk.length} at risk</span>}>
      {!o.stock.risk.length && <div className="muted">No selling product is close to running out.</div>}
      {o.stock.risk.map(r => (
        <div key={r.id} className="sc">
          <span className="sc-img" style={{ backgroundImage: r.img ? `url('${r.img}')` : 'none' }} />
          <div className="sc-m"><b title={r.name}>{r.name}</b><small>{r.stock} left · {r.sold30} sold in 30 days</small></div>
          <span className={'sc-d ' + (r.stock <= 0 ? 'out' : r.days <= 7 ? 'hot' : 'warm')}>{r.stock <= 0 ? 'Out of stock' : r.days + ' day' + (r.days === 1 ? '' : 's')}</span>
        </div>
      ))}
      <div className="sc-foot"><span>{o.stock.live} live products</span><span>Stock value {fmtMoney(o.stock.value)}</span>{o.stock.noImg > 0 && <span>{o.stock.noImg} without a photo</span>}</div>
    </Card>
  );
  const forecastCard = s && (
    <Card title="Revenue and forecast" sub={`Last ${chartN} days, plus the next 7 days worked out from your own sales`}
      chip={<span className={'conf conf-' + s.confidence} title="How much past data the forecast is based on">Forecast confidence: {s.confidence}</span>}>
      <div className="fc-head">
        <div><small>Expected next 7 days</small><b>{fmtMoney(s.fcTotal)}</b><span>~{s.fcOrders} orders</span></div>
        <div><small>Last 7 days</small><b>{fmtMoney(k.rev7)}</b><Delta v={k.rev7Delta} suffix="vs the 7 days before" /></div>
        {bestWd && bestWd.v > 0 && <div><small>Best weekday</small><b>{bestWd.wd}</b><span>avg {fmtMoney(bestWd.v)}</span></div>}
      </div>
      <div style={{ position: 'relative' }}>
        <ForecastChart series={s.series.slice(-chartN)} forecast={s.forecast} />
        {noSales && <div className="ch-empty">No orders in this period. The forecast appears as soon as orders come in.</div>}
      </div>
    </Card>
  );
  const statusCard = s && (
    <Card title="Orders by status" sub="All orders" chip={<span className="chip">{orderTotal}</span>}>
      <Donut parts={statusParts} center={String(orderTotal)} sub="orders" />
    </Card>
  );
  const busyCard = s && (
    <Card title="Busy days of the week" sub="Average revenue per weekday, last 8 weeks">
      <ColBars rows={s.profile.map(p => ({ label: p.wd, value: p.v, hot: bestWd && p.wd === bestWd.wd && p.v > 0 }))} hue={250} />
    </Card>
  );
  const topCard = s && (
    <Card title="Top selling vs lowest selling" sub={'Products by units sold, ' + (N === 1 ? 'today' : 'last ' + lab)}>
      <div className="tvl">
        <section className="tvl-top">
          <h4><i>▲</i> Top selling</h4>
          {s.top.length ? <HBars rows={s.top.map(t => ({ label: t.name, value: t.q, text: t.q + ' sold', sub: fmtMoney(t.v), img: t.img, onClick: () => setReport(t.id) }))} hue={150} inline /> : <div className="muted">No sales {perTxt}.</div>}
        </section>
        <section className="tvl-low">
          <h4><i>▼</i> Lowest selling</h4>
          {s.low.length ? <HBars rows={s.low.map(t => ({ label: t.name, value: t.q, text: t.q ? t.q + ' sold' : 'not sold', sub: t.stock + ' in stock', img: t.img, onClick: () => setReport(t.id) }))} hue={25} inline /> : <div className="muted">No live products yet.</div>}
        </section>
      </div>
      {s.low.some(t => t.q === 0 && t.stock > 0) && <div className="sc-foot"><span>Unsold products with stock tied up are listed first. Consider a discount or a campaign for them.</span></div>}
    </Card>
  );
  const payCard = s && (
    <Card title="Payment methods" sub={'Share of revenue, ' + (N === 1 ? 'today' : 'last ' + lab)}>
      {s.pay.length ? <HBars rows={s.pay.map(p => ({ label: p.p, value: p.v, text: fmtMoney(p.v), sub: p.n + ' order' + (p.n === 1 ? '' : 's') }))} hue={150} inline /> : <div className="muted">No sales {perTxt}.</div>}
    </Card>
  );
  const deliveryCard = o.delivery && (
    <Card title="Delivery pipeline" sub="Open orders by step" chip={<span className="chip">{o.delivery.open} open</span>}>
      {flowRows.length ? <HBars rows={flowRows} hue={200} /> : <div className="muted">No open deliveries.</div>}
      <div className="sc-foot"><span>{fmtMoney(o.delivery.codWith)} cash with riders</span><span>{o.delivery.returnsPending} return request{o.delivery.returnsPending === 1 ? '' : 's'}</span></div>
    </Card>
  );
  const customersCard = o.customers && (
    <Card title="Customers" sub="New accounts per week, last 8 weeks" chip={<span className="chip">{o.customers.accounts} accounts</span>}>
      <ColBars rows={o.customers.newByWeek.map((v, i) => ({ label: i === 7 ? 'now' : '-' + (7 - i) + 'w', value: v }))} hue={300} />
      {o.customers.top.length > 0 && <div className="tc"><small>Top customers</small>{o.customers.top.slice(0, 3).map(c => <div key={c.name}><span>{c.name}</span><b>{fmtMoney(c.v)}</b></div>)}</div>}
    </Card>
  );
  const moneyCard = o.finance && (o.finance.expN > 0 || o.finance.unpaidN > 0) && (
    <Card title="Money to follow up" sub="Unpaid orders and expense claims">
      <div className="mf">
        <div><small>Unpaid orders</small><b>{fmtMoney(o.finance.unpaidV)}</b><span>{o.finance.unpaidN} order{o.finance.unpaidN === 1 ? '' : 's'}</span></div>
        <div className={o.finance.unpaidOldN ? 'bad' : ''}><small>Unpaid over 7 days</small><b>{fmtMoney(o.finance.unpaidOldV)}</b><span>{o.finance.unpaidOldN} order{o.finance.unpaidOldN === 1 ? '' : 's'}</span></div>
        {o.finance.expN > 0 && <div><small>Expense claims</small><b>{fmtMoney(o.finance.expV)}</b><span>{o.finance.expN} waiting</span></div>}
      </div>
    </Card>
  );

  // left column: the card this role cares about most, then charts; the Smart guide is the right-hand block and stays in view while scrolling
  const stockLead = o.focus === 'stock' && stockCard;
  const pair = s ? <div className="db-pair">{statusCard}{busyCard}</div> : null;
  const left = [stockLead || forecastCard, stockLead ? forecastCard : null, pair, topCard, payCard].filter(Boolean);
  const rest = [!stockLead ? stockCard : null, deliveryCard, customersCard, moneyCard].filter(Boolean);

  return (
    <>
      {err && <div className="a-msg err">{err}</div>}
      {report && <ProductReport id={report} range={range} asOf={asOf} onClose={() => setReport(null)} go={go} />}
      {asOf && <div className="a-msg" style={{ background: '#fff6e0', color: '#8a5a00' }}>Showing the picture as of {o.asOf}. <a href="/admin/dashboard" style={{ fontWeight: 800 }}>Back to today</a></div>}
      <section className="dash-hero compact">
        <div>
          <small>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {o.person.role}</small>
          <h2>{greet}{first ? ', ' + first : ''} 👋</h2>
          <p>{summary}</p>
        </div>
        <div className="qa">
          {o.todo.length === 0 && <span className="qa-ok">✓ Nothing is waiting for you right now</span>}
          {o.todo.map(t => <button key={t.label} type="button" className={'td td-' + t.tone} onClick={() => go(t.page)}><b>{t.n}</b> {t.label} <i>→</i></button>)}
        </div>
      </section>

      {s && (
        <div className={'pbar' + (busy ? ' busy' : '')} role="group" aria-label="Period">
          <span className="pb-l"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>Period</span>
          {PERIODS.map(([v, t]) => <button type="button" key={v} className={v === range ? 'on' : ''} aria-pressed={v === range} onClick={() => pick(v)}>{t}</button>)}
          <small title="Sales figures follow this period; the forecast always uses the last 8 weeks">{busy ? 'Updating…' : 'Forecast always uses the last 8 weeks'}</small>
        </div>
      )}
      <div className="kpis kp2" style={{ '--cols': kpis.length <= 4 ? kpis.length : kpis.length <= 6 ? 3 : 4 }}>
        {kpis.map(c => (
          <div className={'kpi tone-' + c.tone} key={c.t}>
            <span className="kic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[c.ic]}</svg></span>
            <small>{c.t}</small><b>{c.v}</b>{c.sub}
            {c.spark && <Spark values={c.spark} hue={c.hue} />}
          </div>
        ))}
      </div>

      <div className="db-main">
        <div className="db-lead">{left.map((x, i) => <div key={i}>{x}</div>)}</div>
        <aside className="db-guide2">{guide}</aside>
      </div>

      <div className="db-masonry">{rest.map((c, i) => <div key={i}>{c}</div>)}</div>
    </>
  );
}
