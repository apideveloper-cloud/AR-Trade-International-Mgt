import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';

// Dashboard wording that the server or the period picker builds as English text (for example "in the last 30 days"): it is turned into
// Bangla at display time. With English chosen every function returns the text unchanged.

/** "30 days" / "3 months" / "day" -> translated period name. */
const lab = tr => x => {
  const s = String(x);
  let m;
  if ((m = s.match(/^(\d+) days$/))) return tr('{n} days', { n: m[1] });
  if ((m = s.match(/^(\d+) months$/))) return tr('{n} months', { n: m[1] });
  return tr(s);
};

/** Period sentences: today, yesterday, "in the last X", "previous X", "vs previous X", "last X". */
const period = tr => {
  const l = lab(tr);
  return s => {
    const x = String(s);
    let m;
    if ((m = x.match(/^in the last (.+)$/))) return tr('in the last {period}', { period: l(m[1]) });
    if ((m = x.match(/^the previous (.+)$/))) return tr('the previous {period}', { period: l(m[1]) });
    if ((m = x.match(/^previous (.+)$/))) return tr('previous {period}', { period: l(m[1]) });
    if ((m = x.match(/^vs previous (.+)$/))) return tr('vs previous {period}', { period: l(m[1]) });
    if ((m = x.match(/^vs the previous (.+)$/))) return tr('vs the previous {period}', { period: l(m[1]) });
    if ((m = x.match(/^last (.+)$/))) return tr('last {period}', { period: l(m[1]) });
    return l(x);
  };
};

