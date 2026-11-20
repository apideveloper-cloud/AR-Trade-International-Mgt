// Backlink and citation tracker (Search & Growth, Phase 6): the table, validation, the starter checklist and CRUD. The weekly link checker is in linkCheck.js.
import { pool } from '../db.js';
import { fail } from '../util.js';

export const KINDS = ['citation', 'backlink', 'social', 'press', 'supplier'];
export const STATUSES = ['Planned', 'Submitted', 'Live', 'Lost', 'Rejected'];
/** Accepts any letter case of a known value ('live' -> 'Live'); anything else comes back unchanged so validation rejects it. */
const canon = (list, v) => list.find(x => x.toLowerCase() === String(v ?? '').trim().toLowerCase()) || String(v ?? '');

/** Ideas only: no addresses are invented. Staff add the real page address once they have registered. */
export const STARTER = [
  { kind: 'citation', name: 'Google Business Profile', note: 'Free listing that shows your shop on Google Search and Maps.' },
  { kind: 'citation', name: 'Bing Places for Business', note: 'Free listing for Bing and Microsoft Maps.' },
  { kind: 'citation', name: 'Apple Business Connect', note: 'Free listing for Apple Maps and Siri.' },
  { kind: 'social', name: 'Facebook business page', note: 'Put your website address in the About section.' },
  { kind: 'social', name: 'LinkedIn company page', note: 'Put your website address on the company page.' },
  { kind: 'social', name: 'YouTube channel', note: 'Add your website to the channel links and to video descriptions.' },
  { kind: 'social', name: 'Instagram business account', note: 'Put your website address in the profile.' },
  { kind: 'supplier', name: 'Your authorised-reseller listings on supplier sites', note: 'Ask HP, Canon, Epson, Brother, Toshiba or Sharp whether they list authorised sellers in Bangladesh.' },
  { kind: 'citation', name: 'A local business directory or chamber of commerce listing', note: 'Choose directories you trust; keep your name, address and phone exactly the same.' },
  { kind: 'press', name: 'Local news or blog mention', note: 'Ask a local news site or blogger to link to your shop.' },
];

const defaultQuery = (sql, p) => pool.query(sql, p);
let ready = false;
export async function ensureBacklinks(q = defaultQuery) {
  if (ready) return;
  await q(`CREATE TABLE IF NOT EXISTS growth_backlinks (
    id INT AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(12) NOT NULL DEFAULT 'backlink', name VARCHAR(120) NOT NULL, url VARCHAR(500) NOT NULL DEFAULT '',
    target VARCHAR(300) NOT NULL DEFAULT '/', anchor VARCHAR(160) NOT NULL DEFAULT '', status VARCHAR(10) NOT NULL DEFAULT 'Planned',
    link_found TINYINT NULL, rel VARCHAR(60) NOT NULL DEFAULT '', http_status SMALLINT NULL, last_checked DATETIME NULL, fail_count TINYINT NOT NULL DEFAULT 0,
    notes VARCHAR(500) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_gb_status (status))`, []);
  ready = true;
}
export const _resetReady = () => { ready = false; };

const str = (v, max, label, { required = false } = {}) => {
  if (v != null && typeof v !== 'string') throw fail(400, `${label} must be text`);
  const s = (v || '').trim();
  if (required && !s) throw fail(400, `${label} is required`);
  if (s.length > max) throw fail(400, `${label} must be at most ${max} characters`);
  return s;
};
const isHttpUrl = s => { try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname; } catch { return false; } };

/** Validates a create or partial-update body. host = our preferred domain host ('' when unknown). Returns only the fields that were given (create: with defaults). */
export function validateLink(body, { partial = false, host = '' } = {}) {
  const b = body && typeof body === 'object' ? body : {}, out = {}, has = k => b[k] !== undefined;
  if (!partial || has('name')) out.name = str(b.name, 120, 'Name', { required: true });
  if (!partial || has('kind')) { const k = has('kind') ? canon(KINDS, b.kind) : 'backlink'; if (!KINDS.includes(k)) throw fail(400, 'Kind must be one of: ' + KINDS.join(', ')); out.kind = k; }
  if (!partial || has('url')) { const u = str(b.url, 500, 'Page address'); if (u && !isHttpUrl(u)) throw fail(400, 'Page address must start with http:// or https://'); out.url = u; }
  if (!partial || has('target')) {
    const t = str(b.target, 300, 'Target page') || '/';
    const bad = () => fail(400, 'Target page must be a path like /products or a https:// address on your own site');
    if (t.startsWith('/')) { if (t.startsWith('//') || t.startsWith('/\\')) throw bad(); }
    else {
      let u; try { u = new URL(t); } catch { u = null; }
      if (!u || u.protocol !== 'https:' || !host || u.hostname.toLowerCase() !== host.toLowerCase() || u.username || u.password) throw bad();
    }
    out.target = t;
  }
  if (!partial || has('anchor')) out.anchor = str(b.anchor, 160, 'Link text');
  if (!partial || has('status')) { const s = has('status') ? canon(STATUSES, b.status) : 'Planned'; if (!STATUSES.includes(s)) throw fail(400, 'Status must be one of: ' + STATUSES.join(', ')); out.status = s; }
  if (!partial || has('notes')) out.notes = str(b.notes, 500, 'Notes');
  return out;
}

