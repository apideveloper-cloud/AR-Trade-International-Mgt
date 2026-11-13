// People who start the shop chat leave their name, mobile, usage type (personal, office or reseller) and location first. They are kept as a list of
// upcoming customers for the sellers and for marketing (Admin > Inbox > Chat leads).
import crypto from 'node:crypto';
import { pool } from './db.js';
import { bdMobile, fail, wrap } from './util.js';
import { like, page } from './adminHelpers.js';
import { parseUserAgent } from './userAgent.js';
import { lookupPlace } from './geoIp.js';

export const LEAD_STATUS = ['New', 'Contacted', 'Customer', 'Not interested'];

export async function ensureChatLeads() {
  await pool.query(`CREATE TABLE IF NOT EXISTS chat_leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token CHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    gender VARCHAR(12) NOT NULL DEFAULT '',
    location VARCHAR(160) NOT NULL DEFAULT '',
    marketing_ok TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'New',
    note VARCHAR(1000) NOT NULL DEFAULT '',
    handled_by VARCHAR(120) NOT NULL DEFAULT '',
    msg_count INT NOT NULL DEFAULT 0,
    last_message VARCHAR(300) NOT NULL DEFAULT '',
    interest VARCHAR(60) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_chat_leads_phone (phone),
    UNIQUE KEY uq_chat_leads_token (token),
    KEY ix_chat_leads_seen (last_seen_at)
  )`);
  // older tables have no usage type yet
  const [[c]] = await pool.query("SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_leads' AND column_name = 'usage_type'");
  if (!c.n) await pool.query("ALTER TABLE chat_leads ADD COLUMN usage_type VARCHAR(12) NOT NULL DEFAULT '' AFTER location");
  // where the visitor was and what they used, for marketing and for the seller's next call (all additive)
  const [have] = await pool.query("SELECT column_name c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'chat_leads'");
  const names = new Set(have.map(r => r.c));
  const cols = [['lat', 'DECIMAL(9,6) NULL'], ['lng', 'DECIMAL(9,6) NULL'], ['loc_acc', 'INT NULL'], ['ip', "VARCHAR(45) NOT NULL DEFAULT ''"],
    ['device', "VARCHAR(12) NOT NULL DEFAULT ''"], ['os', "VARCHAR(40) NOT NULL DEFAULT ''"], ['browser', "VARCHAR(40) NOT NULL DEFAULT ''"], ['tech', 'TEXT NULL'], ['ip_place', "VARCHAR(120) NOT NULL DEFAULT ''"]];
  for (const [col, ddl] of cols) if (!names.has(col)) await pool.query(`ALTER TABLE chat_leads ADD COLUMN ${col} ${ddl}`);
}

export const USAGE_TYPES = ['Personal', 'Office', 'Reseller'];

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Checks the start-of-chat form; throws a message the visitor can act on. */
export function readLeadForm(body) {
  const name = clean(body.name, 120), phone = bdMobile(body.phone), location = clean(body.location, 160);
  if (name.length < 2) throw fail(400, 'Please enter your name');
  if (!phone) throw fail(400, 'Enter a valid mobile number (01XXXXXXXXX)');
  const usage = USAGE_TYPES.includes(body.usage) ? body.usage : 'Personal';
  return { name, phone, location, usage, marketing: !!body.marketing, geo: readGeo(body.geo), tech: readTech(body.tech) };
}

/** The exact position, only when the visitor allowed their browser to share it; anything out of range is dropped. */
export function readGeo(g) {
  // null or '' would read as 0, which is a real place in the sea: only an actual number or numeric text counts
  const given = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''));
  if (!g || !given(g.lat) || !given(g.lng)) return null;
  const lat = Number(g.lat), lng = Number(g.lng), acc = given(g.acc) ? Math.round(Number(g.acc)) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6), acc: Number.isFinite(acc) && acc >= 0 ? Math.min(acc, 100000) : null };
}

const TECH_KEYS = { screen: 24, lang: 20, tz: 50, ref: 200, landing: 200, page: 200, utm_source: 60, utm_medium: 60, utm_campaign: 80, utm_term: 80, utm_content: 80 };
/** What the browser tells us about the visit (screen, language, time zone, where they came from): short text only. */
export function readTech(t) {
  const out = {};
  if (t && typeof t === 'object') for (const [k, max] of Object.entries(TECH_KEYS)) { const v = clean(t[k], max); if (v) out[k] = v; }
  return out;
}

