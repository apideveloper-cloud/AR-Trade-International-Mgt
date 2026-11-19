// The tables behind GET /export: each returns { title, columns, rows } for a window, limited to what the caller may see.
import { pool, fail, UTC_TS, distKm } from '../common.js';
import { tsBetween, toSql, bdParts, bdDateStr, seesAll, MON } from '../report_util.js';
import { scopeOf } from './shared.js';
import { attendanceDays, clockerIds, lateDay } from './attendance.js';

/** An instant as '5 Nov 2026' (Bangladesh time). */
export const dateText = v => { const p = bdParts(new Date(v)); return `${p.d} ${MON[p.m].slice(0, 3)} ${p.y}`; };
/** Minutes after midnight -> 'HH:MM'. */
export const clockText = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const sales = async (win, sf, sa) => {
  const t = tsBetween('x.created_at', win.start, win.end);
  const [rows] = await pool.query(`SELECT x.id, x.total, x.status, x.approval_status, ${UTC_TS('x.created_at')} at_utc, c.name customer, s.name rep FROM field_sales_orders x LEFT JOIN field_customers c ON c.id = x.customer_id LEFT JOIN staff s ON s.id = x.staff_id WHERE ${t.sql}${sf} ORDER BY x.created_at`, [...t.args, ...sa]);
  return { title: 'Sales summary', columns: ['Order', 'Date', 'Customer', 'Sales rep', 'Total (Tk)', 'Status', 'Approval'], rows: rows.map(r => [r.id, dateText(r.at_utc), r.customer, r.rep, r.total, r.status, r.approval_status]) };
};

const collection = async (win, sf, sa) => {
  const t = tsBetween('x.created_at', win.start, win.end);
  const [rows] = await pool.query(`SELECT x.id, x.invoice_refs, x.method, x.amount, x.status, ${UTC_TS('x.created_at')} at_utc, c.name customer, s.name who FROM field_payments x LEFT JOIN field_customers c ON c.id = x.customer_id LEFT JOIN staff s ON s.id = x.staff_id WHERE ${t.sql}${sf} ORDER BY x.created_at`, [...t.args, ...sa]);
  return { title: 'Collection report', columns: ['Receipt', 'Date', 'Customer', 'Invoices', 'Method', 'Amount (Tk)', 'Received by', 'Status'], rows: rows.map(r => [r.id, dateText(r.at_utc), r.customer, r.invoice_refs, r.method, r.amount, r.who, r.status]) };
};

const delivery = async (win, req) => {
  const t = tsBetween('x.created_at', win.start, win.end);
  const all = seesAll(req.staff);
  const [rows] = await pool.query(`SELECT x.id, x.order_id, x.status, x.address, x.received_by, ${UTC_TS('x.created_at')} at_utc, c.name customer FROM field_deliveries x JOIN field_sales_orders o ON o.id = x.order_id LEFT JOIN field_customers c ON c.id = o.customer_id WHERE ${t.sql}${all ? '' : ' AND o.staff_id = ?'} ORDER BY x.created_at`, [...t.args, ...(all ? [] : [req.staff.id])]);
  return { title: 'Delivery report', columns: ['Delivery', 'Order', 'Customer', 'Address', 'Status', 'Received by'], rows: rows.map(r => [r.id, r.order_id, r.customer, r.address, r.status, r.received_by]) };
};

const attendance = async (win, req) => {
  const ids = await clockerIds(req);
  const days = await attendanceDays(win, ids);
  const [names] = ids.length ? await pool.query('SELECT id, name, employee_code FROM staff WHERE id IN (?)', [ids]) : [[]];
  return { title: 'Attendance register', columns: ['Employee', 'ID', 'Date', 'First clock-in', 'Duty hours', 'Late'], rows: days.sort((a, b) => a.date.localeCompare(b.date)).map(d => { const n = names.find(x => x.id === d.staff); return [n?.name || d.staff, n?.employee_code || '', d.date, clockText(bdParts(d.first).min), (d.ms / 3600e3).toFixed(1), lateDay(d) ? 'Late' : '']; }) };
};

const route = async (win, req) => {
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
};

const leave = async (win, sf, sa) => {
  const [rows] = await pool.query(`SELECT x.type, DATE_FORMAT(x.from_date, '%Y-%m-%d') AS from_d, DATE_FORMAT(x.to_date, '%Y-%m-%d') AS to_d, x.days, x.status, x.reason, s.name FROM field_leave_requests x JOIN staff s ON s.id = x.staff_id WHERE x.from_date < ? AND x.to_date >= ?${sf} ORDER BY x.from_date`, [bdDateStr(win.end), bdDateStr(win.start), ...sa]);
  return { title: 'Leave report', columns: ['Employee', 'Type', 'From', 'To', 'Days', 'Status', 'Reason'], rows: rows.map(r => [r.name, r.type, r.from_d, r.to_d, r.days, r.status, r.reason]) };
};

const ledger = async (win, sf, sa) => {
  const t = tsBetween('x.created_at', win.start, win.end);
  const [rows] = await pool.query(`SELECT x.id, x.total, x.accounting_synced, ${UTC_TS('x.created_at')} at_utc, c.name customer FROM field_sales_orders x LEFT JOIN field_customers c ON c.id = x.customer_id WHERE ${t.sql}${sf} ORDER BY x.created_at`, [...t.args, ...sa]);
  return { title: 'Ledger sync', columns: ['Order', 'Date', 'Customer', 'Total (Tk)', 'Posted to accounts'], rows: rows.map(r => [r.id, dateText(r.at_utc), r.customer, r.total, r.accounting_synced ? 'Yes' : 'No']) };
};

/** Expense report (all claims) or approval log (decided claims only). */
const expenses = async (win, sf, sa, approvals) => {
  const t = tsBetween('x.created_at', win.start, win.end);
  const [rows] = await pool.query(`SELECT x.id, x.title, x.category, x.amount, x.status, x.remarks, ${UTC_TS('x.created_at')} at_utc, s.name, d.name decider FROM field_expenses x JOIN staff s ON s.id = x.staff_id LEFT JOIN staff d ON d.id = x.decided_by WHERE ${t.sql}${sf} ${approvals ? "AND x.status <> 'Pending'" : ''} ORDER BY x.created_at`, [...t.args, ...sa]);
  return approvals
    ? { title: 'Approval log', columns: ['Date', 'Employee', 'Claim', 'Amount (Tk)', 'Decision', 'Decided by', 'Remarks'], rows: rows.map(r => [dateText(r.at_utc), r.name, r.title, r.amount, r.status, r.decider || '', r.remarks]) }
    : { title: 'Expense report', columns: ['Date', 'Employee', 'Claim', 'Category', 'Amount (Tk)', 'Status'], rows: rows.map(r => [dateText(r.at_utc), r.name, r.title, r.category, r.amount, r.status]) };
};

/** The named report's table for the window, or a 404 for an unknown name. */
export async function dataset(name, win, req) {
  const [sf, sa] = scopeOf(req, 'x.staff_id');
  switch (name) {
    case 'sales': return sales(win, sf, sa);
    case 'collection': return collection(win, sf, sa);
    case 'delivery': return delivery(win, req);
    case 'attendance': return attendance(win, req);
    case 'route': return route(win, req);
    case 'leave': return leave(win, sf, sa);
    case 'ledger': return ledger(win, sf, sa);
    case 'expense': return expenses(win, sf, sa, false);
    case 'approvals': return expenses(win, sf, sa, true);
    default: throw fail(404, 'Unknown report');
  }
}
