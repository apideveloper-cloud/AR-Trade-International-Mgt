// Role matrix: which role may do what in the admin console.
// The catalogue of permissions and the default grants live here; the live grants are in the `role_perms` table and are edited
// by the Master Admin in Admin > Roles. The Master Admin always has everything and cannot be edited.
import { pool } from './db.js';

export const MASTER = 'Master Admin';
export const MASTER_ONLY = 'roles.manage'; // never granted to anyone but the Master Admin

/** [key, group, label] */
export const PERMS = [
  ['dashboard.view', 'Overview', 'See the dashboard and sales figures'],
  ['orders.view', 'Sales', 'View orders'],
  ['orders.status', 'Sales', 'Change an order\'s status'],
  ['orders.delete', 'Sales', 'Delete cancelled orders'],
  ['customers.view', 'Sales', 'View customers'],
  ['customers.manage', 'Sales', 'Reset customer passwords'],
  ['products.view', 'Catalog', 'View products and categories'],
  ['products.manage', 'Catalog', 'Create, edit, hide products and change stock / price'],
  ['categories.manage', 'Catalog', 'Show or hide categories'],
  ['hub.view', 'Delivery', 'Delivery Hub board, returns and branches'],
  ['hub.dispatch', 'Delivery', 'Assign riders / couriers, cancel orders, decide returns'],
  ['hub.deliver', 'Delivery', 'Run own deliveries (rider app)'],
  ['hub.cash', 'Delivery', 'Confirm rider cash deposits'],
  ['services.manage', 'Engage', 'Service requests'],
  ['blog.manage', 'Engage', 'Write and publish blog articles'],
  ['pages.manage', 'Engage', 'Edit site pages and storefront content'],
  ['pages.delete', 'Engage', 'Delete site pages'],
  ['media.upload', 'Engage', 'Upload images'],
  ['reviews.moderate', 'Engage', 'Approve or reject product reviews'],
  ['messages.manage', 'Engage', 'Read and delete inbox and chat messages'],
  ['marketing.manage', 'Engage', 'Subscribers, campaigns and the Email Center'],
  ['marketing.setup', 'Engage', 'Email provider keys and sender address'],
  ['careers.manage', 'Engage', 'Jobs, applications and applicants\' CVs'],
  ['field.approve', 'Field & mobile app', 'Approve expense claims and see live staff tracking'],
  ['team.manage', 'System', 'Approve staff accounts and set their roles'],
  ['settings.manage', 'System', 'Store settings (fees, coupons, payments, contact)'],
  [MASTER_ONLY, 'System', 'Edit this role matrix']
];
export const PERM_KEYS = PERMS.map(p => p[0]);

/** Roles in the order they appear in the matrix. `legacy` roles existed before the matrix and are kept so existing accounts keep working. */
export const ROLE_DEFS = [
  { name: MASTER, icon: '★', desc: 'Full access to everything. The only role that can edit the role matrix.', locked: true },
  { name: 'Admin', icon: '◆', desc: 'Limited access: exactly what the Master Admin grants here.' },
  { name: 'Manager', icon: '☰', desc: 'Runs daily operations: orders, deliveries, approvals.' },
  { name: 'Accountant', icon: '৳', desc: 'Money side: order values, rider cash, expense claims.' },
  { name: 'Purchase Officer', icon: '▣', desc: 'Buying and stock: products, prices and stock levels.' },
  { name: 'RM', icon: '☺', desc: 'Relationship Manager: customers, enquiries, reviews and campaigns.' },
  { name: 'Field Officer', icon: '⚑', desc: 'Works in the mobile app (attendance, tracking, expenses). No admin console pages by default.' },
  { name: 'Delivery rider', icon: '🚚', desc: 'Existing role: sees pick-up orders and runs own deliveries.', legacy: true },
  { name: 'Marketing manager', icon: '✉', desc: 'Existing role: campaigns, subscribers, inbox, reviews.', legacy: true },
  { name: 'Content writer', icon: '✎', desc: 'Existing role: blog and site pages.', legacy: true }
];
export const ROLE_NAMES = ROLE_DEFS.map(r => r.name);
/** Roles that may be picked on the public "Request access" form (they still wait for approval). */
export const REGISTRABLE = ROLE_NAMES.filter(r => r !== MASTER && r !== 'Admin');
/** Old names from before the matrix, renamed in the database on startup. */
const RENAMED = { 'Super admin': MASTER, Accounts: 'Accountant', 'Field employee': 'Field Officer' };

