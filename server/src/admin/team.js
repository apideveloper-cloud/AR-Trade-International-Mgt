// Admin team: staff accounts, their role and status, personal details, and handing over the Master Admin role.
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { digits, fail, wrap, checkPassword } from '../util.js';
import { permsOf, MASTER, ROLE_DEFS, ROLE_NAMES } from '../permissions.js';
import { staffOut } from './guard.js';

const STAFF_STATUSES = ['Active', 'Pending', 'Disabled'];
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MOBILE_RE = /^01[3-9]\d{8}$/;

/** NID, addresses and the reference person of a staff member. All optional, but checked when given. */
export function staffDetails(b, cur = {}) { // a field missing from `b` keeps its value in `cur`: a partial edit must not blank the rest
  const nid = digits(b.nid ?? cur.nid);
  if (nid && ![10, 13, 17].includes(nid.length)) throw fail(400, 'NID must have 10, 13 or 17 digits.');
  const refPhone = digits(b.refPhone ?? cur.ref_phone).slice(-11);
  if (refPhone && !MOBILE_RE.test(refPhone)) throw fail(400, 'Enter a valid 11-digit mobile number for the reference person (01XXXXXXXXX).');
  const cut = (v, n) => String(v ?? '').trim().slice(0, n);
  return { nid, present_address: cut(b.presentAddress ?? cur.present_address, 300), contact_address: cut(b.contactAddress ?? cur.contact_address, 300), ref_name: cut(b.refName ?? cur.ref_name, 120), ref_phone: refPhone };
}
const staffRow = s => ({ ...staffOut(s), nid: s.nid || '', presentAddress: s.present_address || '', contactAddress: s.contact_address || '', refName: s.ref_name || '', refPhone: s.ref_phone || '' });

/** Name, work email and mobile checked the same way for a new member and for an edit. */
function checkContact(name, email, phone) {
  if (name.length < 2) throw fail(400, 'Enter the name of the team member.');
  if (!EMAIL_RE.test(email)) throw fail(400, 'Enter a valid work email.');
  if (!MOBILE_RE.test(phone)) throw fail(400, 'Enter a valid 11-digit mobile number (01XXXXXXXXX).');
}

