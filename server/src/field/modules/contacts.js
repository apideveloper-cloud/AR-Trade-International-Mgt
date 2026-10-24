// Contact directory: team (staff), customers (field_customers, if the customers module is installed), vendors and head-office numbers.
//   GET /api/field/contacts?type=all|team|customer|vendor&q=
//   GET /api/field/contacts/office
//   POST /api/field/contacts          { name, phone, type: customer|vendor|other, title?, org?, email?, address? }   my own address-book entry
//   DELETE /api/field/contacts/:key   remove one of my own entries (key 'p-<id>')
// Every contact carries lastCall { via, seconds, at } from my own call log when I called that number before.
import { Router } from 'express';
import { pool, wrap, guard, roleKey, fail, digits, UTC_TS } from '../common.js';

const router = Router();

// personal address-book entries (created from the app's "add contact" button; each belongs to one staff member)
const ready = pool.query(`CREATE TABLE IF NOT EXISTS field_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  type VARCHAR(12) NOT NULL DEFAULT 'other',
  name VARCHAR(120) NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT '',
  org VARCHAR(120) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(160) NOT NULL DEFAULT '',
  address VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_staff (staff_id)
)`).catch(e => console.error('[field] contacts table:', e.message));
// shared with users.js (profile pictures); created here too so the team list never fails on a fresh database
pool.query(`CREATE TABLE IF NOT EXISTS field_staff_extra (
  staff_id INT PRIMARY KEY,
  photo VARCHAR(80) NULL,
  photo_v INT NOT NULL DEFAULT 0,
  pw_fp CHAR(16) NOT NULL DEFAULT '',
  pw_changed_at DATETIME NULL
)`).catch(() => {});
const tail = p => digits(p).slice(-10);

const OFFICE = [
  { key: 'o-1', name: 'Head Office', title: 'Santinagar, Dhaka-1217', org: 'AR Trade International', phone: '01977-554401', email: 'info@artradeinternational.com', address: '159 Santinagar, Dhaka-1217' },
  { key: 'o-2', name: 'Showroom', title: 'Sat–Thu · 10:00–20:00', org: 'AR Trade International', phone: '01977-554401', email: 'info@artradeinternational.com', address: '159 Santinagar, Dhaka-1217' },
  { key: 'o-3', name: 'Accounts desk', title: 'Payments & invoices', org: 'AR Trade International', phone: '01977-554401', email: 'accounts@artradeinternational.com', address: 'Head office' },
  { key: 'o-4', name: 'Customer support', title: 'Orders & servicing', org: 'AR Trade International', phone: '01977-554401', email: 'info@artradeinternational.com', address: 'Head office' }
];

router.get('/office', guard(), (req, res) => res.json(OFFICE.map(o => ({ ...o, type: 'office', online: false }))));