const ALL_BUT_MASTER = PERM_KEYS.filter(k => k !== MASTER_ONLY);
export const DEFAULTS = {
  [MASTER]: PERM_KEYS,
  Admin: ALL_BUT_MASTER,
  Manager: ['dashboard.view', 'orders.view', 'orders.status', 'customers.view', 'products.view', 'hub.view', 'hub.dispatch', 'hub.cash', 'services.manage', 'reviews.moderate', 'messages.manage', 'field.approve'],
  Accountant: ['dashboard.view', 'orders.view', 'customers.view', 'products.view', 'hub.cash', 'field.approve'],
  'Purchase Officer': ['dashboard.view', 'orders.view', 'products.view', 'products.manage', 'media.upload'],
  RM: ['dashboard.view', 'orders.view', 'customers.view', 'services.manage', 'reviews.moderate', 'messages.manage', 'marketing.manage'],
  'Field Officer': [],
  'Delivery rider': ['orders.view', 'orders.status', 'hub.deliver'],
  'Marketing manager': ['reviews.moderate', 'messages.manage', 'marketing.manage'],
  'Content writer': ['blog.manage', 'pages.manage', 'media.upload']
};

let cache = new Map(); // role -> Set(perm)

export async function loadPermissions() {
  const [rows] = await pool.query("SELECT role, perm FROM role_perms WHERE perm <> '*seeded'");
  const m = new Map();
  rows.forEach(r => { if (!m.has(r.role)) m.set(r.role, new Set()); m.get(r.role).add(r.perm); });
  cache = m;
}

/** Creates the tables, migrates staff.role from the old ENUM and old role names, and seeds default grants for roles that have none yet. Safe to run on every start. */
export async function initPermissions() {
  await pool.query('CREATE TABLE IF NOT EXISTS role_perms (role VARCHAR(40) NOT NULL, perm VARCHAR(40) NOT NULL, PRIMARY KEY (role, perm))');
  await pool.query('CREATE TABLE IF NOT EXISTS role_log (id INT AUTO_INCREMENT PRIMARY KEY, role VARCHAR(40) NOT NULL, staff_id INT NULL, staff_name VARCHAR(120) NOT NULL DEFAULT \'\', what VARCHAR(255) NOT NULL, at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const [[col]] = await pool.query("SELECT DATA_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'role'");
  if (col) {
    if (String(col.t).toLowerCase() === 'enum') await pool.query("ALTER TABLE staff MODIFY role VARCHAR(40) NOT NULL DEFAULT 'Delivery rider'");
    for (const [from, to] of Object.entries(RENAMED)) await pool.query('UPDATE staff SET role = ? WHERE role = ?', [to, from]);
  }
  const [seeded] = await pool.query("SELECT role FROM role_perms WHERE perm = '*seeded'");
  const have = new Set(seeded.map(r => r.role));
  for (const role of ROLE_NAMES) {
    if (have.has(role)) continue;
    const rows = [[role, '*seeded'], ...DEFAULTS[role].map(p => [role, p])];
    await pool.query('INSERT IGNORE INTO role_perms (role, perm) VALUES ?', [rows]);
  }
  await loadPermissions();
}

export const permsOf = role => (role === MASTER ? new Set(PERM_KEYS) : new Set([...(cache.get(role) || [])].filter(p => p !== MASTER_ONLY)));
/** Does this staff member hold the permission (or any of a list of permissions)? */
export const can = (staff, perm) => {
  const set = permsOf(staff?.role);
  return [].concat(perm).some(p => set.has(p));
};

export async function matrix() {
  const [members] = await pool.query('SELECT role, COUNT(*) n, SUM(status = "Active") active FROM staff GROUP BY role');
  const [log] = await pool.query('SELECT role, staff_name, what, at FROM role_log ORDER BY id DESC LIMIT 25');
  return {
    perms: PERMS.map(([key, group, label]) => ({ key, group, label })),
    roles: ROLE_DEFS.map(r => ({ ...r, perms: [...permsOf(r.name)], members: Number(members.find(m => m.role === r.name)?.n || 0), active: Number(members.find(m => m.role === r.name)?.active || 0) })),
    log: log.map(l => ({ role: l.role, by: l.staff_name, what: l.what, at: l.at }))
  };
}

export async function saveRole(role, perms, staff) {
  const next = new Set((Array.isArray(perms) ? perms : []).filter(p => PERM_KEYS.includes(p) && p !== MASTER_ONLY));
  const before = permsOf(role);
  await pool.query('DELETE FROM role_perms WHERE role = ?', [role]);
  await pool.query('INSERT INTO role_perms (role, perm) VALUES ?', [[[role, '*seeded'], ...[...next].map(p => [role, p])]]);
  await loadPermissions();
  const added = [...next].filter(p => !before.has(p)), removed = [...before].filter(p => !next.has(p));
  if (added.length || removed.length) {
    const what = [added.length ? 'granted ' + added.join(', ') : '', removed.length ? 'revoked ' + removed.join(', ') : ''].filter(Boolean).join('; ').slice(0, 255);
    await pool.query('INSERT INTO role_log (role, staff_id, staff_name, what) VALUES (?,?,?,?)', [role, staff.id, staff.name, what]);
  }
  return [...next];
}
