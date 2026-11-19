// The three /summary report types. Each returns { kpis, title, target, files, unit } and adds its figures into `bars`.
import { workdaysElapsed, tkText, pctDelta, numDelta, setting } from '../report_util.js';
import { rowsIn, sum } from './shared.js';
import { attendanceDays, clockerIds, lateDay, hoursOf } from './attendance.js';

/** Monthly budget / target scaled to the window: per day (26 days), per week (4.3 weeks) or the month. */
async function budgetFor(kindName, key, fallback) {
  const month = await setting(key, fallback);
  return kindName === 'day' ? month / 26 : kindName === 'week' ? month / 4.3 : month;
}

export async function salesSummary(win, sf, sa, bars) {
  const notCancelled = ` AND status <> 'Cancelled'${sf}`; // a rejected order is cancelled and is not a sale
  const notBounced = ` AND status <> 'Bounced'${sf}`;
  const orders = await rowsIn('field_sales_orders', 'created_at', win, notCancelled, sa);
  const prev = await rowsIn('field_sales_orders', 'created_at', win, notCancelled, sa, true);
  const pay = await rowsIn('field_payments', 'created_at', win, notBounced, sa);
  const payPrev = await rowsIn('field_payments', 'created_at', win, notBounced, sa, true);
  orders.forEach(o => { bars[win.bucketOf(new Date(o.at_utc))] += Number(o.total); });
  const sales = sum(orders, o => o.total), salesPrev = sum(prev, o => o.total), coll = sum(pay, p => p.amount);
  const goal = await budgetFor(win.kind, 'target_sales_month', 500000);
  return {
    unit: 'k', title: 'Sales by day',
    kpis: [
      { label: 'Sales', display: tkText(sales), delta: pctDelta(sales, salesPrev), good: sales >= salesPrev },
      { label: 'Orders', display: String(orders.length), delta: numDelta(orders.length, prev.length), good: orders.length >= prev.length },
      { label: 'Collected', display: tkText(coll), delta: sales ? `${Math.round((coll / sales) * 100)}%` : pctDelta(coll, sum(payPrev, p => p.amount)), good: true }
    ],
    target: { pct: Math.min(100, Math.round((sales / goal) * 100)), label: 'Target' },
    files: [
      { icon: 'receipt_long', name: 'Sales summary', sub: 'Customer & product wise', export: 'sales' },
      { icon: 'payments', name: 'Collection report', sub: 'By method, aging & receipts', view: 'collection', export: 'collection' },
      { icon: 'local_shipping', name: 'Delivery report', sub: 'Delivered vs pending', export: 'delivery' }
    ]
  };
}

export async function attendanceSummary(win, req, bars) {
  const ids = await clockerIds(req);
  const days = await attendanceDays(win, ids);
  const prevDays = await attendanceDays(win, ids, true);
  const wd = Math.max(1, workdaysElapsed(win));
  const wdPrev = Math.max(1, workdaysElapsed({ ...win, start: win.prevStart, end: win.prevEnd }));
  const pres = days.length, presPrev = prevDays.length;
  const presentPct = Math.min(100, Math.round((pres / Math.max(1, ids.length * wd)) * 100));
  const presentPctPrev = Math.min(100, Math.round((presPrev / Math.max(1, ids.length * wdPrev)) * 100));
  days.forEach(d => { bars[win.bucketOf(d.first || new Date())] += 1; });
  const late = days.filter(lateDay).length, latePrev = prevDays.filter(lateDay).length;
  const avg = Math.round(hoursOf(days) * 10) / 10, avgPrev = Math.round(hoursOf(prevDays) * 10) / 10;
  const goal = await setting('target_attendance_pct', 95);
  return {
    unit: '', title: win.kind === 'day' ? 'Clock-ins today' : 'Team present by day',
    kpis: [
      { label: 'Present', display: `${presentPct}%`, delta: presPrev ? numDelta(presentPct, presentPctPrev, '%') : '—', good: presentPct >= presentPctPrev },
      { label: 'Late', display: String(late), delta: numDelta(late, latePrev), good: late <= latePrev },
      { label: 'Avg duty', display: `${avg}h`, delta: prevDays.length ? numDelta(avg, avgPrev, 'h') : '—', good: avg >= avgPrev }
    ],
    target: { pct: Math.min(100, Math.round((presentPct / goal) * 100)), label: 'Goal' },
    files: [
      { icon: 'how_to_reg', name: 'Attendance register', sub: 'In/out time per staff', export: 'attendance' },
      { icon: 'route', name: 'Route & visit report', sub: 'GPS km, client visits', export: 'route' },
      { icon: 'event_available', name: 'Leave report', sub: 'Taken, balance, pending', export: 'leave' }
    ]
  };
}

export async function expenseSummary(win, sf, sa, bars) {
  const ex = await rowsIn('field_expenses', 'created_at', win, sf, sa);
  const prev = await rowsIn('field_expenses', 'created_at', win, sf, sa, true);
  ex.forEach(e => { bars[win.bucketOf(new Date(e.at_utc))] += Number(e.amount); });
  const claimed = sum(ex, e => e.amount), approved = sum(ex.filter(e => e.status === 'Approved'), e => e.amount);
  const pending = ex.filter(e => e.status === 'Pending');
  const budget = await budgetFor(win.kind, 'budget_expense_month', 60000);
  return {
    unit: 'k', title: 'Expense by day',
    kpis: [
      { label: 'Claimed', display: tkText(claimed), delta: pctDelta(claimed, sum(prev, e => e.amount)), good: claimed <= sum(prev, e => e.amount) || !prev.length },
      { label: 'Approved', display: tkText(approved), delta: claimed ? `${Math.round((approved / claimed) * 100)}%` : '—', good: true },
      { label: 'Pending', display: tkText(sum(pending, e => e.amount)), delta: `${pending.length} claims`, good: false }
    ],
    target: { pct: Math.min(100, Math.round((claimed / budget) * 100)), label: 'Budget' },
    files: [
      { icon: 'receipt', name: 'Expense report', sub: 'By staff, category & voucher', view: 'expense', export: 'expense' },
      { icon: 'fact_check', name: 'Approval log', sub: 'Approved / rejected', export: 'approvals' },
      { icon: 'account_balance', name: 'Ledger sync', sub: 'Posted to accounts', export: 'ledger' }
    ]
  };
}
