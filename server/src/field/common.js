// Shared helpers for the field-app API modules (src/field/modules/*.js).
// Every module imports what it needs from here instead of reaching into admin.js / field.js.
import { pool } from '../db.js';
import { digits, fail, wrap, parseJson, nextSeq } from '../util.js';
import { guard } from '../admin.js';
import { can } from '../permissions.js';

export { pool, digits, fail, wrap, parseJson, nextSeq, guard, can };

/** Mobile-app role keys. The web console's staff.role names map onto the six roles of the field app. */
const ROLE_KEYS = {
  'Master Admin': 'admin', Admin: 'admin', Manager: 'manager', Accountant: 'accountant',
  'Purchase Officer': 'purchase', RM: 'rm', 'Field Officer': 'field'
};
export const roleKey = role => ROLE_KEYS[role] || 'field';
export const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', accountant: 'Accountant', purchase: 'Purchase Officer', rm: 'RM', field: 'Field Officer' };

/** Can approve expense claims and see the live team map (web permission `field.approve`). */
export const isApprover = s => can(s, 'field.approve');

/** guard() plus a check that the staff member holds one of the given app roles, e.g. guardRole('rm', 'manager'). Admin always passes. */
export const guardRole = (...keys) => [
  guard(),
  (req, res, next) => (roleKey(req.staff.role) === 'admin' || keys.includes(roleKey(req.staff.role))
    ? next()
    : res.status(403).json({ error: 'Your role cannot do this' }))
];

export const empCode = s => s.employee_code || 'ART-' + String(s.id).padStart(4, '0');

/** What the app receives about a staff member. */
export const staffOut = s => ({
  id: s.id, name: s.name, email: s.email, phone: s.phone, employeeCode: empCode(s),
  role: roleKey(s.role), roleLabel: s.role
});

// ---- time helpers: everything is stored in UTC ----
export const mysqlDate = v => { const d = new Date(v); if (isNaN(d)) throw fail(400, 'Invalid time'); return d.toISOString().slice(0, 19).replace('T', ' '); };
/** SQL expression -> ISO string with a Z, e.g. UTC('created_at'). For TIMESTAMP columns written by CURRENT_TIMESTAMP use UTC_TS(). */
export const UTC = c => `DATE_FORMAT(${c}, '%Y-%m-%dT%H:%i:%sZ')`;
export const UTC_TS = c => UTC(`CONVERT_TZ(${c}, @@session.time_zone, "+00:00")`);
/** ?from=&to= ISO instants (the client sends its local day as UTC instants); default = last 24h. */
export const range = q => {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 864e5);
  if (isNaN(from) || isNaN(to)) throw fail(400, 'Invalid range');
  return [mysqlDate(from), mysqlDate(to)];
};
export const coord = (v, max) => { const n = Number(v); if (!Number.isFinite(n) || Math.abs(n) > max) throw fail(400, 'Invalid coordinates'); return n; };
/** Today's date (YYYY-MM-DD) in Bangladesh time, for "today" style filters on DATE columns. */
export const todayBD = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);

/** Whole taka amount of a DECIMAL column. */
export const taka = v => Math.round(Number(v) || 0);

/**
 * Sends an in-app notification to one or more staff members (id or array of ids).
 * n = { icon, title, sub, body, cat: 'Approvals'|'Alerts'|'Updates', rows: [[label, value], ...], a1, a1Icon, a2 }
 * Never throws: a failed notification must not break the action that triggered it.
 */
export async function notify(staffIds, n) {
  try {
    const ids = [].concat(staffIds).filter(Boolean);
    if (!ids.length) return;
    const row = id => [id, n.icon || 'notifications', String(n.title || '').slice(0, 160), String(n.sub || '').slice(0, 255),
      String(n.body || ''), ['Approvals', 'Alerts', 'Updates'].includes(n.cat) ? n.cat : 'Updates', JSON.stringify(n.rows || []),
      n.a1 || '', n.a1Icon || '', n.a2 || ''];
    await pool.query('INSERT INTO field_notifications (staff_id,icon,title,sub,body,cat,rows_json,a1,a1_icon,a2) VALUES ?', [ids.map(row)]);
  } catch (e) { console.error('[field] notify failed:', e.message); }
}

/** Staff ids by app role key(s), e.g. staffIdsByRole('manager', 'admin'). */
export async function staffIdsByRole(...keys) {
  const names = Object.entries(ROLE_KEYS).filter(([, k]) => keys.includes(k)).map(([n]) => n);
  if (!names.length) return [];
  const [rows] = await pool.query('SELECT id FROM staff WHERE status = "Active" AND role IN (?)', [names]);
  return rows.map(r => r.id);
}

/** Idempotent ALTER TABLE ... ADD COLUMN (MySQL has no IF NOT EXISTS for columns on every version). */
export async function addColumn(table, column, ddl) {
  const [[c]] = await pool.query('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);
  if (!c.n) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
}
