// Staff accounts as seen in the app's Admin console (admin role only).
//   GET /api/field/users                  every staff member with role, status, clock state
//   PUT /api/field/users/:id/status       { status: 'Active' | 'Disabled' }
import { Router } from 'express';
import { pool, guardRole, wrap, fail, roleKey, empCode, UTC } from '../common.js';

const router = Router();
const admin = guardRole('admin');

router.get('/', admin, wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, (SELECT a.type FROM field_attendance a WHERE a.staff_id = s.id ORDER BY a.at DESC, a.id DESC LIMIT 1) AS last_type,
            (SELECT ${UTC('MAX(a.at)')} FROM field_attendance a WHERE a.staff_id = s.id) AS last_seen
     FROM staff s ORDER BY FIELD(s.status, 'Active', 'Pending', 'Disabled'), s.name`);
  res.json({
    items: rows.map(s => ({
      id: s.id, name: s.name, email: s.email, phone: s.phone, employeeCode: empCode(s), role: roleKey(s.role), roleLabel: s.role,
      status: s.status, onDuty: s.last_type === 'Clocked In', lastSeen: s.last_seen, protected: s.role === 'Master Admin' || s.id === req.staff.id
    })),
    counts: { total: rows.length, active: rows.filter(s => s.status === 'Active').length, disabled: rows.filter(s => s.status === 'Disabled').length, pending: rows.filter(s => s.status === 'Pending').length }
  });
}));

router.put('/:id/status', admin, wrap(async (req, res) => {
  const status = ['Active', 'Disabled'].includes(req.body.status) ? req.body.status : null;
  if (!status) throw fail(400, 'Status must be Active or Disabled');
  const [[s]] = await pool.query('SELECT id, role, status FROM staff WHERE id = ?', [req.params.id]);
  if (!s) throw fail(404, 'Staff member not found');
  if (s.id === req.staff.id) throw fail(403, 'You cannot change your own account here');
  if (s.role === 'Master Admin') throw fail(403, 'The Master Admin account cannot be disabled');
  await pool.query('UPDATE staff SET status = ? WHERE id = ?', [status, s.id]);
  res.json({ id: s.id, status });
}));

export default router;
