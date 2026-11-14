// Public careers: open roles and CV applications (the CV is saved under server/uploads/cv, which is never served).
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';
import { digits, fail, nextSeq, parseJson, wrap } from '../util.js';
import { limit } from '../middleware/security.js';

const UPLOADS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/cv');
fs.mkdirSync(UPLOADS, { recursive: true });

const CV_TYPES = { 'application/pdf': '.pdf', 'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx' };

const jobOut = j => ({
  id: j.id, title: j.title, dept: j.dept, type: j.type, loc: j.loc, exp: j.exp, salary: j.salary, vacancies: j.vacancies,
  deadline: j.deadline, open: !!j.open && new Date(j.deadline) > new Date(), about: j.about,
  resp: parseJson(j.resp) || [], req: parseJson(j.req) || [], perks: parseJson(j.perks) || []
});

export function mountCareersRoutes(app) {
  app.get('/api/jobs', wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM jobs ORDER BY deadline');
    res.json(rows.map(jobOut));
  }));

  app.post('/api/jobs/:id/apply', limit('apply', 5, 3600000), wrap(async (req, res) => {
    const [[job]] = await pool.query('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (!job || !jobOut(job).open) throw fail(400, 'This role is no longer accepting applications.');
    const s = (v, n) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '').slice(0, n); // objects would be expanded into broken SQL; long text would fail the column size
    const { phone, cvData } = req.body, name = s(req.body.name, 120);
    if (!name || !/^01[3-9]\d{8}$/.test(digits(phone).slice(-11))) throw fail(400, 'Enter a valid Bangladeshi mobile number.');
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(typeof cvData === 'string' ? cvData : '');
    if (!m) throw fail(400, 'Please attach your CV (PDF or Word).');
    const ext = CV_TYPES[m[1]];
    if (!ext) throw fail(400, 'CV must be a PDF or Word file.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 2 * 1048576) throw fail(400, 'CV must be under 2 MB.');
    const id = await nextSeq('application', 'applications', 'APP-', 2003);
    const file = `${id}${ext}`;
    fs.writeFileSync(path.join(UPLOADS, file), buf);
    await pool.query('INSERT INTO applications (id,job_id,name,phone,email,exp,salary,link,note,cv_name,cv_file) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, job.id, name, digits(phone), s(req.body.email, 160), s(req.body.exp, 60), s(req.body.salary, 40), s(req.body.link, 255), s(req.body.note, 5000), s(req.body.cvName || file, 255), file]);
    res.json({ id });
  }));
}
