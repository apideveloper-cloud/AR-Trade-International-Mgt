// Stored 301 redirects (table seo_redirects): helpers to validate, store and keep them loop-free. The pure functions have no database.
export const MAX_PATH = 500;
const BAD_CHARS = /[\s"'<>\\\u0000-\u001f]/;

/** '/Product/x/?a=1#b' -> '/Product/x' (query and hash dropped, trailing slash dropped except for '/'). Returns '' when it is not a site path. */
export function normaliseRedirectPath(p) {
  let s = String(p ?? '').trim();
  if (!s.startsWith('/') || s.startsWith('//') || BAD_CHARS.test(s)) return '';
  s = s.replace(/[?#].*$/, '');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s || '/';
}

function targetOf(t) {
  if (/^https:\/\//i.test(t)) {
    try { if (!new URL(t).hostname || BAD_CHARS.test(t)) return ''; return t; } catch { return ''; }
  }
  if (!t.startsWith('/') || t.startsWith('//') || BAD_CHARS.test(t)) return '';
  const hash = t.indexOf('#');
  const s = hash >= 0 ? t.slice(0, hash) : t;
  return s.length > 1 ? s.replace(/\/+(?=\?|$)/, '') : s;
}

/** Validates one redirect. Returns { source, target, code } clean or throws Error (message is user-facing). */
export function checkRedirect({ source, target, code = 301 }) {
  const raw = String(source ?? '').trim();
  if (/[?#]/.test(raw)) throw new Error('The old address must not contain a query or #');
  const src = normaliseRedirectPath(raw);
  if (!src) throw new Error('The old address must be a path starting with /');
  if (src.length > MAX_PATH) throw new Error('The old address is too long');
  const tgt = targetOf(String(target ?? '').trim());
  if (!tgt) throw new Error('The new address must be a path starting with / or an https URL');
  if (tgt.length > MAX_PATH) throw new Error('The new address is too long');
  if (tgt === src) throw new Error('The old and new address are the same');
  const c = Number(code);
  if (![301, 302, 307, 308].includes(c)) throw new Error('Redirect code must be 301, 302, 307 or 308');
  return { source: src, target: tgt, code: c };
}

/** rows = [{source,target}]. True when adding source -> target would make a cycle: following target through rows reaches source within 5 hops. */
export function detectLoop(rows, source, target) {
  const next = new Map((rows || []).map(r => [r.source, r.target]));
  let cur = target;
  for (let hop = 0; hop <= 5 && cur != null; hop++) {
    if (cur === source) return true;
    cur = next.get(cur);
  }
  return false;
}

/** Stores one redirect (upsert by source). Throws Error on bad input or when it would create a loop. */
export async function addRedirect(db, { source, target, code = 301, auto = 0 }) {
  const r = checkRedirect({ source, target, code });
  const [rows] = await db.query('SELECT source, target FROM seo_redirects');
  if (detectLoop(rows.filter(x => x.source !== r.source), r.source, r.target)) throw new Error('This redirect would loop back to itself');
  await db.query('INSERT INTO seo_redirects (source, target, code, auto) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE target = VALUES(target), code = VALUES(code), auto = VALUES(auto)', [r.source, r.target, r.code, auto ? 1 : 0]);
  return r;
}

/** A page moved from oldUrl to newUrl: the new address stops being a redirect source, redirects that pointed at the old one now point at the new one (no chains), then old -> new is stored. */
export async function moveRedirect(db, oldUrl, newUrl) {
  await db.query('DELETE FROM seo_redirects WHERE source = ?', [newUrl]);
  await db.query('UPDATE seo_redirects SET target = ? WHERE target = ?', [newUrl, oldUrl]);
  await db.query('DELETE FROM seo_redirects WHERE source = target');
  return addRedirect(db, { source: oldUrl, target: newUrl, code: 301, auto: 1 });
}