/** Public: the form that opens a chat. The same mobile number returns to its own record. */
export async function startLead(body, req) {
  const f = readLeadForm(body);
  const ua = parseUserAgent(req?.headers?.['user-agent']), ip = String(req?.ip || '').replace(/^::ffff:/, '').slice(0, 45);
  const token = crypto.randomBytes(16).toString('hex');
  // a number that is already on the list keeps its first details (a stranger typing someone's number cannot rewrite them);
  // only "last seen" and the offers consent are refreshed, and the visitor gets that record's token back
  await pool.query(
    `INSERT INTO chat_leads (token, name, phone, location, usage_type, marketing_ok, lat, lng, loc_acc, ip, device, os, browser, tech) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE marketing_ok = GREATEST(marketing_ok, VALUES(marketing_ok)), last_seen_at = NOW(),
       lat = IFNULL(lat, VALUES(lat)), lng = IFNULL(lng, VALUES(lng)), loc_acc = IFNULL(loc_acc, VALUES(loc_acc)),
       ip = IF(ip = '', VALUES(ip), ip), device = IF(device = '', VALUES(device), device), os = IF(os = '', VALUES(os), os),
       browser = IF(browser = '', VALUES(browser), browser), tech = IFNULL(tech, VALUES(tech))`,
    [token, f.name, f.phone, f.location, f.usage, f.marketing ? 1 : 0, f.geo?.lat ?? null, f.geo?.lng ?? null, f.geo?.acc ?? null, ip, ua.device, ua.os, ua.browser, Object.keys(f.tech).length ? JSON.stringify(f.tech) : null]);
  const [[lead]] = await pool.query('SELECT token, name FROM chat_leads WHERE phone = ?', [f.phone]);
  // the place behind the IP is looked up after the visitor is already in the chat (and only if a lookup service is set)
  lookupPlace(ip).then(place => place && pool.query("UPDATE chat_leads SET ip_place = ? WHERE phone = ? AND ip_place = ''", [place, f.phone])).catch(() => {});
  return lead;
}

/** The lead behind a chat token, or null. */
export async function leadByToken(token) {
  if (!/^[0-9a-f]{32}$/.test(String(token || ''))) return null;
  const [[l]] = await pool.query('SELECT id, name, phone FROM chat_leads WHERE token = ?', [token]);
  return l || null;
}

/** Counts a message on the lead and remembers what they asked about (shown to the seller). */
export async function noteLeadMessage(id, text, cat) {
  await pool.query('UPDATE chat_leads SET msg_count = msg_count + 1, last_message = ?, interest = IF(? <> "", ?, interest), last_seen_at = NOW() WHERE id = ?',
    [clean(text, 300), cat || '', cat || '', id]);
}

export function mountChatLeadAdmin(router, guard) {
  router.get('/chat-leads', guard('messages.manage'), wrap(async (req, res) => {
    const { size, offset } = page(req);
    const cond = [], params = [];
    if (req.query.q) { cond.push('(name LIKE ? OR phone LIKE ? OR location LIKE ? OR last_message LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q), like(req.query.q)); }
    if (LEAD_STATUS.includes(req.query.status)) { cond.push('status = ?'); params.push(req.query.status); }
    if (req.query.marketing === '1') cond.push('marketing_ok = 1');
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM chat_leads ${where}`, params);
    const [rows] = await pool.query(`SELECT * FROM chat_leads ${where} ORDER BY last_seen_at DESC LIMIT ${size} OFFSET ${offset}`, params);
    const [[t]] = await pool.query('SELECT COUNT(*) total, SUM(status = "New") fresh, SUM(status = "Customer") customers, SUM(marketing_ok) marketing, SUM(created_at >= NOW() - INTERVAL 7 DAY) week FROM chat_leads');
    res.json({ total: n, stats: { total: +t.total, fresh: +(t.fresh || 0), customers: +(t.customers || 0), marketing: +(t.marketing || 0), week: +(t.week || 0) }, rows: rows.map(outLead) });
  }));
  // the whole list (not one page) for a spreadsheet: sellers' call list or a marketing mailing
  router.get('/chat-leads/export', guard('messages.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM chat_leads ORDER BY created_at DESC LIMIT 20000');
    res.json({ rows: rows.map(outLead) });
  }));
  router.put('/chat-leads/:id', guard('messages.manage'), wrap(async (req, res) => {
    const [[l]] = await pool.query('SELECT id FROM chat_leads WHERE id = ?', [req.params.id]);
    if (!l) throw fail(404, 'Lead not found');
    const sets = [], vals = [];
    if ('status' in req.body) {
      if (!LEAD_STATUS.includes(req.body.status)) throw fail(400, 'Unknown status');
      sets.push('status = ?', 'handled_by = ?'); vals.push(req.body.status, req.body.status === 'New' ? '' : req.staff.name);
    }
    if ('note' in req.body) { sets.push('note = ?'); vals.push(clean(req.body.note, 1000)); }
    if (!sets.length) throw fail(400, 'Nothing to update');
    await pool.query(`UPDATE chat_leads SET ${sets.join(', ')} WHERE id = ?`, [...vals, l.id]);
    res.json({ ok: true });
  }));
  router.delete('/chat-leads/:id', guard('messages.manage'), wrap(async (req, res) => { await pool.query('DELETE FROM chat_leads WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));
}

const outLead = r => ({ id: r.id, name: r.name, phone: r.phone, location: r.location, usage: r.usage_type || '', lat: r.lat == null ? null : +r.lat, lng: r.lng == null ? null : +r.lng, accuracy: r.loc_acc, ip: r.ip || '', ipPlace: r.ip_place || '', device: r.device || '', os: r.os || '', browser: r.browser || '', tech: parseTech(r.tech), marketing: !!r.marketing_ok, status: r.status, note: r.note, handledBy: r.handled_by, messages: r.msg_count, lastMessage: r.last_message, interest: r.interest, created: r.created_at, seen: r.last_seen_at });

const parseTech = t => { try { return t ? JSON.parse(t) : {}; } catch { return {}; } };
