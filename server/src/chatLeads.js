// People who start the shop chat leave their name, mobile and location first. They are kept as a list of
// upcoming customers for the sellers and for marketing (Admin > Inbox > Chat leads).
import crypto from 'node:crypto';
import { pool } from './db.js';
import { digits, fail, wrap } from './util.js';
import { like, page } from './adminHelpers.js';

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
}

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Checks the start-of-chat form; throws a message the visitor can act on. */
export function readLeadForm(body) {
  const name = clean(body.name, 120), phone = digits(body.phone).slice(-11), location = clean(body.location, 160);
  if (name.length < 2) throw fail(400, 'Please enter your name');
  if (!/^01\d{9}$/.test(phone)) throw fail(400, 'Enter a valid mobile number (01XXXXXXXXX)');
  if (location.length < 2) throw fail(400, 'Please enter your location (area and district)');
  return { name, phone, location, marketing: !!body.marketing };
}

/** Public: the form that opens a chat. The same mobile number returns to its own record. */
export async function startLead(body) {
  const f = readLeadForm(body);
  const token = crypto.randomBytes(16).toString('hex');
  // a number that is already on the list keeps its first details (a stranger typing someone's number cannot rewrite them);
  // only "last seen" and the offers consent are refreshed, and the visitor gets that record's token back
  await pool.query(
    `INSERT INTO chat_leads (token, name, phone, location, marketing_ok) VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE marketing_ok = GREATEST(marketing_ok, VALUES(marketing_ok)), last_seen_at = NOW()`,
    [token, f.name, f.phone, f.location, f.marketing ? 1 : 0]);
  const [[lead]] = await pool.query('SELECT token, name FROM chat_leads WHERE phone = ?', [f.phone]);
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

const outLead = r => ({ id: r.id, name: r.name, phone: r.phone, location: r.location, marketing: !!r.marketing_ok, status: r.status, note: r.note, handledBy: r.handled_by, messages: r.msg_count, lastMessage: r.last_message, interest: r.interest, created: r.created_at, seen: r.last_seen_at });
