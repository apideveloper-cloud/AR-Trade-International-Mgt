import { useEffect, useState } from 'react';
import { adm, fmtMoney, STATUS_COLORS } from '../adminApi.js';
import { Modal } from '../ui.jsx';

const Delta = ({ v }) => (v == null ? <span className="dl flat">no earlier data</span> : <span className={'dl ' + (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')}>{v > 0 ? '▲' : v < 0 ? '▼' : '■'} {Math.abs(v)}% vs the period before</span>);

/** Daily units as plain bars: no library, every bar has a tooltip. */
function Bars({ series }) {
  const max = Math.max(...series.map(x => x.q), 1), W = 600, H = 120, gap = series.length > 120 ? 0 : 1, bw = W / series.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="pr-chart" role="img" aria-label="Units sold per day">
      {[0, .5, 1].map(f => <line key={f} x1="0" x2={W} y1={H - f * (H - 6)} y2={H - f * (H - 6)} stroke="#e8edf5" strokeWidth="1" />)}
      {series.map((x, i) => { const h = x.q ? Math.max(3, (x.q / max) * (H - 6)) : 0; return <rect key={x.d} x={i * bw + gap / 2} y={H - h} width={Math.max(1, bw - gap)} height={h} rx={bw > 6 ? 2 : 0} fill="oklch(0.6 0.16 250)"><title>{x.d}: {x.q} sold</title></rect>; })}
      <text x="0" y={H + 14} fontSize="11" fill="#7a8399">{series[0].d.slice(5)}</text>
      <text x={W} y={H + 14} fontSize="11" fill="#7a8399" textAnchor="end">{series[series.length - 1].d.slice(5)}</text>
      <text x="4" y="12" fontSize="11" fill="#7a8399">max {max}/day</text>
    </svg>
  );
}

/** Sales report for one product: opens from the dashboard's top / lowest selling lists. */
export function ProductReport({ id, range, asOf, onClose, go }) {
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
  const when = d ? (d.range === 1 ? 'today' : 'in the last ' + d.label) : '';
  const stockTone = p ? (p.stock <= 0 ? ['Out of stock', 'bad'] : p.stock <= 5 ? ['Low stock', 'warn'] : ['In stock', 'ok']) : null;
  let advice = null;
  if (d) {
    if (!t.units && p.stock > 0) advice = `Not sold ${when}. ${p.stock} unit${p.stock === 1 ? '' : 's'} (about ${fmtMoney(d.cover.tied)}) are tied up on the shelf: consider a discount, a bundle or a campaign.`;
    else if (!t.units) advice = `Not sold ${when}, and nothing is in stock.`;
    else if (p.stock <= 0) advice = 'Selling, but out of stock. Reorder first.';
    else if (d.cover.days !== null && d.cover.days <= 14) advice = `At the speed of the last 30 days (${d.cover.sold30} sold) the stock lasts about ${d.cover.days} day${d.cover.days === 1 ? '' : 's'}. Reorder soon.`;
    else if (d.cover.days !== null) advice = `Stock covers about ${d.cover.days} days at the speed of the last 30 days.`;
  }

  return (
    <Modal side kicker="Product report" title={p ? p.name : 'Loading…'} onClose={onClose}
      footer={<><button type="button" className="a-mini" onClick={() => go('products')}>Open Products</button><button type="button" className="a-mini" onClick={() => go('orders')}>Open Orders</button><button type="button" className="a-mini pri" onClick={onClose}>Close</button></>}>
      {err && <div className="a-msg err">{err}</div>}
      {!d && !err && <span className="spin" />}
      {d && (
        <div className="pr">
          <div className="pr-hero">
            <span className="pr-pic" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }}>{!p.img && 'No photo'}</span>
            <div>
              <div className="pr-chips">{p.brand && <span>{p.brand}</span>}{p.cat && <span>{p.cat}</span>}{p.sku && <span>SKU {p.sku}</span>}{!p.active && <span className="bad">Hidden from store</span>}</div>
              <div className="pr-price"><b>{fmtMoney(p.price)}</b>{p.oldPrice > p.price && <s>{fmtMoney(p.oldPrice)}</s>}<em className={'st-' + stockTone[1]}>{stockTone[0]} · {p.stock}</em></div>
              <small className="pr-all">All time: {d.allTime.units} sold · {fmtMoney(d.allTime.revenue)} · {d.allTime.orders} order{d.allTime.orders === 1 ? '' : 's'}</small>
            </div>
          </div>

          <div className="pr-kpis">
            <div><small>Units sold</small><b>{t.units}</b><Delta v={t.unitsDelta} /></div>
            <div><small>Revenue</small><b>{fmtMoney(t.revenue)}</b><Delta v={t.revDelta} /></div>
            <div><small>Orders</small><b>{t.orders}</b><span className="dl flat">avg {t.avgPrice ? fmtMoney(t.avgPrice) : '–'} per unit</span></div>
            <div><small>Rank</small><b>{d.rank.pos ? '#' + d.rank.pos : '–'}</b><span className="dl flat">{d.rank.pos ? `of ${d.rank.of} selling products` : 'no sales in this period'}</span></div>
          </div>

          {advice && <div className="pr-note">{advice}</div>}

          <div className="pr-card">
            <h4>Units sold per day <small>{d.series.length === 14 && d.range < 14 ? 'last 14 days' : d.range === 1 ? 'last 14 days' : 'last ' + d.label}</small></h4>
            {d.series.some(x => x.q) ? <Bars series={d.series} /> : <div className="muted">No sales in this window.</div>}
          </div>

          <div className="pr-card">
            <h4>Latest orders <small>newest first</small></h4>
            {d.recent.length ? (
              <table className="pr-tbl"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Qty</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>{d.recent.map(r => <tr key={r.id}><td className="mono">{r.id}</td><td>{r.d}</td><td>{r.name}</td><td>{r.qty}</td><td>{fmtMoney(r.qty * r.price)}</td><td><span style={{ color: (STATUS_COLORS[r.status] || ['', '#6b7388'])[1], fontWeight: 700 }}>{r.status}</span>{r.pay === 'Paid' ? ' · Paid' : ''}</td></tr>)}</tbody></table>
            ) : <div className="muted">This product has not been ordered yet.</div>}
          </div>
        </div>
      )}
    </Modal>
  );
}
