// Helpers shared by the customers / visits / followups modules (Bangladesh time = UTC+6, no DST).
import { pool, UTC, fail } from './common.js';

const BD = 6 * 3600e3;
export const pad = n => String(n).padStart(2, '0');
/** 'YYYY-MM-DD' in Bangladesh time for a Date (default now). */
export const bdDate = (d = new Date()) => new Date(d.getTime() + BD).toISOString().slice(0, 10);
/** BD wall-clock date + 'HH:MM' -> Date (UTC instant). */
export const bdToDate = (date, time = '00:00') => new Date(`${date}T${time.length === 5 ? time : time.slice(0, 5)}:00+06:00`);
export const utcSql = d => d.toISOString().slice(0, 19).replace('T', ' ');
export const addDays = (date, n) => bdDate(new Date(bdToDate(date).getTime() + n * 864e5));
export const dateOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(bdToDate(s));
export const timeOk = s => /^\d{2}:\d{2}$/.test(String(s || ''));

/** Customers' outstanding dues, from field_invoices when the sales module has created it (customer_id, total, paid). */
export async function duesByCustomer() {
  try {
    const [rows] = await pool.query('SELECT customer_id, SUM(total - paid) due FROM field_invoices GROUP BY customer_id');
    return new Map(rows.map(r => [r.customer_id, Math.max(0, Math.round(Number(r.due) || 0))]));
  } catch { return new Map(); }
}

export const customerOut = (c, due = 0) => ({
  id: c.id, name: c.name, contact: c.contact_person, contactRole: c.contact_role, phone: c.phone, email: c.email,
  address: c.address, area: c.area, kind: c.kind, type: c.customer_type, interest: c.interest, monthlyValue: c.monthly_value,
  source: c.lead_source, nextStep: c.next_step, note: c.note || '', lat: c.lat == null ? null : Number(c.lat), lng: c.lng == null ? null : Number(c.lng),
  due, createdAt: c.created_at
});

export const VISIT_SQL = `SELECT v.id, v.customer_id, v.staff_id, DATE_FORMAT(v.visit_date,'%Y-%m-%d') date, TIME_FORMAT(v.visit_time,'%H:%i') time,
  v.purpose, v.status, ${UTC('v.check_in')} check_in, ${UTC('v.check_out')} check_out, v.outcome, v.order_value, v.notes, v.followup_action, v.followup_when,
  v.lat, v.lng, c.name customer, c.area, c.address, c.contact_person, c.contact_role, c.phone, c.kind customer_kind, c.lat clat, c.lng clng, s.name staff_name
  FROM field_visits v JOIN field_customers c ON c.id = v.customer_id JOIN staff s ON s.id = v.staff_id`;

export const visitOut = v => ({
  id: v.id, customerId: v.customer_id, customer: v.customer, area: v.area, address: v.address, contact: v.contact_person, contactRole: v.contact_role,
  phone: v.phone, customerKind: v.customer_kind, staffId: v.staff_id, staffName: v.staff_name, date: v.date, time: v.time, purpose: v.purpose, status: v.status,
  checkIn: v.check_in, checkOut: v.check_out, outcome: v.outcome, orderValue: Math.round(Number(v.order_value) || 0), notes: v.notes || '',
  followupAction: v.followup_action, followupWhen: v.followup_when,
  lat: v.lat == null ? null : Number(v.lat), lng: v.lng == null ? null : Number(v.lng),
  clat: v.clat == null ? null : Number(v.clat), clng: v.clng == null ? null : Number(v.clng)
});

export async function loadVisit(id) {
  const [[v]] = await pool.query(VISIT_SQL + ' WHERE v.id = ?', [id]);
  if (!v) throw fail(404, 'Visit not found');
  return v;
}
