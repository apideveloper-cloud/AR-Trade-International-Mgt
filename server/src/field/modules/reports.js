// Reports for managers / accountants / admins (everyone else sees only their own figures).
//   GET /api/field/reports/summary?type=sales|attendance|expenses&period=day|week|month
//   GET /api/field/reports/expense?month=YYYY-MM&category=&status=
//   GET /api/field/reports/collection?period=day|week|month
//   GET /api/field/reports/export?name=sales|collection|delivery|attendance|route|leave|expense|approvals|ledger&period=&format=json|csv
import { Router } from 'express';
import { pool, guard, wrap, fail, UTC, UTC_TS, distKm } from '../common.js';
import { period, workdaysElapsed, tsBetween, toSql, tkText, kfmt, pctDelta, numDelta, setting, seesAll, bdParts, bdDateStr, CSV, MON, DAY, BD } from '../report_util.js';
import { addSearch, day, pageOf, wantsPage, whereOf } from '../../listing.js';

const router = Router();
const CLOCKERS = ['Field Officer', 'RM', 'Purchase Officer'];
const kind = v => (['day', 'week', 'month'].includes(v) ? v : 'week');
const sum = (rows, f) => rows.reduce((t, r) => t + Number(f(r) || 0), 0);

/** [sqlFragment, args] limiting a table's `staff_id` to the caller unless they may see everybody. */
const scopeOf = (req, col = 'staff_id') => (seesAll(req.staff) ? ['', []] : [` AND ${col} = ?`, [req.staff.id]]);

async function rowsIn(table, tsCol, win, extra = '', args = [], prev = false, select = '*') {
  const from = prev ? win.prevStart : win.start;
  const to = prev ? win.prevEnd : win.end;
  const r = tsBetween(tsCol, from, to);
  const [rows] = await pool.query(`SELECT ${select}, ${UTC_TS(tsCol)} AS at_utc FROM ${table} WHERE ${r.sql}${extra}`, [...r.args, ...args]);
  return rows;
}

// ---------- attendance helpers (clock rows are stored in UTC) ----------
async function attendanceDays(win, staffIds, prev = false) {
  const from = prev ? win.prevStart : win.start;
  const to = prev ? win.prevEnd : win.end;
  if (!staffIds.length) return [];
  const [rows] = await pool.query(
    `SELECT staff_id, type, ${UTC('at')} AS at_utc FROM field_attendance WHERE at >= ? AND at < ? AND staff_id IN (?) ORDER BY staff_id, at, id`,
    [toSql(from), toSql(to), staffIds]);
  const days = new Map(); // "staff|date" -> { first, minutes, openSince }
  const now = Date.now();
  for (const r of rows) {
    const at = new Date(r.at_utc);
    const key = `${r.staff_id}|${bdDateStr(at)}`;
    if (r.type !== 'Clocked In' && !days.has(key)) continue; // a clock-out whose clock-in was on an earlier day is not a day present (and has no first-in time)
    const d = days.get(key) || { staff: r.staff_id, date: bdDateStr(at), first: null, ms: 0, open: null };
    if (r.type === 'Clocked In') { d.first ||= at; d.open = at; } else if (d.open) { d.ms += at - d.open; d.open = null; }
    days.set(key, d);
  }
  for (const d of days.values()) if (d.open) d.ms += Math.max(0, Math.min(now, d.open.getTime() + 10 * 3600e3) - d.open);
  return [...days.values()];
}
async function clockerIds(req) {
  if (!seesAll(req.staff)) return [req.staff.id];
  const [rows] = await pool.query('SELECT id FROM staff WHERE status = "Active" AND role IN (?)', [CLOCKERS]);
  return rows.map(r => r.id);
}
const lateDay = d => d.first && bdParts(d.first).min > 9 * 60 + 15;
const hoursOf = days => (days.length ? sum(days, d => d.ms) / 3600e3 / days.length : 0);

