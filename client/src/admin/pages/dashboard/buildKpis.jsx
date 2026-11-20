import { fmtMoney } from '../../adminApi.js';
import { Delta, Flat } from './parts.jsx';
import { Tx } from './dashText.jsx';
import '../../i18n/dict/catalog.js';

// The tiles keep English text (title keys, and Tx pieces that translate themselves when drawn), so the Dashboard page needs no changes.

/** The KPI tiles: sales first, then what else this role works with, at most 8. `p` carries the period wording from periodText(). */
export function buildKpis(o, p) {
  const s = o.sales, k = s?.kpis;
  const has = key => o.sections.includes(key);
  const cards = [];
  if (s) {
    cards.push({ t: 'Revenue · ' + p.cap, v: fmtMoney(k.rev30), sub: <Delta v={k.revDelta} suffix={'vs ' + p.prevTxt} />, tone: 'green', ic: 'money', spark: s.series.slice(-p.sparkN).map(x => x.v), hue: 155 });
    cards.push({ t: 'Orders · ' + p.cap, v: k.ord30, sub: <Delta v={k.ordDelta} suffix={'vs ' + p.prevTxt} />, tone: 'blue', ic: 'cart', spark: s.series.slice(-p.sparkN).map(x => x.n), hue: 250 });
    cards.push({ t: 'Average order', v: fmtMoney(k.avg), sub: <Flat><Tx f={(tr, L) => (p.N === 1 ? tr('per order, today') : tr('per order, last {period}', { period: L.lab(p.lab) }))} /></Flat>, tone: 'violet', ic: 'avg' });
    cards.push({ t: 'Today', v: fmtMoney(k.today), sub: <Flat><Tx f={(tr, L) => tr('{orders} · last 7 days {money}', { orders: L.pl(k.todayN, 'order'), money: fmtMoney(k.rev7) })} /></Flat>, tone: 'amber', ic: 'clock' });
  }
  if (o.stock) cards.push({ t: 'Stock to watch', v: o.stock.out + o.stock.low, sub: <Flat><Tx f={tr => tr('{out} out · {low} low (1 to 5)', { out: o.stock.out, low: o.stock.low })} /></Flat>, tone: o.stock.out ? 'red' : 'amber', ic: 'box' });
  if (o.customers) cards.push({ t: 'Repeat customers', v: o.customers.repeatRate + '%', sub: <Flat><Tx f={tr => tr('{n} of {total} buyers ordered 2+ times', { n: o.customers.repeat, total: o.customers.buyers })} /></Flat>, tone: 'violet', ic: 'repeat' });
  if (o.finance && (has('sales') || !has('delivery'))) cards.push({ t: 'To collect', v: fmtMoney(o.finance.unpaidV), sub: <Flat><Tx f={(tr, L) => L.pl(o.finance.unpaidN, 'unpaid order') + (o.finance.unpaidOldN ? ' · ' + tr('{n} over 7 days', { n: o.finance.unpaidOldN }) : '')} /></Flat>, tone: o.finance.unpaidOldN ? 'red' : 'blue', ic: 'coin' });
  if (o.delivery) cards.push({ t: 'Open deliveries', v: o.delivery.open, sub: <Flat><Tx f={tr => tr('{money} cash with riders', { money: fmtMoney(o.delivery.codWith) })} /></Flat>, tone: 'blue', ic: 'truck' });
  if (o.focus === 'stock' && o.stock) {
    const st = [
      { t: 'Out of stock', v: o.stock.out, sub: <Flat><Tx f={tr => tr('live, priced, none left')} /></Flat>, tone: 'red', ic: 'alert' },
      { t: 'Low stock', v: o.stock.low, sub: <Flat><Tx f={tr => tr('1 to 5 left')} /></Flat>, tone: 'amber', ic: 'box' },
      { t: 'Stock value', v: fmtMoney(o.stock.value), sub: <Flat><Tx f={tr => tr('live products at selling price')} /></Flat>, tone: 'violet', ic: 'coin' },
      { t: 'Without a photo', v: o.stock.noImg, sub: <Flat><Tx f={tr => tr('live products to photograph')} /></Flat>, tone: 'blue', ic: 'box' }
    ];
    cards.splice(0, cards.length, ...st, ...cards.filter(c => c.t !== 'Stock to watch'));
  }
  return cards.slice(0, 8);
}

/** The wording that depends on the picked period (sales.range days, sales.label text). English text: the dashboard components translate it when drawn. */
export function periodText(s) {
  const N = s ? s.range : 30, lab = s ? s.label : '30 days';
  return { N, lab, perTxt: N === 1 ? 'today' : 'in the last ' + lab, prevTxt: N === 1 ? 'yesterday' : 'previous ' + lab, cap: N === 1 ? 'Today' : lab, sparkN: Math.max(N, 14), chartN: Math.min(90, Math.max(60, N)) };
}
