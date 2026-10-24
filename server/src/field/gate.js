// Module switches for the field app: the admin turns whole modules on / off and picks which roles see them.
// Every module router (and the core attendance / tracking / expenses routes) is mounted behind moduleGate().
import jwt from 'jsonwebtoken';
import { pool, roleKey } from './common.js';
import { secret } from '../util.js';

/** All switchable modules. `routes` = names of src/field/modules/<name>.js files (or core areas) the switch covers. */
export const MODULES = [
  { key: 'attendance', label: 'Attendance', bn: 'এটেন্ডেন্স', icon: 'fingerprint', routes: ['week', 'attendance'], roles: ['field', 'rm', 'purchase', 'manager', 'accountant', 'admin'] },
  { key: 'tracking', label: 'Live tracking', bn: 'লাইভ ট্র্যাকিং', icon: 'route', routes: ['track'], roles: ['field', 'rm', 'purchase', 'manager', 'accountant', 'admin'] },
  { key: 'team', label: 'Team live map', bn: 'টিম ম্যাপ', icon: 'map', routes: ['team'], roles: ['manager', 'admin'] },
  { key: 'leave', label: 'Leave', bn: 'ছুটি', icon: 'event_available', routes: ['leave'], roles: ['field', 'rm', 'purchase', 'manager', 'accountant', 'admin'] },
  { key: 'notifications', label: 'Notifications', bn: 'নোটিফিকেশন', icon: 'notifications', routes: ['notifications'], roles: ['field', 'rm', 'purchase', 'manager', 'accountant', 'admin'] },
  { key: 'expenses', label: 'Expenses', bn: 'খরচ', icon: 'receipt_long', routes: ['expenses', 'vouchers'], roles: ['field', 'rm', 'purchase', 'manager', 'accountant', 'admin'] },
  { key: 'approvals', label: 'Approvals', bn: 'অনুমোদন', icon: 'fact_check', routes: ['approvals'], roles: ['manager', 'accountant', 'admin'] },
  { key: 'customers', label: 'Customers', bn: 'গ্রাহক', icon: 'groups', routes: ['customers'], roles: ['rm', 'manager', 'admin'] },
  { key: 'visits', label: 'Visits & follow-ups', bn: 'ভিজিট ও ফলো-আপ', icon: 'event_note', routes: ['visits', 'followups'], roles: ['rm', 'manager', 'admin'] },
  { key: 'sales', label: 'Products & sales orders', bn: 'পণ্য ও বিক্রয় অর্ডার', icon: 'shopping_bag', routes: ['products', 'orders'], roles: ['rm', 'purchase', 'manager', 'accountant', 'admin'] },
  { key: 'delivery', label: 'Delivery', bn: 'ডেলিভারি', icon: 'local_shipping', routes: ['deliveries'], roles: ['rm', 'manager', 'accountant', 'admin'] },
  { key: 'collection', label: 'Payment collection', bn: 'পেমেন্ট কালেকশন', icon: 'payments', routes: ['payments'], roles: ['rm', 'manager', 'accountant', 'admin'] },
  { key: 'purchase', label: 'Purchase & PO', bn: 'ক্রয় ও পিও', icon: 'shopping_cart', routes: ['purchase'], roles: ['purchase', 'manager', 'accountant', 'admin'] },
  { key: 'reports', label: 'Reports', bn: 'রিপোর্ট', icon: 'bar_chart', routes: ['reports'], roles: ['field', 'rm', 'purchase', 'manager', 'accountant', 'admin'] },
  { key: 'contacts', label: 'Contacts & calls', bn: 'যোগাযোগ ও কল', icon: 'contacts', routes: ['contacts', 'calls'], roles: ['field', 'rm', 'purchase', 'manager', 'accountant', 'admin'] }
];
export const ALL_ROLES = ['admin', 'manager', 'accountant', 'purchase', 'rm', 'field'];
const BY_ROUTE = Object.fromEntries(MODULES.flatMap(m => m.routes.map(r => [r, m.key])));

let cache = null;
let loadedAt = 0;

export async function ensureModuleTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS field_module_config (
    module_key VARCHAR(30) PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    roles JSON NOT NULL,
    updated_by VARCHAR(120) NOT NULL DEFAULT '',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  for (const m of MODULES) {
    await pool.query('INSERT IGNORE INTO field_module_config (module_key, enabled, roles) VALUES (?, 1, ?)', [m.key, JSON.stringify(m.roles)]);
  }
}

/** Current switches: { key: { enabled, roles: [...] } }. Cached for 15 s so the gate costs no query on most requests. */
export async function moduleConfig(force = false) {
  if (!force && cache && Date.now() - loadedAt < 15000) return cache;
  const [rows] = await pool.query('SELECT module_key, enabled, roles FROM field_module_config');
  const next = {};
  for (const m of MODULES) next[m.key] = { enabled: true, roles: m.roles };
  for (const r of rows) {
    if (!next[r.module_key]) continue;
    let roles = r.roles;
    if (typeof roles === 'string') { try { roles = JSON.parse(roles); } catch { roles = next[r.module_key].roles; } }
    next[r.module_key] = { enabled: !!r.enabled, roles: Array.isArray(roles) ? roles : next[r.module_key].roles };
  }
  cache = next;
  loadedAt = Date.now();
  return cache;
}
export const dropModuleCache = () => { cache = null; };

/** May this app role use the module right now? The admin role can always use every module. */
export async function moduleAllowed(key, role) {
  if (!key) return true;
  const c = (await moduleConfig())[key];
  if (!c) return true;
  if (role === 'admin') return true;
  return c.enabled && c.roles.includes(role);
}

/** Express middleware: blocks a module's routes when the admin switched it off or it is not meant for this role. */
export const moduleGate = routeName => async (req, res, next) => {
  const key = BY_ROUTE[routeName];
  if (!key) return next();
  let t;
  try { t = jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), secret()); } catch { return next(); } // not signed in: the route's own guard answers 401
  try {
    if (await moduleAllowed(key, roleKey(t.srole))) return next();
    const label = MODULES.find(m => m.key === key)?.label || key;
    return res.status(403).json({ error: `${label} is turned off for your role. Ask your admin.`, moduleOff: key });
  } catch (e) {
    return next(e);
  }
};