async function budgetFor(kindName, key, fallback) {
  const month = await setting(key, fallback);
  return kindName === 'day' ? month / 26 : kindName === 'week' ? month / 4.3 : month;
}

// ---------- GET /summary ----------
router.get('/summary', guard(), wrap(async (req, res) => {
  const type = ['sales', 'attendance', 'expenses'].includes(req.query.type) ? req.query.type : 'sales';
  const win = period(kind(req.query.period));
  const [sf, sa] = scopeOf(req);
  const bars = Array(win.labels.length).fill(0);
  let kpis, title, target, files, unit = 'k';

  if (type === 'sales') {
    const notCancelled = ` AND status <> 'Cancelled'${sf}`; // a rejected order is cancelled and is not a sale
    const orders = await rowsIn('field_sales_orders', 'created_at', win, notCancelled, sa);
    const prev = await rowsIn('field_sales_orders', 'created_at', win, notCancelled, sa, true);
    const pay = (await rowsIn('field_payments', 'created_at', win, ` AND status <> 'Bounced'${sf}`, sa));
    const payPrev = await rowsIn('field_payments', 'created_at', win, ` AND status <> 'Bounced'${sf}`, sa, true);
    orders.forEach(o => { bars[win.bucketOf(new Date(o.at_utc))] += Number(o.total); });
    const sales = sum(orders, o => o.total), salesPrev = sum(prev, o => o.total), coll = sum(pay, p => p.amount);
    kpis = [
      { label: 'Sales', display: tkText(sales), delta: pctDelta(sales, salesPrev), good: sales >= salesPrev },
      { label: 'Orders', display: String(orders.length), delta: numDelta(orders.length, prev.length), good: orders.length >= prev.length },
      { label: 'Collected', display: tkText(coll), delta: sales ? `${Math.round((coll / sales) * 100)}%` : pctDelta(coll, sum(payPrev, p => p.amount)), good: true }
    ];
    title = 'Sales by day';
    const goal = await budgetFor(win.kind, 'target_sales_month', 500000);
    target = { pct: Math.min(100, Math.round((sales / goal) * 100)), label: 'Target' };
    files = [
      { icon: 'receipt_long', name: 'Sales summary', sub: 'Customer & product wise', export: 'sales' },
      { icon: 'payments', name: 'Collection report', sub: 'By method, aging & receipts', view: 'collection', export: 'collection' },
      { icon: 'local_shipping', name: 'Delivery report', sub: 'Delivered vs pending', export: 'delivery' }
    ];
  } else if (type === 'attendance') {
    const ids = await clockerIds(req);
    const days = await attendanceDays(win, ids);
    const prevDays = await attendanceDays(win, ids, true);
    const wd = Math.max(1, workdaysElapsed(win));
    const prevWin = { ...win, start: win.prevStart, end: win.prevEnd };
    const wdPrev = Math.max(1, workdaysElapsed(prevWin));
    const pres = days.length, presPrev = prevDays.length;
    const presentPct = Math.min(100, Math.round((pres / Math.max(1, ids.length * wd)) * 100));
    const presentPctPrev = Math.min(100, Math.round((presPrev / Math.max(1, ids.length * wdPrev)) * 100));
    days.forEach(d => { bars[win.bucketOf(d.first || new Date())] += 1; });
    const late = days.filter(lateDay).length, latePrev = prevDays.filter(lateDay).length;
    const avg = Math.round(hoursOf(days) * 10) / 10, avgPrev = Math.round(hoursOf(prevDays) * 10) / 10;
    kpis = [
      { label: 'Present', display: `${presentPct}%`, delta: presPrev ? numDelta(presentPct, presentPctPrev, '%') : '—', good: presentPct >= presentPctPrev },
      { label: 'Late', display: String(late), delta: numDelta(late, latePrev), good: late <= latePrev },
      { label: 'Avg duty', display: `${avg}h`, delta: prevDays.length ? numDelta(avg, avgPrev, 'h') : '—', good: avg >= avgPrev }
    ];
    title = win.kind === 'day' ? 'Clock-ins today' : 'Team present by day';
    unit = '';
    const goal = await setting('target_attendance_pct', 95);
    target = { pct: Math.min(100, Math.round((presentPct / goal) * 100)), label: 'Goal' };
    files = [
      { icon: 'how_to_reg', name: 'Attendance register', sub: 'In/out time per staff', export: 'attendance' },
      { icon: 'route', name: 'Route & visit report', sub: 'GPS km, client visits', export: 'route' },
      { icon: 'event_available', name: 'Leave report', sub: 'Taken, balance, pending', export: 'leave' }
    ];
  } else {
    const ex = await rowsIn('field_expenses', 'created_at', win, sf, sa);
    const prev = await rowsIn('field_expenses', 'created_at', win, sf, sa, true);
    ex.forEach(e => { bars[win.bucketOf(new Date(e.at_utc))] += Number(e.amount); });
    const claimed = sum(ex, e => e.amount), approved = sum(ex.filter(e => e.status === 'Approved'), e => e.amount);
    const pending = ex.filter(e => e.status === 'Pending');
    kpis = [
      { label: 'Claimed', display: tkText(claimed), delta: pctDelta(claimed, sum(prev, e => e.amount)), good: claimed <= sum(prev, e => e.amount) || !prev.length },
      { label: 'Approved', display: tkText(approved), delta: claimed ? `${Math.round((approved / claimed) * 100)}%` : '—', good: true },
      { label: 'Pending', display: tkText(sum(pending, e => e.amount)), delta: `${pending.length} claims`, good: false }
    ];
    title = 'Expense by day';
    const budget = await budgetFor(win.kind, 'budget_expense_month', 60000);
    target = { pct: Math.min(100, Math.round((claimed / budget) * 100)), label: 'Budget' };
    files = [
      { icon: 'receipt', name: 'Expense report', sub: 'By staff, category & voucher', view: 'expense', export: 'expense' },
      { icon: 'fact_check', name: 'Approval log', sub: 'Approved / rejected', export: 'approvals' },
      { icon: 'account_balance', name: 'Ledger sync', sub: 'Posted to accounts', export: 'ledger' }
    ];
  }
  const peak = bars.indexOf(Math.max(...bars, 0));
  res.json({
    type, period: win.kind, label: win.label, kpis, target, files, scope: seesAll(req.staff) ? 'team' : 'me',
    chart: { title, unit, peak: Math.max(...bars) > 0 ? peak : -1, bars: win.labels.map((l, i) => ({ label: l, value: Math.round(bars[i] * 10) / 10, display: unit === 'k' ? kfmt(bars[i]) : String(Math.round(bars[i] * 10) / 10) })) }
  });
}));

