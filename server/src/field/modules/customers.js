// Customers (RM): list / search, add an upcoming customer (lead), convert to active on the first order.
//   GET  /api/field/customers?kind=all|active|upcoming&q=   -> { items, counts }
//   GET  /api/field/customers/:id
//   POST /api/field/customers            { name, mobile, person, type, area, interest[], value, source, next, note, lat, lng }
//   POST /api/field/customers/:id/convert
import { Router } from 'express';
import { pool, guard, guardRole, wrap, fail, digits } from '../common.js';
import { customerOut, duesByCustomer } from '../crm_util.js';

const router = Router();
const str = (v, n) => String(v ?? '').trim().slice(0, n);

router.get('/', guard(), wrap(async (req, res) => {
  const q = str(req.query.q, 80).toLowerCase();
  const kind = String(req.query.kind || 'all').toLowerCase();
  const [rows] = await pool.query('SELECT * FROM field_customers ORDER BY created_at DESC, id DESC');
  const dues = await duesByCustomer();
  const isActive = c => c.kind !== 'Upcoming';
  const counts = { all: rows.length, active: rows.filter(isActive).length, upcoming: rows.filter(c => !isActive(c)).length };
  const items = rows
    .filter(c => kind === 'all' || (kind === 'active' ? isActive(c) : kind === 'upcoming' ? !isActive(c) : true))
    .filter(c => !q || `${c.name} ${c.contact_person} ${c.area} ${c.phone}`.toLowerCase().includes(q) || (digits(q) && digits(c.phone).includes(digits(q))))
    .map(c => customerOut(c, dues.get(c.id) || 0));
  items.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ items, counts });
}));

router.get('/:id', guard(), wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM field_customers WHERE id = ?', [req.params.id]);
  if (!c) throw fail(404, 'Customer not found');
  res.json(customerOut(c, (await duesByCustomer()).get(c.id) || 0));
}));

router.post('/', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const name = str(req.body.name, 160);
  const phone = str(req.body.mobile ?? req.body.phone, 30);
  if (!name || !digits(phone)) throw fail(400, 'Business name and mobile number are required');
  if (digits(phone).length < 10) throw fail(400, 'Enter a valid mobile number');
  const [dup] = await pool.query('SELECT id FROM field_customers WHERE LOWER(name) = LOWER(?)', [name]);
  if (dup.length) throw fail(409, 'A customer with this business name already exists');
  const interest = Array.isArray(req.body.interest) ? req.body.interest.map(s => str(s, 40)).join(', ') : str(req.body.interest, 160);
  const lat = req.body.lat == null ? null : Number(req.body.lat), lng = req.body.lng == null ? null : Number(req.body.lng);
  if ((lat != null && !(Math.abs(lat) <= 90)) || (lng != null && !(Math.abs(lng) <= 180))) throw fail(400, 'Invalid location');
  const [r] = await pool.query(
    `INSERT INTO field_customers (name, contact_person, phone, area, kind, customer_type, interest, monthly_value, lead_source, next_step, note, lat, lng, owner_staff_id)
     VALUES (?,?,?,?, 'Upcoming', ?,?,?,?,?,?,?,?,?)`,
    [name, str(req.body.person, 120), phone, str(req.body.area, 80), str(req.body.type, 40), interest, str(req.body.value, 40), str(req.body.source, 60),
      str(req.body.next, 80), str(req.body.note, 2000), lat, lng, req.staff.id]);
  const [[c]] = await pool.query('SELECT * FROM field_customers WHERE id = ?', [r.insertId]);
  res.json(customerOut(c));
}));

// first order placed: Upcoming (or Inactive) -> Active. The sales-order module may call this too.
router.post('/:id/convert', guardRole('rm', 'manager'), wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM field_customers WHERE id = ?', [req.params.id]);
  if (!c) throw fail(404, 'Customer not found');
  if (c.kind !== 'Active') await pool.query("UPDATE field_customers SET kind = 'Active', next_step = '' WHERE id = ?", [c.id]);
  const [[u]] = await pool.query('SELECT * FROM field_customers WHERE id = ?', [c.id]);
  res.json(customerOut(u, (await duesByCustomer()).get(c.id) || 0));
}));

export default router;
