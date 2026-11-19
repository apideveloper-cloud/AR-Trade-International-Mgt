// Storefront customer session: an HttpOnly cookie, so page scripts (and any XSS) can never read the token.
import { readCustomer, sessionCookie } from '../util.js';

export const userOut = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, address: u.address, area: u.area, role: u.role, memberCode: u.member_code || '' });

export const COOKIE = 'ar_session';
export const clearSessionCookie = `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
export const setSession = (req, res, u) => res.append('Set-Cookie', sessionCookie(req, u));
export const sendAuth = (req, res, u, extra = {}) => { setSession(req, res, u); res.json({ user: userOut(u), ...extra }); };

/** Sets req.user ({ id, role }) from the session cookie; with required=true anonymous requests get a 401. */
export function auth(required) {
  return async (req, res, next) => {
    try {
      const u = await readCustomer(req, COOKIE);
      req.user = u ? { id: u.id, role: u.role } : null;
    } catch (e) { console.error(e); return res.status(500).json({ error: 'Server error' }); }
    if (required && !req.user) return res.status(401).json({ error: 'Please sign in' });
    next();
  };
}