// A custom date window (?from= and/or ?to=, whole Bangladesh days, both ends included), or null when neither is sent.
const dayText = s => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MON[m - 1].slice(0, 3)} ${y}`; };
function customWindow(req) {
  const a = day(req.query.from), b = day(req.query.to);
  if (!a && !b) return null;
  const start = a ? new Date(Date.parse(a + 'T00:00:00Z') - BD) : new Date(0);
  const end = b ? new Date(Date.parse(b + 'T00:00:00Z') + DAY - BD) : new Date(Date.UTC(2100, 0, 1));
  return { kind: 'custom', start, end, label: a && b ? (a === b ? dayText(a) : `${dayText(a)} – ${dayText(b)}`) : a ? `From ${dayText(a)}` : `Until ${dayText(b)}` };
}

// ---------- GET /expense ----------
// The mobile app sends ?month= (and maybe category / status) and gets the whole list in `items`. The web console may also send
// ?from= &to= (instead of the month), ?q=, and ?page= &size=; the answer then also has rows (= the page), total (= claims matching the
// filters) and claimed (= the money the old `total` carried). The month figures (total, count, split, categories) never depend on q / category / status.
router.get('/expense', guard(), wrap(async (req, res) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(req.query.month || '')) || /^(\d{4})-(\d{2})$/.exec(bdDateStr(new Date()).slice(0, 7));
  const y = +m[1], mo = +m[2] - 1;
  const custom = customWindow(req);
  const start = custom ? custom.start : new Date(Date.UTC(y, mo, 1) - BD), end = custom ? custom.end : new Date(Date.UTC(y, mo + 1, 1) - BD);
  const [sf, sa] = scopeOf(req, 'e.staff_id');
  const r = tsBetween('e.created_at', start, end);
  const [groups] = await pool.query(`SELECT e.status, e.category, COUNT(*) n, COALESCE(SUM(e.amount), 0) amount FROM field_expenses e WHERE ${r.sql}${sf} GROUP BY e.status, e.category`, [...r.args, ...sa]);
  const total = sum(groups, g => g.amount), count = sum(groups, g => g.n);
  const split = ['Approved', 'Pending', 'Rejected'].map(label => ({ label, amount: Math.round(sum(groups.filter(g => g.status === label), g => g.amount)), count: sum(groups.filter(g => g.status === label), g => g.n) }));
  const cats = [...new Set(groups.map(g => g.category))].map(name => ({ name, amount: Math.round(sum(groups.filter(g => g.category === name), g => g.amount)), count: sum(groups.filter(g => g.category === name), g => g.n) })).sort((a, b) => b.amount - a.amount);

  const cond = [r.sql + sf], args = [...r.args, ...sa];
  const cat = String(req.query.category || ''), st = String(req.query.status || '').toLowerCase();
  if (cat) { cond.push('e.category = ?'); args.push(cat); }
  if (st) { cond.push('LOWER(e.status) = ?'); args.push(st); }
  addSearch(cond, args, ['e.title', 'e.category', 's.name'], req.query.q);
  const paged = wantsPage(req);
  const pg = paged ? pageOf(req, { def: 25, max: 200 }) : null;
  const from = `FROM field_expenses e JOIN staff s ON s.id = e.staff_id ${whereOf(cond)}`;
  const [rows] = await pool.query(
    `SELECT e.id, e.title, e.category, e.amount, e.status, e.voucher IS NOT NULL AS has_voucher, ${UTC_TS('e.created_at')} AS at_utc, s.name ${from} ORDER BY e.created_at DESC, e.id DESC${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...args, pg.size, pg.offset] : args);
  const items = rows.map(e => ({
    id: e.id, date: e.at_utc, title: e.title, who: e.name, category: e.category, amount: Math.round(Number(e.amount)), status: e.status.toLowerCase(), voucher: !!e.has_voucher
  }));
  const out = { month: custom ? custom.label : `${MON[mo]} ${y}`, key: custom ? '' : `${y}-${String(mo + 1).padStart(2, '0')}`, total: Math.round(total), count, split, categories: cats, items, scope: seesAll(req.staff) ? 'team' : 'me' };
  if (!paged) return res.json(out);
  const [[n]] = await pool.query(`SELECT COUNT(*) n ${from}`, args);
  res.json({ ...out, claimed: out.total, rows: items, total: n.n });
}));

