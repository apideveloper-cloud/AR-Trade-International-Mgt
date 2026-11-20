import { useEffect, useState } from 'react';
import { adm, fmtMoney, STATUS_COLORS } from '../adminApi.js';
import { Modal } from '../ui.jsx';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/toplevel.js';
import '../i18n/dict/catalog.js';
import { locFor } from './dashboard/dashText.jsx';

function Delta({ v }) {
  const tr = useT();
  return v == null ? <span className="dl flat">{tr('no earlier data')}</span> : <span className={'dl ' + (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')}>{v > 0 ? '▲' : v < 0 ? '▼' : '■'} {tr('{n}% vs the period before', { n: Math.abs(v) })}</span>;
}

/** Daily units as plain bars: no library, every bar has a tooltip. */
function Bars({ series }) {
  const tr = useT();
  const max = Math.max(...series.map(x => x.q), 1), W = 600, H = 120, gap = series.length > 120 ? 0 : 1, bw = W / series.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="pr-chart" role="img" aria-label={tr('Units sold per day')}>
      {[0, .5, 1].map(f => <line key={f} x1="0" x2={W} y1={H - f * (H - 6)} y2={H - f * (H - 6)} stroke="#e8edf5" strokeWidth="1" />)}
      {series.map((x, i) => { const h = x.q ? Math.max(3, (x.q / max) * (H - 6)) : 0; return <rect key={x.d} x={i * bw + gap / 2} y={H - h} width={Math.max(1, bw - gap)} height={h} rx={bw > 6 ? 2 : 0} fill="oklch(0.6 0.16 250)"><title>{tr('{d}: {q} sold', { d: x.d, q: x.q })}</title></rect>; })}
      <text x="0" y={H + 14} fontSize="11" fill="#7a8399">{series[0].d.slice(5)}</text>
      <text x={W} y={H + 14} fontSize="11" fill="#7a8399" textAnchor="end">{series[series.length - 1].d.slice(5)}</text>
      <text x="4" y="12" fontSize="11" fill="#7a8399">{tr('max {n}/day', { n: max })}</text>
    </svg>
  );
}

/** Sales report for one product: opens from the dashboard's top / lowest selling lists. */
export function ProductReport({ id, range, asOf, onClose, go }) {
  const tr = useT();
  const L = locFor(tr);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stale = false;
    setD(null); setErr('');
    const qs = new URLSearchParams({ range });
    if (asOf) qs.set('asOf', asOf);
    adm.get(`/products/${id}/report?${qs}`).then(r => { if (!stale) setD(r); }).catch(e => { if (!stale) setErr(e.message); });
    return () => { stale = true; };
  }, [id, range, asOf]);

  const p = d?.product, t = d?.period;
  const when = d ? L.period(d.range === 1 ? 'today' : 'in the last ' + d.label) : '';
  const stockTone = p ? (p.stock <= 0 ? ['Out of stock', 'bad'] : p.stock <= 5 ? ['Low stock', 'warn'] : ['In stock', 'ok']) : null;
  let advice = null;
  if (d) {
    if (!t.units && p.stock > 0) advice = tr(p.stock === 1 ? 'Not sold {when}. {n} unit (about {money}) are tied up on the shelf: consider a discount, a bundle or a campaign.' : 'Not sold {when}. {n} units (about {money}) are tied up on the shelf: consider a discount, a bundle or a campaign.', { when, n: p.stock, money: fmtMoney(d.cover.tied) });
    else if (!t.units) advice = tr('Not sold {when}, and nothing is in stock.', { when });
    else if (p.stock <= 0) advice = tr('Selling, but out of stock. Reorder first.');
    else if (d.cover.days !== null && d.cover.days <= 14) advice = tr(d.cover.days === 1 ? 'At the speed of the last 30 days ({sold} sold) the stock lasts about {n} day. Reorder soon.' : 'At the speed of the last 30 days ({sold} sold) the stock lasts about {n} days. Reorder soon.', { sold: d.cover.sold30, n: d.cover.days });
    else if (d.cover.days !== null) advice = tr('Stock covers about {n} days at the speed of the last 30 days.', { n: d.cover.days });
  }

  return (
    <Modal side kicker={tr('Product report')} title={p ? p.name : tr('Loading…')} onClose={onClose}
      footer={<><button type="button" className="a-mini" onClick={() => go('products')}>{tr('Open Products')}</button><button type="button" className="a-mini" onClick={() => go('orders')}>{tr('Open Orders')}</button><button type="button" className="a-mini pri" onClick={onClose}>{tr('Close')}</button></>}>
      {err && <div className="a-msg err">{tr(err)}</div>}
      {!d && !err && <span className="spin" />}
      {d && (
        <div className="pr">
          <div className="pr-hero">
            <span className="pr-pic" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }}>{!p.img && tr('No photo')}</span>
            <div>
              <div className="pr-chips">{p.brand && <span>{p.brand}</span>}{p.cat && <span>{p.cat}</span>}{p.sku && <span>{tr('SKU {sku}', { sku: p.sku })}</span>}{!p.active && <span className="bad">{tr('Hidden from store')}</span>}</div>
              <div className="pr-price"><b>{fmtMoney(p.price)}</b>{p.oldPrice > p.price && <s>{fmtMoney(p.oldPrice)}</s>}<em className={'st-' + stockTone[1]}>{tr(stockTone[0])} · {p.stock}</em></div>
              <small className="pr-all">{tr(d.allTime.orders === 1 ? 'All time: {units} sold · {money} · {n} order' : 'All time: {units} sold · {money} · {n} orders', { units: d.allTime.units, money: fmtMoney(d.allTime.revenue), n: d.allTime.orders })}</small>
            </div>
          </div>

          <div className="pr-kpis">
            <div><small>{tr('Units sold')}</small><b>{t.units}</b><Delta v={t.unitsDelta} /></div>
            <div><small>{tr('Revenue')}</small><b>{fmtMoney(t.revenue)}</b><Delta v={t.revDelta} /></div>
            <div><small>{tr('Orders')}</small><b>{t.orders}</b><span className="dl flat">{tr('avg {money} per unit', { money: t.avgPrice ? fmtMoney(t.avgPrice) : '–' })}</span></div>
            <div><small>{tr('Rank')}</small><b>{d.rank.pos ? '#' + d.rank.pos : '–'}</b><span className="dl flat">{d.rank.pos ? tr('of {n} selling products', { n: d.rank.of }) : tr('no sales in this period')}</span></div>
          </div>

          {advice && <div className="pr-note">{advice}</div>}

          <div className="pr-card">
            <h4>{tr('Units sold per day')} <small>{d.series.length === 14 && d.range < 14 ? tr('last 14 days') : d.range === 1 ? tr('last 14 days') : L.period('last ' + d.label)}</small></h4>
            {d.series.some(x => x.q) ? <Bars series={d.series} /> : <div className="muted">{tr('No sales in this window.')}</div>}
          </div>

          <div className="pr-card">
            <h4>{tr('Latest orders')} <small>{tr('newest first')}</small></h4>
            {d.recent.length ? (
              <table className="pr-tbl"><thead><tr><th>{tr('Order')}</th><th>{tr('Date')}</th><th>{tr('Customer')}</th><th>{tr('Qty')}</th><th>{tr('Amount')}</th><th>{tr('Status')}</th></tr></thead>
                <tbody>{d.recent.map(r => <tr key={r.id}><td className="mono">{r.id}</td><td>{r.d}</td><td>{r.name}</td><td>{r.qty}</td><td>{fmtMoney(r.qty * r.price)}</td><td><span style={{ color: (STATUS_COLORS[r.status] || ['', '#6b7388'])[1], fontWeight: 700 }}>{tr(r.status)}</span>{r.pay === 'Paid' ? ' · ' + tr('Paid') : ''}</td></tr>)}</tbody></table>
            ) : <div className="muted">{tr('This product has not been ordered yet.')}</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}
