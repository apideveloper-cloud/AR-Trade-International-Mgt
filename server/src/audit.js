// Audit log: one row for every change made through the admin console, inventory, email, delivery hub and field-app APIs.
// A single middleware records it once the response is sent, so no route can forget to log. Reading needs audit.view.
//   Recorded: who (staff, role), what (module, action, target), the request details (secrets and long values removed),
//   whether it worked, and from where (IP, browser). Rows older than RETENTION_DAYS are deleted daily.
import { Router } from 'express';
import { pool } from './db.js';
import { guard } from './admin.js';
import { fail, wrap } from './util.js';

export const RETENTION_DAYS = Number(process.env.AUDIT_KEEP_DAYS || 365);
const PREFIX = /^\/api\/(admin|inv|mkt|hub|field)(\/|$)/;
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP = [/^\/api\/field\/track\b/, /\/read(-all)?$/, /^\/api\/admin\/audit\b/, /^\/api\/mkt\/preview$/]; // GPS pings, "mark notification read" and email previews change nothing; reading the log is not logged
const OPENED = /(\.pdf|\/download|\/cv)$/; // documents are logged when they are opened or downloaded
const SECRET_KEY = /pass|token|secret|api_?key|otp|signature|pin\b|authorization|hash/i;

export async function ensureAudit() {
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    staff_id INT NULL, staff_name VARCHAR(120) NOT NULL DEFAULT '', staff_role VARCHAR(40) NOT NULL DEFAULT '',
    module VARCHAR(40) NOT NULL DEFAULT '', action VARCHAR(60) NOT NULL DEFAULT '', entity VARCHAR(40) NOT NULL DEFAULT '', entity_id VARCHAR(80) NOT NULL DEFAULT '',
    method VARCHAR(8) NOT NULL DEFAULT '', path VARCHAR(255) NOT NULL DEFAULT '', status SMALLINT NOT NULL DEFAULT 0, ok TINYINT(1) NOT NULL DEFAULT 1, error VARCHAR(255) NOT NULL DEFAULT '',
    summary VARCHAR(500) NOT NULL DEFAULT '', detail MEDIUMTEXT NULL, ip VARCHAR(45) NOT NULL DEFAULT '', agent VARCHAR(200) NOT NULL DEFAULT '',
    KEY idx_at (at), KEY idx_staff (staff_id, at), KEY idx_module (module, at), KEY idx_ok (ok, at)
  )`);
}

// ---------- describing a request in plain words ----------
const NOUN = {
  orders: 'Order', products: 'Product', categories: 'Category', customers: 'Customer', 'password-resets': 'Password reset', services: 'Service request', blog: 'Blog article', 'upload-image': 'Image',
  pages: 'Site page', content: 'Site content', reviews: 'Review', messages: 'Message', subscribers: 'Subscriber', consents: 'Consent', jobs: 'Job', applications: 'Application',
  staff: 'Staff account', roles: 'Role', settings: 'Settings', backups: 'Backup', login: 'Sign-in', register: 'Access request',
  vendors: 'Vendor', receipts: 'Purchase', damages: 'Damage record', returns: 'Vendor return', payments: 'Vendor payment', stock: 'Stock',
  campaigns: 'Campaign', automations: 'Automation', audience: 'Subscriber', setup: 'Email setup', templates: 'Template',
  riders: 'Rider', expenses: 'Expense', attendance: 'Attendance', purchase: 'Purchase order', leave: 'Leave', visits: 'Visit', customersf: 'Customer'
};
const VERB = {
  status: 'Changed status', comments: 'Added comment', decision: 'Decided', send: 'Sent', email: 'Emailed', password: 'Set password', 'reset-link': 'Created reset link', 'make-master': 'Made Master Admin',
  dir: 'Changed folder', confirm: 'Confirmed', submit: 'Submitted', reopen: 'Reopened', cancel: 'Cancelled', approve: 'Approved', deposit: 'Recorded deposit', flow: 'Moved stage', rider: 'Assigned rider',
  courier: 'Assigned courier', deliver: 'Delivered', fail: 'Marked failed', adjust: 'Adjusted', convert: 'Converted', start: 'Started', done: 'Completed', checkin: 'Checked in', reset: 'Reset',
  details: 'Updated details', login: 'Signed in', register: 'Requested access', verify: 'Verified', quotes: 'Added quote', messages: 'Posted message', photo: 'Updated photo', profile: 'Updated profile', specs: 'Updated specs'
};
const human = s => String(s || '').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());

function module_(root, first) {
  if (root === 'inv') return 'Purchasing & stock';
  if (root === 'mkt') return 'Email Center';
  if (root === 'hub') return 'Delivery Hub';
  if (root === 'field') return 'Field app';
  if (['login', 'register'].includes(first)) return 'Security';
  if (['orders', 'deliveries'].includes(first)) return 'Orders';
  if (['products', 'categories'].includes(first)) return 'Catalog';
  if (['customers', 'password-resets'].includes(first)) return 'Customers';
  if (['blog', 'pages', 'content', 'upload-image', 'services'].includes(first)) return 'Content';
  if (['reviews', 'messages', 'subscribers', 'consents'].includes(first)) return 'Engage';
  if (['jobs', 'applications'].includes(first)) return 'Careers';
  return 'System';
}

/** { module, action, entity, entityId } for a request, from its route pattern (/api/admin/orders/:id/status) and params. */
function describe(method, pattern, params, payload, query) {
  const segs = pattern.replace(/^\/api\//, '').split('/').filter(Boolean);
  const root = segs[0], rest = segs.slice(1);
  const resource = rest.find(x => !x.startsWith(':')) || root;
  const named = rest.filter(x => !x.startsWith(':'));
  const last = named[named.length - 1];
  const viewing = method === 'GET';
  let action = viewing ? 'Opened' : VERB[last] && named.length > 1 || (VERB[last] && ['login', 'register', 'reset', 'dir', 'adjust', 'send'].includes(last)) ? VERB[last] : method === 'POST' ? 'Created' : method === 'DELETE' ? 'Deleted' : 'Updated';
  if (viewing && /invoice\.pdf$/.test(pattern)) action = 'Opened invoice';
  else if (viewing && /\/download$/.test(pattern)) action = 'Downloaded';
  else if (viewing && /\/cv$/.test(pattern)) action = 'Downloaded CV';
  else if (viewing && /\.pdf$/.test(pattern)) action = 'Opened document';
  if (method === 'PUT' && last === 'details') action = 'Updated details';
  const idKey = Object.keys(params || {}).find(k => ['id', 'email', 'key', 'name', 'orderId'].includes(k));
  const fromBody = payload && typeof payload === 'object' ? (payload.id ?? payload.order?.id) : undefined;
  let entityId = String((idKey ? params[idKey] : '') || (method === 'POST' ? fromBody ?? '' : '') || query?.productId || '');
  if (resource === 'stock' && last === 'adjust') entityId = String(query?.productId || entityId);
  const subResource = named.length > 1 && !VERB[last] ? named[named.length - 1] : '';
  return { module: module_(root, resource), action, entity: NOUN[subResource] || NOUN[resource] || human(resource), entityId: entityId.slice(0, 80) };
}

// ---------- keeping the stored details safe and short ----------
function clean(v, depth = 0) {
  if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.startsWith('data:') || v.length > 200 ? `(${v.length} characters)` : v;
  if (depth >= 3) return '(nested)';
  if (Array.isArray(v)) return v.slice(0, 10).map(x => clean(x, depth + 1)).concat(v.length > 10 ? [`… ${v.length - 10} more`] : []);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).slice(0, 30).map(([k, x]) => [k, SECRET_KEY.test(k) ? '••••' : clean(x, depth + 1)]));
  return String(v);
}
/** "status: Packed · remarks: Ready for pickup": the first few plain values of the request, for the list view. */
function summarise(body) {
  if (!body || typeof body !== 'object') return '';
  const parts = [];
  for (const [k, v] of Object.entries(body)) {
    if (parts.length >= 4) break;
    if (SECRET_KEY.test(k) || v == null || v === '' || typeof v === 'object') continue;
    parts.push(`${k}: ${String(v).length > 70 ? String(v).slice(0, 67) + '…' : v}`);
  }
  return parts.join(' · ').slice(0, 480);
}

/** Records the request once it has been answered. Never slows or breaks the request: failures to log are only printed. */
export function auditMiddleware(req, res, next) {
  const url = req.originalUrl.split('?')[0];
  const wanted = PREFIX.test(url) && !SKIP.some(r => r.test(url)) && (MUTATING.has(req.method) || (req.method === 'GET' && OPENED.test(url)));
  if (!wanted) return next();
  let payload;
  const json = res.json.bind(res);
  res.json = b => { payload = b; return json(b); };
  res.on('finish', () => {
    record(req, res, url, payload).catch(e => console.error('audit log failed:', e.message));
  });
  next();
}

async function record(req, res, url, payload) {
  const pattern = req.route ? (req.baseUrl || '') + (typeof req.route.path === 'string' ? req.route.path : '') : url;
  const d = describe(req.method, pattern, req.params, payload, req.body);
  const signedIn = req.staff || payload?.staff;
  const ok = res.statusCode < 400;
  const body = req.body && Object.keys(req.body).length ? clean(req.body) : null;
  const tried = d.action === 'Signed in' && !signedIn ? String(req.body?.id || '').slice(0, 120) : '';
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace(/^::ffff:/, '').slice(0, 45);
  await pool.query(
    'INSERT INTO audit_log (staff_id, staff_name, staff_role, module, action, entity, entity_id, method, path, status, ok, error, summary, detail, ip, agent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [signedIn?.id ?? null, signedIn?.name || tried || '', signedIn?.role || '', d.module, d.action, d.entity, d.entityId, req.method, url.slice(0, 255), res.statusCode, ok ? 1 : 0, ok ? '' : String(payload?.error || '').slice(0, 255),
      summarise(body), body ? JSON.stringify(body).slice(0, 8000) : null, ip, String(req.headers['user-agent'] || '').slice(0, 200)]
  );
}

/** For events that do not come from an HTTP request (for example the automatic backups). */
export async function auditEvent({ module = 'System', action, entity = '', entityId = '', ok = true, summary = '', staff = null }) {
  try {
    await pool.query('INSERT INTO audit_log (staff_id, staff_name, staff_role, module, action, entity, entity_id, method, ok, summary) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [staff?.id ?? null, staff?.name || 'System', staff?.role || '', module, action, entity, entityId, 'SYS', ok ? 1 : 0, String(summary).slice(0, 480)]);
  } catch (e) { console.error('audit event failed:', e.message); }
}

export function startAuditPrune() {
  const run = () => pool.query('DELETE FROM audit_log WHERE at < DATE_SUB(NOW(), INTERVAL ? DAY)', [RETENTION_DAYS]).catch(e => console.error('audit prune failed:', e.message));
  setTimeout(run, 60000).unref();
  setInterval(run, 24 * 3600e3).unref();
}

// ---------- reading the log ----------
const router = Router();
const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(Date.parse(v + 'T00:00:00Z')) ? String(v) : null);

router.get('/', guard('audit.view'), wrap(async (req, res) => {
  const size = Math.min(5000, Math.max(1, parseInt(req.query.size, 10) || 25));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const cond = [], args = [];
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q) { const l = `%${q}%`; cond.push('(staff_name LIKE ? OR action LIKE ? OR entity LIKE ? OR entity_id LIKE ? OR summary LIKE ? OR path LIKE ?)'); args.push(l, l, l, l, l, l); }
  if (parseInt(req.query.staff, 10)) { cond.push('staff_id = ?'); args.push(parseInt(req.query.staff, 10)); }
  if (req.query.module) { cond.push('module = ?'); args.push(String(req.query.module).slice(0, 40)); }
  if (req.query.result === 'ok') cond.push('ok = 1');
  if (req.query.result === 'failed') cond.push('ok = 0');
  if (day(req.query.from)) { cond.push('at >= ?'); args.push(day(req.query.from) + ' 00:00:00'); }
  if (day(req.query.to)) { cond.push('at < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(day(req.query.to)); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM audit_log ${where}`, args);
  const [rows] = await pool.query(`SELECT id, at, staff_id, staff_name, staff_role, module, action, entity, entity_id, method, status, ok, error, summary, ip FROM audit_log ${where} ORDER BY id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, args);
  const [[s]] = await pool.query(`SELECT COALESCE(SUM(DATE(at) = CURDATE()), 0) today, COALESCE(SUM(DATE(at) = CURDATE() AND ok = 0), 0) failed,
    COUNT(DISTINCT CASE WHEN DATE(at) = CURDATE() THEN staff_id END) staff_today, COALESCE(SUM(at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)), 0) week FROM audit_log`);
  const [staff] = await pool.query("SELECT DISTINCT staff_id id, staff_name name FROM audit_log WHERE staff_id IS NOT NULL ORDER BY staff_name");
  const [modules] = await pool.query('SELECT DISTINCT module FROM audit_log ORDER BY module');
  res.json({
    total: Number(n), keepDays: RETENTION_DAYS,
    summary: { today: Number(s.today), failed: Number(s.failed), staffToday: Number(s.staff_today), week: Number(s.week) },
    staff, modules: modules.map(m => m.module),
    rows: rows.map(r => ({ id: Number(r.id), at: r.at, staffId: r.staff_id, staff: r.staff_name, role: r.staff_role, module: r.module, action: r.action, entity: r.entity, entityId: r.entity_id, method: r.method, status: r.status, ok: !!r.ok, error: r.error, summary: r.summary, ip: r.ip }))
  });
}));

router.get('/:id', guard('audit.view'), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT * FROM audit_log WHERE id = ?', [req.params.id]);
  if (!r) throw fail(404, 'Log entry not found');
  let detail; try { detail = r.detail ? JSON.parse(r.detail) : null; } catch { detail = r.detail; }
  res.json({ id: Number(r.id), at: r.at, staffId: r.staff_id, staff: r.staff_name, role: r.staff_role, module: r.module, action: r.action, entity: r.entity, entityId: r.entity_id, method: r.method, path: r.path, status: r.status, ok: !!r.ok, error: r.error, summary: r.summary, detail, ip: r.ip, agent: r.agent });
}));

export { router as auditRouter };