export const rowOut = r => ({
  id: r.id, kind: r.kind, name: r.name, url: r.url, target: r.target, anchor: r.anchor, status: r.status,
  linkFound: r.link_found == null ? null : !!r.link_found, rel: r.rel || '', httpStatus: r.http_status ?? null,
  lastChecked: r.last_checked || null, notes: r.notes || '', createdAt: r.created_at || null,
});

export async function getBacklink(id, q = defaultQuery) {
  await ensureBacklinks(q);
  const [r] = await q('SELECT * FROM growth_backlinks WHERE id = ?', [id]);
  return r[0] || null;
}
const COLS = ['kind', 'name', 'url', 'target', 'anchor', 'status', 'notes'];
export async function createBacklink(input, q = defaultQuery) {
  await ensureBacklinks(q);
  const [dup] = await q('SELECT id FROM growth_backlinks WHERE name = ?', [input.name]);
  if (dup.length) throw fail(409, 'An entry with this name already exists');
  const [r] = await q(`INSERT INTO growth_backlinks (${COLS.join(', ')}) VALUES (${COLS.map(() => '?').join(', ')})`, COLS.map(c => input[c] ?? ''));
  return getBacklink(r.insertId, q);
}
export async function updateBacklink(id, input, q = defaultQuery) {
  const cur = await getBacklink(id, q);
  if (!cur) throw fail(404, 'Entry not found');
  const keys = COLS.filter(c => input[c] !== undefined);
  if (input.name !== undefined && input.name !== cur.name) { const [dup] = await q('SELECT id FROM growth_backlinks WHERE name = ?', [input.name]); if (dup.length) throw fail(409, 'An entry with this name already exists'); }
  const sets = keys.map(k => `${k} = ?`), vals = keys.map(k => input[k]);
  // a changed page address or target makes the old check result meaningless; changing the status by hand resets the strikes
  if ((input.url !== undefined && input.url !== cur.url) || (input.target !== undefined && input.target !== cur.target)) sets.push('link_found = NULL', 'http_status = NULL', "rel = ''", 'fail_count = 0');
  else if (input.status !== undefined && input.status !== cur.status) sets.push('fail_count = 0');
  if (sets.length) await q(`UPDATE growth_backlinks SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  return getBacklink(id, q);
}
export async function deleteBacklink(id, q = defaultQuery) {
  await ensureBacklinks(q);
  const [r] = await q('DELETE FROM growth_backlinks WHERE id = ?', [id]);
  if (!r.affectedRows) throw fail(404, 'Entry not found');
  return true;
}
export async function addFromStarter(name, q = defaultQuery) {
  const s = STARTER.find(x => x.name === String(name || '').trim());
  if (!s) throw fail(400, 'Unknown starter item');
  return createBacklink({ kind: s.kind, name: s.name, url: '', target: '/', anchor: '', status: 'Planned', notes: s.note }, q);
}

const like = s => '%' + s.replace(/[\\%_]/g, m => '\\' + m) + '%';
export async function listBacklinks({ status = '', kind = '', q: search = '', page = 1, limit = 15 } = {}, q = defaultQuery) {
  await ensureBacklinks(q);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  page = Math.max(1, parseInt(page, 10) || 1);
  const where = [], p = [];
  if (STATUSES.includes(canon(STATUSES, status))) { where.push('status = ?'); p.push(canon(STATUSES, status)); }
  if (KINDS.includes(canon(KINDS, kind))) { where.push('kind = ?'); p.push(canon(KINDS, kind)); }
  const s = String(search || '').trim().slice(0, 100);
  if (s) { where.push('(name LIKE ? OR url LIKE ? OR notes LIKE ?)'); p.push(like(s), like(s), like(s)); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const [[c]] = await q('SELECT COUNT(*) AS n FROM growth_backlinks' + w, p);
  const total = Number(c?.n) || 0, pages = Math.max(1, Math.ceil(total / limit));
  page = Math.min(page, pages);
  const [rows] = await q('SELECT * FROM growth_backlinks' + w + ' ORDER BY id DESC LIMIT ? OFFSET ?', [...p, limit, (page - 1) * limit]);
  const [cs] = await q('SELECT status, COUNT(*) AS n FROM growth_backlinks GROUP BY status', []);
  const counts = { planned: 0, submitted: 0, live: 0, lost: 0, rejected: 0 };
  for (const x of cs) if (x.status && x.status.toLowerCase() in counts) counts[x.status.toLowerCase()] = Number(x.n);
  const [names] = await q('SELECT name FROM growth_backlinks', []);
  const have = new Set(names.map(n => n.name));
  const [[lr]] = await q('SELECT MAX(last_checked) AS t FROM growth_backlinks', []);
  return { rows: rows.map(rowOut), total, page, pages, counts, starter: STARTER.map(x => ({ ...x, added: have.has(x.name) })), lastRunAt: lr?.t || null };
}