// ---------- GET /collection ----------
// ?period=day|week|month as before, or ?from= &to= (custom days). The web console may add ?q= (receipt, customer, invoice, reference, staff), ?method=, ?status=
// and ?page= &size=; the answer then also has rows (= the page), total (= receipts matching the filters) and collected (= the money the old `total` carried).
router.get('/collection', guard(), wrap(async (req, res) => {
  const win = customWindow(req) || period(kind(req.query.period || 'month'));
  const [sf, sa] = scopeOf(req, 'p.staff_id');
  const r = tsBetween('p.created_at', win.start, win.end);
  const [byMethod] = await pool.query(`SELECT p.method, p.status = 'Bounced' AS bounced, COUNT(*) n, COALESCE(SUM(p.amount), 0) amount FROM field_payments p WHERE ${r.sql}${sf} GROUP BY p.method, bounced`, [...r.args, ...sa]);
  const valid = byMethod.filter(g => !g.bounced);
  const total = sum(valid, g => g.amount), count = sum(byMethod, g => g.n);
  const methods = ['Cash', 'bKash', 'Cheque', 'Bank'].map(label => { const a = sum(valid.filter(g => g.method === label), g => g.amount); return { label, amount: Math.round(a), pct: total ? Math.round((a / total) * 100) : 0 }; });
  const cond = [r.sql + sf], args = [...r.args, ...sa];
  const method = String(req.query.method || ''), st = String(req.query.status || '');
  if (method) { cond.push('p.method = ?'); args.push(method); }
  if (st) { cond.push('p.status = ?'); args.push(st); }
  addSearch(cond, args, ['p.id', 'c.name', 'p.invoice_refs', 'p.reference', 's.name'], req.query.q);
  const paged = wantsPage(req);
  const pg = paged ? pageOf(req, { def: 25, max: 200 }) : null;
  const from = `FROM field_payments p LEFT JOIN field_customers c ON c.id = p.customer_id LEFT JOIN staff s ON s.id = p.staff_id ${whereOf(cond)}`;
  const [rows] = await pool.query(
    `SELECT p.id, p.invoice_refs, p.method, p.amount, p.status, ${UTC_TS('p.created_at')} AS at_utc, c.name AS customer, s.name AS who ${from} ORDER BY p.created_at DESC, p.id DESC${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...args, pg.size, pg.offset] : args);

  // outstanding dues by invoice age
  const own = seesAll(req.staff) ? '' : ' AND i.order_id IN (SELECT id FROM field_sales_orders WHERE staff_id = ?)';
  const [inv] = await pool.query(
    `SELECT i.total - i.paid AS due, DATEDIFF(UTC_DATE(), DATE(i.created_at)) AS age FROM field_invoices i WHERE i.total > i.paid${own}`,
    seesAll(req.staff) ? [] : [req.staff.id]);
  const bucket = (lo, hi) => Math.round(sum(inv.filter(i => i.age >= lo && i.age <= hi), i => i.due));
  const aging = [{ label: '0–15 days', amount: bucket(-9999, 15) }, { label: '16–30 days', amount: bucket(16, 30) }, { label: '30+ days', amount: bucket(31, 99999) }];
  const items = rows.map(p => ({ id: p.id, date: p.at_utc, customer: p.customer || '—', invoices: p.invoice_refs, method: p.method, who: p.who || '', amount: Number(p.amount), status: p.status }));
  const out = { period: win.kind, label: win.label, total: Math.round(total), count, methods, dues: { total: Math.round(sum(inv, i => i.due)), aging }, items };
  if (!paged) return res.json(out);
  const [[n]] = await pool.query(`SELECT COUNT(*) n ${from}`, args);
  res.json({ ...out, collected: out.total, rows: items, total: n.n });
}));

// ---------- GET /export ----------
async function dataset(name, win, req) {
  const [sf, sa] = scopeOf(req, 'x.staff_id');
  const date = v => { const d = new Date(v); const p = bdParts(d); return `${p.d} ${MON[p.m].slice(0, 3)} ${p.y}`; };
  const tr = col => tsBetween(col, win.start, win.end);
  switch (name) {
    case 'sales': {
      const t = tr('x.created_at');
      const [rows] = await pool.query(`SELECT x.id, x.total, x.status, x.approval_status, ${UTC_TS('x.created_at')} at_utc, c.name customer, s.name rep FROM field_sales_orders x LEFT JOIN field_customers c ON c.id = x.customer_id LEFT JOIN staff s ON s.id = x.staff_id WHERE ${t.sql}${sf} ORDER BY x.created_at`, [...t.args, ...sa]);
      return { title: 'Sales summary', columns: ['Order', 'Date', 'Customer', 'Sales rep', 'Total (Tk)', 'Status', 'Approval'], rows: rows.map(r => [r.id, date(r.at_utc), r.customer, r.rep, r.total, r.status, r.approval_status]) };
    }
    case 'collection': {
      const t = tr('x.created_at');
      const [rows] = await pool.query(`SELECT x.id, x.invoice_refs, x.method, x.amount, x.status, ${UTC_TS('x.created_at')} at_utc, c.name customer, s.name who FROM field_payments x LEFT JOIN field_customers c ON c.id = x.customer_id LEFT JOIN staff s ON s.id = x.staff_id WHERE ${t.sql}${sf} ORDER BY x.created_at`, [...t.args, ...sa]);
      return { title: 'Collection report', columns: ['Receipt', 'Date', 'Customer', 'Invoices', 'Method', 'Amount (Tk)', 'Received by', 'Status'], rows: rows.map(r => [r.id, date(r.at_utc), r.customer, r.invoice_refs, r.method, r.amount, r.who, r.status]) };
    }
    case 'delivery': {
      const t = tr('x.created_at');
      const [rows] = await pool.query(`SELECT x.id, x.order_id, x.status, x.address, x.received_by, ${UTC_TS('x.created_at')} at_utc, c.name customer FROM field_deliveries x JOIN field_sales_orders o ON o.id = x.order_id LEFT JOIN field_customers c ON c.id = o.customer_id WHERE ${t.sql}${seesAll(req.staff) ? '' : ' AND o.staff_id = ?'} ORDER BY x.created_at`, [...t.args, ...(seesAll(req.staff) ? [] : [req.staff.id])]);
      return { title: 'Delivery report', columns: ['Delivery', 'Order', 'Customer', 'Address', 'Status', 'Received by'], rows: rows.map(r => [r.id, r.order_id, r.customer, r.address, r.status, r.received_by]) };
    }
    case 'attendance': {
      const ids = await clockerIds(req);
      const days = await attendanceDays(win, ids);
      const [names] = ids.length ? await pool.query('SELECT id, name, employee_code FROM staff WHERE id IN (?)', [ids]) : [[]];
      return { title: 'Attendance register', columns: ['Employee', 'ID', 'Date', 'First clock-in', 'Duty hours', 'Late'], rows: days.sort((a, b) => a.date.localeCompare(b.date)).map(d => { const n = names.find(x => x.id === d.staff); const p = bdParts(d.first); return [n?.name || d.staff, n?.employee_code || '', d.date, `${String(Math.floor(p.min / 60)).padStart(2, '0')}:${String(p.min % 60).padStart(2, '0')}`, (d.ms / 3600e3).toFixed(1), lateDay(d) ? 'Late' : '']; }) };
    }
    case 'route': {
      const ids = await clockerIds(req);
      const [names] = ids.length ? await pool.query('SELECT id, name FROM staff WHERE id IN (?)', [ids]) : [[]];
      const rows = [];
      for (const n of names) {
        const [pts] = await pool.query('SELECT lat, lng FROM field_track WHERE staff_id = ? AND at >= ? AND at < ? ORDER BY at, id', [n.id, toSql(win.start), toSql(win.end)]);
        let km = 0;
        for (let i = 1; i < pts.length; i++) km += distKm({ lat: Number(pts[i - 1].lat), lng: Number(pts[i - 1].lng) }, { lat: Number(pts[i].lat), lng: Number(pts[i].lng) });
        let v = [{ done: 0, total: 0 }];
        try { [v] = await pool.query('SELECT SUM(status = "Done") done, COUNT(*) total FROM field_visits WHERE staff_id = ? AND visit_date >= ? AND visit_date < ?', [n.id, bdDateStr(win.start), bdDateStr(win.end)]); } catch { /* visits module missing */ }
        rows.push([n.name, pts.length, km.toFixed(1), `${Number(v[0].done || 0)} / ${Number(v[0].total || 0)}`]);
      }
      return { title: 'Route & visit report', columns: ['Employee', 'GPS points', 'Distance (km)', 'Visits done / planned'], rows };
    }
    case 'leave': {
      const [rows] = await pool.query(`SELECT x.type, DATE_FORMAT(x.from_date, '%Y-%m-%d') AS from_d, DATE_FORMAT(x.to_date, '%Y-%m-%d') AS to_d, x.days, x.status, x.reason, s.name FROM field_leave_requests x JOIN staff s ON s.id = x.staff_id WHERE x.from_date < ? AND x.to_date >= ?${sf} ORDER BY x.from_date`, [bdDateStr(win.end), bdDateStr(win.start), ...sa]);
      return { title: 'Leave report', columns: ['Employee', 'Type', 'From', 'To', 'Days', 'Status', 'Reason'], rows: rows.map(r => [r.name, r.type, r.from_d, r.to_d, r.days, r.status, r.reason]) };
    }
    case 'expense':
    case 'approvals':
    case 'ledger': {
      const t = tr('x.created_at');
      if (name === 'ledger') {
        const [rows] = await pool.query(`SELECT x.id, x.total, x.accounting_synced, ${UTC_TS('x.created_at')} at_utc, c.name customer FROM field_sales_orders x LEFT JOIN field_customers c ON c.id = x.customer_id WHERE ${t.sql}${sf} ORDER BY x.created_at`, [...t.args, ...sa]);
        return { title: 'Ledger sync', columns: ['Order', 'Date', 'Customer', 'Total (Tk)', 'Posted to accounts'], rows: rows.map(r => [r.id, date(r.at_utc), r.customer, r.total, r.accounting_synced ? 'Yes' : 'No']) };
      }
      const [rows] = await pool.query(`SELECT x.id, x.title, x.category, x.amount, x.status, x.remarks, ${UTC_TS('x.created_at')} at_utc, s.name, d.name decider FROM field_expenses x JOIN staff s ON s.id = x.staff_id LEFT JOIN staff d ON d.id = x.decided_by WHERE ${t.sql}${sf} ${name === 'approvals' ? "AND x.status <> 'Pending'" : ''} ORDER BY x.created_at`, [...t.args, ...sa]);
      return name === 'approvals'
        ? { title: 'Approval log', columns: ['Date', 'Employee', 'Claim', 'Amount (Tk)', 'Decision', 'Decided by', 'Remarks'], rows: rows.map(r => [date(r.at_utc), r.name, r.title, r.amount, r.status, r.decider || '', r.remarks]) }
        : { title: 'Expense report', columns: ['Date', 'Employee', 'Claim', 'Category', 'Amount (Tk)', 'Status'], rows: rows.map(r => [date(r.at_utc), r.name, r.title, r.category, r.amount, r.status]) };
    }
    default:
      throw fail(404, 'Unknown report');
  }
}

router.get('/export', guard(), wrap(async (req, res) => {
  const win = customWindow(req) || period(kind(req.query.period || 'month'));
  const data = await dataset(String(req.query.name || ''), win, req);
  // optional (web console): ?q= keeps the rows that contain the text; ?page= &size= returns one page of them in `rows` plus `total` (rows after q)
  const w = String(req.query.q || '').trim().toLowerCase().slice(0, 80);
  if (w) data.rows = data.rows.filter(r => r.join(' ').toLowerCase().includes(w));
  const total = data.rows.length;
  if (wantsPage(req)) { const pg = pageOf(req, { def: 25, max: 200 }); data.rows = data.rows.slice(pg.offset, pg.offset + pg.size); }
  const out = { ...data, period: win.label, generated: new Date().toISOString(), ...(wantsPage(req) ? { total } : {}) };
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${data.title.replace(/\W+/g, '_')}.csv"`);
    return res.send('﻿' + CSV([data.columns, ...data.rows]));
  }
  res.json(out);
}));

export default router;
