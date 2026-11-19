// The "smart guide": plain-language lines generated from the numbers (pure). Every line says what it is based on.
import { money } from '../util.js';
import { WD_LONG } from './dates.js';

const ORDER = { warn: 0, tip: 1, good: 2 };

/** Lines about sales: forecast, revenue swing, best / worst weekday, single-product dependence, cancellations. */
function salesTips(tip, out, raw, f) {
  const s = out.sales;
  const { series, orders56, trend, fcTotal, fcOrders, confidence, rev30, revPrev30, prevTxt, perTxt, bestWd, slowWd, ord30 } = f;
  const days = series.filter(x => x.n > 0).length;
  if (orders56 === 0) {
    tip('warn', '📉', 'No orders in the last 8 weeks', 'The forecast cannot be built until orders come in. Check that the storefront, payment methods and the promo banner are switched on.', 'settings');
  } else {
    tip(trend >= 1.05 ? 'good' : trend <= 0.95 ? 'warn' : 'tip', '🔮', `Next 7 days: about ${money(fcTotal)} from ~${fcOrders} order${fcOrders === 1 ? '' : 's'}`,
      `Worked out from your last 8 weeks (${orders56} orders on ${days} days): the average of each weekday, ${trend >= 1.05 ? 'raised' : trend <= 0.95 ? 'lowered' : 'kept'} by the recent trend (${trend >= 1 ? '+' : ''}${Math.round((trend - 1) * 100)}%). Confidence: ${confidence}${confidence === 'low' ? ', because there are few orders, so treat it as a rough range' : ''}.`, 'orders');
  }
  if (s.kpis.revDelta !== null && revPrev30 > 0) {
    if (s.kpis.revDelta <= -15) tip('warn', '⚠️', `Revenue is down ${Math.abs(s.kpis.revDelta)}% compared with ${prevTxt}`, `${money(rev30)} against ${money(revPrev30)}. Look at the top products and stock below, and consider a campaign or coupon.`, 'marketing');
    else if (s.kpis.revDelta >= 15) tip('good', '🚀', `Revenue is up ${s.kpis.revDelta}% compared with ${prevTxt}`, `${money(rev30)} against ${money(revPrev30)}. Make sure the best sellers stay in stock.`, 'products');
  }
  if (bestWd[1] > 0 && slowWd[0] !== bestWd[0]) tip('tip', '📅', `${WD_LONG[bestWd[0]]} is your strongest day, ${WD_LONG[slowWd[0]]} the weakest`, `${WD_LONG[bestWd[0]]} averages ${money(bestWd[1])} against ${money(slowWd[1])} on ${WD_LONG[slowWd[0]]}. Schedule offers and email campaigns for the slow day, and have staff ready on the busy one.`, 'marketing');
  const top = (s.top || [])[0];
  if (top && rev30 > 0 && top.v / rev30 >= 0.4) tip('tip', '🎯', `One product brings ${Math.round(top.v / rev30 * 100)}% of the revenue`, `"${top.name}" is doing the heavy lifting. Keep it well stocked and promote similar products so sales do not depend on a single item.`, 'products');
  const cancelRate = ord30 + (raw.cancelled30 || 0) > 0 ? Math.round((raw.cancelled30 || 0) / (ord30 + (raw.cancelled30 || 0)) * 100) : 0;
  if (cancelRate >= 20 && (raw.cancelled30 || 0) >= 3) tip('warn', '🚫', `${cancelRate}% of orders ${perTxt} were cancelled`, 'Find the common reason (stock, delivery time, price) and fix it at the source. Check the order history of the cancelled orders.', 'orders');
}

/** Lines about stock: selling products out of stock, running out soon, missing photos. */
function stockTips(tip, out) {
  const soon = out.stock.risk.filter(r => r.days !== null && r.days <= 14 && r.stock > 0);
  const outSelling = out.stock.risk.filter(r => r.stock <= 0 && r.sold30 > 0);
  if (outSelling.length) tip('warn', '📦', `${outSelling.length} selling product(s) are out of stock`, `Customers were buying these in the last 30 days: ${outSelling.slice(0, 3).map(r => r.name).join(', ')}. Reorder first.`, 'products');
  if (soon.length) tip('warn', '⏳', `${soon.length} product${soon.length === 1 ? '' : 's'} will run out within 2 weeks`, `At the current sales speed: ${soon.slice(0, 3).map(r => `${r.name} (${r.days} day${r.days === 1 ? '' : 's'})`).join(', ')}${soon.length > 3 ? ' and more' : ''}. Reorder now so the shelf never goes empty.`, 'products');
  if (out.stock.noImg > 0) tip('tip', '🖼️', `${out.stock.noImg} live product${out.stock.noImg === 1 ? ' has' : 's have'} no photo`, 'Products with a photo get more clicks. Add pictures to the live ones first.', 'products');
}

/** Lines about money, delivery, customers and expenses. */
function opsTips(tip, out, raw, has) {
  if (out.finance && (has('orders.status') || has('hub.cash'))) {
    if (out.finance.unpaidOldN > 0) tip('warn', '💸', `${money(out.finance.unpaidOldV)} unpaid for more than 7 days`, `${out.finance.unpaidOldN} order${out.finance.unpaidOldN === 1 ? '' : 's'} not marked paid after a week. Call the customers or check whether the rider's cash was deposited.`, 'orders');
    if (raw.pendingOldOrders > 0 && has('orders.status')) tip('warn', '📞', `${raw.pendingOldOrders} order${raw.pendingOldOrders === 1 ? ' is' : 's are'} still pending after 24 hours`, 'Orders confirmed quickly are cancelled less. Call these customers today.', 'orders');
  }
  if (out.delivery) {
    if (out.delivery.codWith > 0 && has('hub.cash')) tip('tip', '💵', `${money(out.delivery.codWith)} cash is still with riders`, 'Ask the riders to hand it in and mark it deposited so the books match the cash drawer.', 'deliveries');
    if (out.delivery.returnsPending > 0) tip('warn', '↩️', `${out.delivery.returnsPending} return request${out.delivery.returnsPending === 1 ? '' : 's'} to decide`, 'Open the Delivery Hub and approve a refund, a replacement or reject with a reason.', 'deliveries');
  }
}

function customerTips(tip, out, f) {
  if (out.customers.buyers >= 10 && out.customers.repeatRate < 25) tip('tip', '🔁', `Only ${out.customers.repeatRate}% of customers ordered more than once`, 'Toner and ink are repeat purchases. Turn on the welcome series and send refill reminders to bring buyers back.', 'marketing');
  if (out.customers.newAccounts30 === 0 && out.customers.accounts > 0) tip('tip', '🌱', `No new customer accounts ${f.perTxt}`, 'Try the welcome coupon or a newsletter popup to attract sign-ups.', 'settings');
}

/** The smart-guide lines for this person, most urgent first, at most 8. `out` is the analysed dashboard so far. */
export function buildGuide(out, raw, has, f) {
  const g = [];
  const tip = (tone, icon, title, text, page) => g.push({ tone, icon, title, text, page });
  if (out.sales) salesTips(tip, out, raw, f);
  if (out.stock) stockTips(tip, out);
  opsTips(tip, out, raw, has);
  if (out.customers) customerTips(tip, out, f);
  if (out.finance && has('field.approve') && out.finance.expN > 0) tip('tip', '🧾', `${out.finance.expN} expense claim${out.finance.expN === 1 ? '' : 's'} (${money(out.finance.expV)}) waiting`, 'Approve or reject them in the mobile app so staff are reimbursed on time.', 'dashboard');
  return g.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]).slice(0, 8);
}