export function mountTeamRoutes(router, guard) {
  router.get('/staff', guard('team.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM staff ORDER BY FIELD(status,"Pending","Active","Disabled"), created_at');
    res.json(rows.map(staffRow));
  }));
  router.put('/staff/:id', guard('team.manage'), wrap(async (req, res) => {
    const { role, status } = req.body;
    const [[t]] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    if (!t) throw fail(404, 'Not found');
    if (t.id === req.staff.id) throw fail(400, 'You cannot change your own access');
    const master = req.staff.role === MASTER;
    // only the Master Admin may touch, or create, the two top roles
    if (!master && (t.role === MASTER || t.role === 'Admin')) throw fail(403, 'Only the Master Admin can change a Master Admin or an Admin');
    if (role === MASTER && t.role !== MASTER) throw fail(409, 'There is only one Master Admin. Use "Transfer Master Admin" to hand it over.');
    if (!master && role === 'Admin') throw fail(403, 'Only the Master Admin can make someone an Admin');
    if (t.role === MASTER && ((role && role !== MASTER) || (status && status !== 'Active'))) {
      const [[o]] = await pool.query('SELECT COUNT(*) n FROM staff WHERE role = ? AND status = "Active" AND id <> ?', [MASTER, t.id]);
      if (!o.n) throw fail(400, 'There must always be one active Master Admin');
    }
    if (role && !ROLE_NAMES.includes(role)) throw fail(400, 'Unknown role');
    if (status && !STAFF_STATUSES.includes(status)) throw fail(400, 'Unknown status');
    if (role) { await pool.query('UPDATE staff SET role = ? WHERE id = ?', [role, t.id]); }
    if (status) { await pool.query('UPDATE staff SET status = ? WHERE id = ?', [status, t.id]); }
    res.json({ ok: true });
  }));

  // add a team member without the request-access step: the account is active straight away
  router.post('/staff', guard('team.manage'), wrap(async (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 120);
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160);
    const phone = digits(req.body.phone).slice(-11);
    const role = String(req.body.role || '');
    checkContact(name, email, phone);
    checkPassword(req.body.password);
    if (!ROLE_NAMES.includes(role)) throw fail(400, 'Choose a role.');
    if (role === MASTER) throw fail(409, 'There is only one Master Admin and it is already taken. Use "Transfer Master Admin" to hand it to someone else.');
    if (req.staff.role !== MASTER && role === 'Admin') throw fail(403, 'Only the Master Admin can add an Admin.');
    const d = staffDetails(req.body);
    const [dup] = await pool.query('SELECT id FROM staff WHERE email = ? OR phone = ?', [email, phone]);
    if (dup.length) throw fail(409, 'This email or mobile number is already registered.');
    const [r] = await pool.query('INSERT INTO staff (name,email,phone,password_hash,role,status,nid,present_address,contact_address,ref_name,ref_phone) VALUES (?,?,?,?,?,"Active",?,?,?,?,?)', [name, email, phone, await bcrypt.hash(String(req.body.password), 10), role, d.nid, d.present_address, d.contact_address, d.ref_name, d.ref_phone]);
    res.json({ ok: true, id: r.insertId });
  }));
  // edit a team member's name, contact and personal details (role, status and password have their own routes)
  router.put('/staff/:id/details', guard('team.manage'), wrap(async (req, res) => {
    const [[t]] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    if (!t) throw fail(404, 'Not found');
    if (req.staff.role !== MASTER && (t.role === MASTER || t.role === 'Admin') && t.id !== req.staff.id) throw fail(403, 'Only the Master Admin can change a Master Admin or an Admin');
    const name = String(req.body.name ?? t.name).trim().slice(0, 120);
    const email = String(req.body.email ?? t.email).trim().toLowerCase().slice(0, 160);
    const phone = digits(req.body.phone ?? t.phone).slice(-11);
    checkContact(name, email, phone);
    const d = staffDetails(req.body, t);
    const [dup] = await pool.query('SELECT id FROM staff WHERE (email = ? OR phone = ?) AND id <> ?', [email, phone, t.id]);
    if (dup.length) throw fail(409, 'This email or mobile number is already used by another account.');
    await pool.query('UPDATE staff SET name=?, email=?, phone=?, nid=?, present_address=?, contact_address=?, ref_name=?, ref_phone=? WHERE id=?', [name, email, phone, d.nid, d.present_address, d.contact_address, d.ref_name, d.ref_phone, t.id]);
    res.json({ ok: true });
  }));
  // hand the single Master Admin role to another active member; the current Master Admin becomes an Admin (one step, so there is never zero or two)
  router.post('/staff/:id/make-master', guard('team.manage'), wrap(async (req, res) => {
    if (req.staff.role !== MASTER) throw fail(403, 'Only the Master Admin can hand over the Master Admin role');
    const [[t]] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    if (!t) throw fail(404, 'Not found');
    if (t.id === req.staff.id) throw fail(400, 'You already are the Master Admin');
    if (t.status !== 'Active') throw fail(400, 'Choose an active team member');
    if (String(req.body.confirm || '') !== 'TRANSFER') throw fail(400, 'Type TRANSFER to confirm');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE staff SET role = "Admin" WHERE id = ? AND role = ?', [req.staff.id, MASTER]);
      await conn.query('UPDATE staff SET role = ? WHERE id = ?', [MASTER, t.id]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    await pool.query('INSERT INTO role_log (role, staff_id, staff_name, what) VALUES (?,?,?,?)', [MASTER, req.staff.id, req.staff.name, `Master Admin role handed over to ${t.name}; ${req.staff.name} is now an Admin`.slice(0, 255)]);
    res.json({ ok: true });
  }));
  router.get('/staff/roles', guard('team.manage'), wrap(async (req, res) => {
    const master = req.staff.role === MASTER;
    res.json(ROLE_DEFS.map(r => ({ name: r.name, icon: r.icon, desc: r.desc, legacy: !!r.legacy, assignable: r.name !== MASTER && (master || r.name !== 'Admin'), perms: [...permsOf(r.name)].length })));
  }));
}
