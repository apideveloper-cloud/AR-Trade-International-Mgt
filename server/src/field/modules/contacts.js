// Contact directory: team (staff), customers (field_customers, if the customers module is installed), vendors and head-office numbers.
//   GET /api/field/contacts?type=all|team|customer|vendor&q=
//   GET /api/field/contacts/office
import { Router } from 'express';
import { pool, wrap, guard, roleKey } from '../common.js';

const router = Router();

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
         (SELECT a.type FROM field_attendance a WHERE a.staff_id = s.id ORDER BY a.id DESC LIMIT 1) last_type
       FROM staff s WHERE s.status = 'Active' AND s.id <> ? ORDER BY s.name`, [req.staff.id]);
    for (const s of rows) {
      out.push({ key: `t-${s.id}`, type: 'team', staffId: s.id, name: s.name, title: s.role, org: 'AR Trade', role: roleKey(s.role),
        phone: s.phone || '', email: s.email || '', address: s.address || '', online: s.last_type === 'Clocked In' });
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

  const list = q
    ? out.filter(c => `${c.name} ${c.title} ${c.org} ${c.phone}`.toLowerCase().replace(/-/g, '').includes(q.replace(/-/g, '')))
    : out;
  list.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ total: list.length, online: list.filter(c => c.online).length, contacts: list });
}));

export default router;
