// Staff sign-in token and the permission guard every admin route sits behind.
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { fail, secret } from '../util.js';
import { can, permsOf } from '../permissions.js';

export const staffOut = s => ({ id: s.id, name: s.name, email: s.email, phone: s.phone, role: s.role, status: s.status, since: s.created_at });
/** The signed-in user as the console needs it: includes the permissions their role holds right now. */
export const meOut = s => ({ ...staffOut(s), perms: [...permsOf(s.role)] });
export const sign = (s, remember = false) => jwt.sign({ sid: s.id, srole: s.role }, secret(), { expiresIn: remember ? '7d' : '12h' }); // "Remember me" keeps the session for 7 days

/** Express middleware: requires a signed-in, active staff member. `need` is a permission (or a list: any one is enough) from the role matrix. */
export const guard = need => async (req, res, next) => {
  try {
    let t;
    try { t = jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), secret()); } catch { throw fail(401, 'Please sign in to the admin console'); }
    if (!t.sid) throw fail(401, 'Please sign in to the admin console');
    const [[s]] = await pool.query('SELECT * FROM staff WHERE id = ?', [t.sid]);
    if (!s || s.status !== 'Active') throw fail(401, 'Your account is not active');
    if (need && !can(s, need)) throw fail(403, 'Your role cannot do this');
    req.staff = s;
    next();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
