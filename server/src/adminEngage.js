// Admin console: product reviews, messages, marketing (subscribers, consents), careers (jobs, applications, CVs).
// Split out of admin.js; the routes are registered on the same router, in the same order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { fail, parseJson, wrap } from './util.js';
import { addRange, whereOf } from './listing.js';
import { like, page } from './adminHelpers.js';

const CV_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/cv');

export function mountEngageRoutes(router, guard) {
  // ---------- product reviews moderation ----------
  router.get('/reviews', guard('reviews.moderate'), wrap(async (req, res) => {
    const { size, offset } = page(req);
    const cond = [], params = [];
    if (req.query.q) { cond.push('(r.name LIKE ? OR r.body LIKE ? OR p.name LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
    if (req.query.status) { cond.push('r.status = ?'); params.push(req.query.status); }
    addRange(cond, params, 'r.created_at', req);
    const where = whereOf(cond);
    const from = 'FROM reviews r LEFT JOIN products p ON p.id = r.product_id';
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n ${from} ${where}`, params);
    const [rows] = await pool.query(`SELECT r.*, p.name AS product ${from} ${where} ORDER BY (r.status = 'Pending') DESC, r.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
    const [[{ pending }]] = await pool.query('SELECT COUNT(*) pending FROM reviews WHERE status = "Pending"');
    res.json({ total: n, pending, rows: rows.map(r => ({ id: r.id, productId: r.product_id, product: r.product || ('#' + r.product_id), name: r.name, rating: r.rating, title: r.title, body: r.body, verified: !!r.verified, status: r.status, created: r.created_at, reviewed: r.reviewed_at })) });
  }));
  router.put('/reviews/:id', guard('reviews.moderate'), wrap(async (req, res) => {
    if (!['Pending', 'Approved', 'Rejected'].includes(req.body.status)) throw fail(400, 'Unknown status');
    const [r] = await pool.query('UPDATE reviews SET status = ?, reviewed_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
    if (!r.affectedRows) throw fail(404, 'Review not found');
    res.json({ ok: true });
  }));
  router.delete('/reviews/:id', guard('reviews.moderate'), wrap(async (req, res) => { await pool.query('DELETE FROM reviews WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

  router.get('/messages', guard('messages.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200');
    res.json({ chat: rows.filter(m => m.subject === 'Live chat').map(m => ({ id: m.id, text: m.body, name: m.name === 'Live chat visitor' ? '' : m.name, contact: m.contact || '', at: m.created_at })), contact: rows.filter(m => m.subject !== 'Live chat').map(m => ({ id: m.id, name: m.name, contact: m.contact, company: m.company, subject: m.subject, body: m.body, at: m.created_at, status: m.status || 'New', note: m.note || '', handledBy: m.handled_by || '', handledAt: m.handled_at })) });
  }));
  // work a message: its status (New, Read, Replied, Closed) and a private note for the team
  router.put('/messages/:id', guard('messages.manage'), wrap(async (req, res) => {
    const [[m]] = await pool.query('SELECT id, status FROM messages WHERE id = ?', [req.params.id]);
    if (!m) throw fail(404, 'Message not found');
    const sets = [], vals = [];
    if ('status' in req.body) {
      if (!['New', 'Read', 'Replied', 'Closed'].includes(req.body.status)) throw fail(400, 'Unknown status');
      sets.push('status = ?', 'handled_by = ?', 'handled_at = NOW()'); vals.push(req.body.status, req.body.status === 'New' ? '' : req.staff.name);
    }
    if ('note' in req.body) { sets.push('note = ?'); vals.push(String(req.body.note || '').trim().slice(0, 1000)); }
    if (!sets.length) throw fail(400, 'Nothing to update');
    await pool.query(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`, [...vals, m.id]);
    res.json({ ok: true });
  }));
  router.delete('/messages/:id', guard('messages.manage'), wrap(async (req, res) => { await pool.query('DELETE FROM messages WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

  // ---------- marketing: subscribers, consent log, campaigns ----------
  router.get('/subscribers', guard('marketing.manage'), wrap(async (req, res) => {
    const { size, offset } = page(req);
    const cond = [], params = [];
    if (req.query.q) { cond.push('email LIKE ?'); params.push(like(req.query.q)); }
    addRange(cond, params, 'created_at', req);
    const q = whereOf(cond);
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM subscribers ${q}`, params);
    const [rows] = await pool.query(`SELECT email, created_at FROM subscribers ${q} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
    res.json({ total: n, rows });
  }));
  router.post('/subscribers', guard('marketing.manage'), wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
    await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [email]);
    res.json({ ok: true });
  }));
  router.delete('/subscribers/:email', guard('marketing.manage'), wrap(async (req, res) => {
    await pool.query('DELETE FROM subscribers WHERE email = ?', [req.params.email]);
    await pool.query('UPDATE consents SET status = "Unsubscribed" WHERE email = ? AND status <> "Unsubscribed"', [req.params.email]);
    res.json({ ok: true });
  }));
  router.get('/consents', guard('marketing.manage'), wrap(async (req, res) => {
    const { size, offset } = page(req);
    const cond = [], params = [];
    if (req.query.q) { cond.push('(email LIKE ? OR source LIKE ?)'); params.push(like(req.query.q), like(req.query.q)); }
    if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
    addRange(cond, params, 'created_at', req);
    const where = whereOf(cond);
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM consents ${where}`, params);
    const [rows] = await pool.query(`SELECT * FROM consents ${where} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
    res.json({ total: n, rows: rows.map(c => ({ id: c.id, email: c.email, source: c.source, token: c.token, status: c.status, ip: c.ip, at: c.created_at, confirmedAt: c.confirmed_at })) });
  }));
  router.put('/consents/:id/confirm', guard('marketing.manage'), wrap(async (req, res) => {
    const [[c]] = await pool.query('SELECT * FROM consents WHERE id = ?', [req.params.id]);
    if (!c) throw fail(404, 'Not found');
    await pool.query('UPDATE consents SET status = "Confirmed", confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = ?', [c.id]);
    await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [c.email]);
    (await import('./mkt.js')).onSubscribed(c.email).catch(() => {});
    res.json({ ok: true });
  }));

  // ---------- careers ----------
  router.get('/jobs', guard('careers.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) apps FROM jobs j ORDER BY j.deadline DESC');
    res.json(rows.map(j => ({ id: j.id, title: j.title, dept: j.dept, type: j.type, loc: j.loc, exp: j.exp, salary: j.salary, vacancies: j.vacancies, deadline: j.deadline, open: !!j.open, about: j.about, resp: parseJson(j.resp) || [], req: parseJson(j.req) || [], perks: parseJson(j.perks) || [], apps: j.apps })));
  }));
  router.post('/jobs', guard('careers.manage'), wrap(async (req, res) => {
    const j = req.body;
    if (!j.title || !j.dept) throw fail(400, 'Title and department are required');
    const id = String(j.id || 'J-' + (Math.floor(Date.now() / 1000) % 100000)).slice(0, 20);
    const due = j.deadline ? new Date(j.deadline) : new Date(Date.now() + 30 * 864e5);
    if (isNaN(due)) throw fail(400, 'Enter a valid deadline date');
    const lines = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => s.trim()).filter(Boolean);
    await pool.query(
      `INSERT INTO jobs (id,title,dept,type,loc,exp,salary,vacancies,deadline,open,about,resp,req,perks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), dept=VALUES(dept), type=VALUES(type), loc=VALUES(loc), exp=VALUES(exp), salary=VALUES(salary), vacancies=VALUES(vacancies), deadline=VALUES(deadline), open=VALUES(open), about=VALUES(about), resp=VALUES(resp), req=VALUES(req), perks=VALUES(perks)`,
      [id, j.title, j.dept, j.type || 'Full-time', j.loc || '', j.exp || '', j.salary || '', parseInt(j.vacancies, 10) || 1,
        due.toISOString().slice(0, 19).replace('T', ' '), +(j.open !== false), j.about || '',
        JSON.stringify(lines(j.resp)), JSON.stringify(lines(j.req)), JSON.stringify(lines(j.perks))]);
    res.json({ id });
  }));
  router.delete('/jobs/:id', guard('careers.manage'), wrap(async (req, res) => {
    await pool.query('DELETE FROM applications WHERE job_id = ?', [req.params.id]);
    await pool.query('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  }));
  router.get('/applications', guard('careers.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT a.*, j.title job_title FROM applications a JOIN jobs j ON j.id = a.job_id ORDER BY a.created_at DESC');
    res.json(rows.map(a => ({ id: a.id, job: a.job_id, jobTitle: a.job_title, name: a.name, phone: a.phone, email: a.email, exp: a.exp, salary: a.salary, link: a.link, note: a.note, cv: a.cv_name, stage: a.stage, at: a.created_at })));
  }));
  // applicants' CVs are private files: downloaded here by an Admin, never through the public /api/uploads path
  router.get('/applications/:id/cv', guard('careers.manage'), wrap(async (req, res) => {
    const [[a]] = await pool.query('SELECT cv_file, cv_name FROM applications WHERE id = ?', [req.params.id]);
    if (!a || !a.cv_file) throw fail(404, 'CV not found');
    const file = path.join(CV_DIR, path.basename(a.cv_file));
    if (!fs.existsSync(file)) throw fail(404, 'CV file is missing on the server');
    res.download(file, (/\.[a-z]{3,4}$/i.test(a.cv_name || '') ? a.cv_name : a.cv_file).replace(/[^\w.\- ]/g, '_'));
  }));
  router.put('/applications/:id', guard('careers.manage'), wrap(async (req, res) => {
    if (!['New', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'].includes(req.body.stage)) throw fail(400, 'Unknown stage');
    const [r] = await pool.query('UPDATE applications SET stage = ? WHERE id = ?', [req.body.stage, req.params.id]);
    if (!r.affectedRows) throw fail(404, 'Application not found');
    res.json({ ok: true });
  }));

}