const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** [regex, key, builder of the placeholder values from the match]. The key is the English sentence with {placeholders}. */
const GUIDE = [
  [/^Next 7 days: about (.+) from ~(\d+) order$/, 'Next 7 days: about {money} from ~{n} order', m => ({ money: m[1], n: m[2] })],
  [/^Next 7 days: about (.+) from ~(\d+) orders$/, 'Next 7 days: about {money} from ~{n} orders', m => ({ money: m[1], n: m[2] })],
  [/^Revenue is down (\d+)% compared with (.+)$/, 'Revenue is down {n}% compared with {period}', (m, L) => ({ n: m[1], period: L.period(m[2]) })],
  [/^Revenue is up (\d+)% compared with (.+)$/, 'Revenue is up {n}% compared with {period}', (m, L) => ({ n: m[1], period: L.period(m[2]) })],
  [/^(\w+day) is your strongest day, (\w+day) the weakest$/, '{best} is your strongest day, {worst} the weakest', (m, L) => ({ best: L.wd(m[1]), worst: L.wd(m[2]) })],
  [/^One product brings (\d+)% of the revenue$/, 'One product brings {n}% of the revenue', m => ({ n: m[1] })],
  [/^(\d+)% of orders (.+) were cancelled$/, '{n}% of orders {period} were cancelled', (m, L) => ({ n: m[1], period: L.period(m[2]) })],
  [/^(\d+) selling product\(s\) are out of stock$/, '{n} selling product(s) are out of stock', m => ({ n: m[1] })],
  [/^(\d+) product will run out within 2 weeks$/, '{n} product will run out within 2 weeks', m => ({ n: m[1] })],
  [/^(\d+) products will run out within 2 weeks$/, '{n} products will run out within 2 weeks', m => ({ n: m[1] })],
  [/^(\d+) live product has no photo$/, '{n} live product has no photo', m => ({ n: m[1] })],
  [/^(\d+) live products have no photo$/, '{n} live products have no photo', m => ({ n: m[1] })],
  [/^(.+) unpaid for more than 7 days$/, '{money} unpaid for more than 7 days', m => ({ money: m[1] })],
  [/^(\d+) order is still pending after 24 hours$/, '{n} order is still pending after 24 hours', m => ({ n: m[1] })],
  [/^(\d+) orders are still pending after 24 hours$/, '{n} orders are still pending after 24 hours', m => ({ n: m[1] })],
  [/^(.+) cash is still with riders$/, '{money} cash is still with riders', m => ({ money: m[1] })],
  [/^(\d+) return request to decide$/, '{n} return request to decide', m => ({ n: m[1] })],
  [/^(\d+) return requests to decide$/, '{n} return requests to decide', m => ({ n: m[1] })],
  [/^Only (\d+)% of customers ordered more than once$/, 'Only {n}% of customers ordered more than once', m => ({ n: m[1] })],
  [/^No new customer accounts (.+)$/, 'No new customer accounts {period}', (m, L) => ({ period: L.period(m[1]) })],
  [/^(\d+) expense claim \((.+)\) waiting$/, '{n} expense claim ({money}) waiting', m => ({ n: m[1], money: m[2] })],
  [/^(\d+) expense claims \((.+)\) waiting$/, '{n} expense claims ({money}) waiting', m => ({ n: m[1], money: m[2] })],
  // the explanation lines
  [/^Worked out from your last 8 weeks \((\d+) orders on (\d+) days\): the average of each weekday, (raised|lowered|kept) by the recent trend \(([+-]?\d+)%\)\. Confidence: (\w+)\.$/,
    'Worked out from your last 8 weeks ({orders} orders on {days} days): the average of each weekday, {dir} by the recent trend ({trend}%). Confidence: {level}.',
    (m, L, tr) => ({ orders: m[1], days: m[2], dir: tr(m[3]), trend: m[4], level: tr(m[5]) })],
  [/^Worked out from your last 8 weeks \((\d+) orders on (\d+) days\): the average of each weekday, (raised|lowered|kept) by the recent trend \(([+-]?\d+)%\)\. Confidence: (\w+), because there are few orders, so treat it as a rough range\.$/,
    'Worked out from your last 8 weeks ({orders} orders on {days} days): the average of each weekday, {dir} by the recent trend ({trend}%). Confidence: {level}, because there are few orders, so treat it as a rough range.',
    (m, L, tr) => ({ orders: m[1], days: m[2], dir: tr(m[3]), trend: m[4], level: tr(m[5]) })],
  [/^(.+) against (.+)\. Look at the top products and stock below, and consider a campaign or coupon\.$/, '{a} against {b}. Look at the top products and stock below, and consider a campaign or coupon.', m => ({ a: m[1], b: m[2] })],
  [/^(.+) against (.+)\. Make sure the best sellers stay in stock\.$/, '{a} against {b}. Make sure the best sellers stay in stock.', m => ({ a: m[1], b: m[2] })],
  [/^(\w+day) averages (.+) against (.+) on (\w+day)\. Schedule offers and email campaigns for the slow day, and have staff ready on the busy one\.$/,
    '{best} averages {a} against {b} on {worst}. Schedule offers and email campaigns for the slow day, and have staff ready on the busy one.', (m, L) => ({ best: L.wd(m[1]), a: m[2], b: m[3], worst: L.wd(m[4]) })],
  [/^"(.+)" is doing the heavy lifting\. Keep it well stocked and promote similar products so sales do not depend on a single item\.$/, '"{name}" is doing the heavy lifting. Keep it well stocked and promote similar products so sales do not depend on a single item.', m => ({ name: m[1] })],
  [/^Customers were buying these in the last 30 days: (.+)\. Reorder first\.$/, 'Customers were buying these in the last 30 days: {names}. Reorder first.', m => ({ names: m[1] })],
  [/^At the current sales speed: (.+)\. Reorder now so the shelf never goes empty\.$/, 'At the current sales speed: {names}. Reorder now so the shelf never goes empty.', (m, L, tr) => ({ names: m[1].replace(/ \((\d+) days?\)/g, (a, n) => ' (' + tr(n === '1' ? '{n} day' : '{n} days', { n }) + ')') })],
  [/^(\d+) orders? not marked paid after a week\. Call the customers or check whether the rider's cash was deposited\.$/, '{n} orders not marked paid after a week. Call the customers or check whether the rider\'s cash was deposited.', m => ({ n: m[1] })]
];

/** Translates one smart-guide sentence: the plain dictionary first, then the sentence patterns with numbers and names. */
const guide = (tr, L) => s => {
  const x = String(s ?? '');
  const direct = tr(x);
  if (direct !== x) return direct;
  for (const [re, key, vars] of GUIDE) {
    const m = x.match(re);
    if (m) return tr(key, vars(m, L, tr));
  }
  return x;
};

/** The translator helpers for the dashboard: const L = locFor(tr). */
export function locFor(tr) {
  const L = { lab: lab(tr), period: period(tr), wd: w => { const i = WDL.indexOf(w); return i < 0 ? tr(w) : tr(w); } };
  L.guide = guide(tr, L);
  /** KPI tile titles: "Revenue · Today" / "Orders · 30 days" and the plain ones. */
  L.title = s => {
    const m = String(s).match(/^(Revenue|Orders) · (.+)$/);
    return m ? tr(m[1] + ' · {period}', { period: m[2] === 'Today' ? tr('Today') : L.lab(m[2]) }) : tr(s);
  };
  /** "1 order" / "3 orders" (the two keys are '{n} order' and '{n} orders'). */
  L.pl = (n, word) => tr(`{n} ${word}${n === 1 ? '' : 's'}`, { n });
  return L;
}

/** Text built at render time: <Tx f={(tr, L) => tr('...', { n })} /> keeps buildKpis free of hooks. */
export function Tx({ f }) {
  const tr = useT();
  return f(tr, locFor(tr));
}