router.get('/', guard(), wrap(async (req, res) => {
  const type = ['team', 'customer', 'vendor'].includes(req.query.type) ? req.query.type : 'all';
  const q = String(req.query.q || '').trim().toLowerCase();
  const out = [];

  if (type === 'all' || type === 'team') {
    const [rows] = await pool.query(
      `SELECT s.id, s.name, s.role, s.phone, s.email, s.contact_address address,
         (SELECT e.photo_v FROM field_staff_extra e WHERE e.staff_id = s.id AND e.photo IS NOT NULL) photo_v,
         (SELECT a.type FROM field_attendance a WHERE a.staff_id = s.id ORDER BY a.id DESC LIMIT 1) last_type
       FROM staff s WHERE s.status = 'Active' AND s.id <> ? ORDER BY s.name`, [req.staff.id]);
    for (const s of rows) {
      out.push({ key: `t-${s.id}`, type: 'team', staffId: s.id, name: s.name, title: s.role, org: 'AR Trade', role: roleKey(s.role),
        phone: s.phone || '', email: s.email || '', address: s.address || '', online: s.last_type === 'Clocked In',
        photoUrl: s.photo_v == null ? null : `/api/field/users/${s.id}/photo?v=${s.photo_v}` });
    }
  }
  if (type === 'all' || type === 'customer') {
    try {
      const [rows] = await pool.query(
        "SELECT id, name, contact_person, contact_role, phone, email, address FROM field_customers WHERE phone <> '' OR contact_person <> '' ORDER BY contact_person, name");
      for (const c of rows) {
        out.push({ key: `c-${c.id}`, type: 'customer', customerId: c.id, name: c.contact_person || c.name, title: c.contact_role || 'Customer', org: c.name,
          phone: c.phone || '', email: c.email || '', address: c.address || '', online: false });
      }
    } catch { /* customers module not installed */ }
  }
  if (type === 'all' || type === 'vendor') {
    const [rows] = await pool.query('SELECT id, name, kind, phone, email, address FROM field_vendors ORDER BY name');
    for (const v of rows) {
      out.push({ key: `v-${v.id}`, type: 'vendor', vendorId: v.id, name: v.name, title: v.kind || 'Vendor', org: '', phone: v.phone || '', email: v.email || '', address: v.address || '', online: false });
    }
  }

  // personal entries
  try {
    await ready;
    const [mine] = await pool.query('SELECT * FROM field_contacts WHERE staff_id = ?', [req.staff.id]);
    for (const c of mine) {
      const t = type === 'all' || type === c.type;
      if (t) out.push({ key: `p-${c.id}`, type: c.type, mine: true, name: c.name, title: c.title || (c.type === 'vendor' ? 'Vendor' : c.type === 'customer' ? 'Customer' : 'Contact'), org: c.org,
        phone: c.phone, email: c.email, address: c.address, online: false });
    }
  } catch { /* table not ready */ }

  // last call per number, from my own call log
  const [calls] = await pool.query(`SELECT peer_phone, via, seconds, ${UTC_TS('created_at')} at FROM field_call_log WHERE staff_id = ? ORDER BY id DESC LIMIT 400`, [req.staff.id]);
  const last = new Map();
  for (const c of calls) { const k = tail(c.peer_phone); if (k.length >= 7 && !last.has(k)) last.set(k, { via: c.via, seconds: c.seconds, at: c.at }); }
  for (const c of out) c.lastCall = last.get(tail(c.phone)) || null;

  const list = q
    ? out.filter(c => `${c.name} ${c.title} ${c.org} ${c.phone}`.toLowerCase().replace(/-/g, '').includes(q.replace(/-/g, '')))
    : out;
  list.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ total: list.length, online: list.filter(c => c.online).length, contacts: list });
}));

router.post('/', guard(), wrap(async (req, res) => {
  await ready;
  const name = String(req.body.name || '').trim().slice(0, 120);
  const phone = String(req.body.phone || '').replace(/[^\d+\- ]/g, '').trim().slice(0, 30);
  if (name.length < 2) throw fail(400, 'Enter the contact name');
  if (digits(phone).length < 7) throw fail(400, 'Enter a valid phone number');
  const type = ['customer', 'vendor', 'other'].includes(req.body.type) ? req.body.type : 'other';
  const email = String(req.body.email || '').trim().slice(0, 160);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email or leave it empty');
  const [r] = await pool.query('INSERT INTO field_contacts (staff_id, type, name, title, org, phone, email, address) VALUES (?,?,?,?,?,?,?,?)',
    [req.staff.id, type, name, String(req.body.title || '').trim().slice(0, 120), String(req.body.org || '').trim().slice(0, 120), phone, email, String(req.body.address || '').trim().slice(0, 255)]);
  res.json({ key: `p-${r.insertId}` });
}));

router.delete('/:key', guard(), wrap(async (req, res) => {
  await ready;
  const m = /^p-(\d+)$/.exec(req.params.key);
  if (!m) throw fail(400, 'Only contacts you added yourself can be removed');
  const [r] = await pool.query('DELETE FROM field_contacts WHERE id = ? AND staff_id = ?', [m[1], req.staff.id]);
  if (!r.affectedRows) throw fail(404, 'Contact not found');
  res.json({ ok: true });
}));

export default router;
