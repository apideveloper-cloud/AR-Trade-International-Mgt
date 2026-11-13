// Admin console sign-in, registration, the signed-in user and the header notifications.
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { digits, fail, wrap, checkPassword } from '../util.js';
import { unpublishedProducts } from '../productImages.js';
import { can, REGISTRABLE } from '../permissions.js';
import { meOut, sign } from './guard.js';

export function mountAuthRoutes(router, guard) {
  router.post('/login', wrap(async (req, res) => {
    const id = String(req.body.id || '').trim().toLowerCase();
    const [[s]] = await pool.query('SELECT * FROM staff WHERE email = ? OR (phone <> "" AND phone = ?)', [id, digits(id)]);
    if (!s || !(await bcrypt.compare(req.body.password || '', s.password_hash))) throw fail(401, 'Wrong mobile/email or password.');
    // the role picked on the sign-in page has to be this account's role (checked only once the password is right, so it reveals nothing to a guesser)
    const want = String(req.body.role || '').trim();
    if (want && want !== s.role) throw fail(403, `This account is not ${/^[AEIOU]/i.test(want) ? 'an' : 'a'} ${want}. It is registered as ${s.role}. Pick ${s.role} and sign in again.`);
    if (s.status === 'Pending') throw fail(403, 'Your account is waiting for an admin to approve it.');
    if (s.status !== 'Active') throw fail(403, 'This account is disabled.');
    res.json({ token: sign(s, req.body.remember === true), staff: meOut(s) });
  }));

  router.post('/register', wrap(async (req, res) => {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) throw fail(400, 'Name, work email and a password are required.');
    checkPassword(password);
    if (!/^01[3-9]\d{8}$/.test(digits(phone).slice(-11))) throw fail(400, 'Enter a valid 11-digit mobile number (01XXXXXXXXX).');
    if (!REGISTRABLE.includes(role)) throw fail(400, 'Choose one of the listed roles.');
    const [ex] = await pool.query('SELECT id FROM staff WHERE email = ? OR phone = ?', [email.toLowerCase(), digits(phone).slice(-11)]);
    if (ex.length) throw fail(409, 'This email or mobile number is already registered.');
    await pool.query('INSERT INTO staff (name,email,phone,password_hash,role,status) VALUES (?,?,?,?,?,"Pending")',
      [name, email.toLowerCase(), digits(phone).slice(-11), await bcrypt.hash(password, 10), role]);
    res.json({ ok: true });
  }));

  router.get('/me', guard(), wrap(async (req, res) => { res.json({ staff: meOut(req.staff) }); }));

  // ---------- header notifications: what needs attention, limited to what the person's role may open ----------
  router.get('/alerts', guard(), wrap(async (req, res) => {
    const s = req.staff;
    const items = [];
    const add = async (perm, key, sql, label, page) => {
      if (!can(s, perm)) return;
      const c = Number((await pool.query(sql))[0][0].n);
      if (c > 0) items.push({ key, n: c, label, page });
    };
    if (s.role !== 'Delivery rider') await add('orders.view', 'orders', "SELECT COUNT(*) n FROM orders WHERE status = 'Pending'", 'pending orders to confirm', 'orders');
    await add('services.manage', 'services', "SELECT COUNT(*) n FROM service_requests WHERE status = 'New'", 'new service requests', 'services');
    await add('reviews.moderate', 'reviews', "SELECT COUNT(*) n FROM reviews WHERE status = 'Pending'", 'reviews waiting for approval', 'reviews');
    await add('messages.manage', 'inbox', 'SELECT COUNT(*) n FROM messages WHERE created_at >= NOW() - INTERVAL 2 DAY', 'messages in the last 2 days', 'inbox');
    if (can(s, 'products.view')) {
      // active products with no picture are held back from the website until one is added
      const held = await unpublishedProducts(pool);
      if (held.length) items.push({ key: 'noimage', n: held.length, label: held.length === 1 ? 'product is not published: its picture is missing (' + held[0].name.slice(0, 40) + ')' : 'products are not published: their pictures are missing', page: 'products' });
    }
    await add('careers.manage', 'careers', "SELECT COUNT(*) n FROM applications WHERE stage = 'New'", 'new job applications', 'careers');
    await add('team.manage', 'team', "SELECT COUNT(*) n FROM staff WHERE status = 'Pending'", 'staff accounts to approve', 'team');
    await add('hub.view', 'returns', "SELECT COUNT(*) n FROM order_returns WHERE status = 'Requested'", 'return requests', 'deliveries');
    res.json({ items, total: items.reduce((a, i) => a + i.n, 0) });
  }));
}
