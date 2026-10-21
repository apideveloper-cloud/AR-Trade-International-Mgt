// Small helpers shared by the public and admin API routes
export const fail = (status, message) => Object.assign(new Error(message), { status });
export const digits = s => String(s || '').replace(/\D/g, '');
export const parseJson = v => (typeof v === 'string' ? JSON.parse(v) : v);

/** Wraps an async express handler so thrown errors become JSON responses. */
export const wrap = fn => (req, res) => fn(req, res).catch(e => {
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  res.status(500).json({ error: 'Server error' });
});

/** Password rule for customers and staff: at least 8 characters with a letter and a number. */
export const checkPassword = pw => {
  const s = String(pw || '');
  if (s.length < 8 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) throw fail(400, 'Password must be at least 8 characters and include a letter and a number');
};

/** Reads one cookie from the request (no cookie-parser dependency). */
export const readCookie = (req, name) => {
  const m = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
};
