// Member profile ID of a customer account: SR + join year + a 5-digit number that counts up within that year (SR2026-00001).
// The number never changes and is never reused. Existing accounts get theirs in the order they joined.
import { pool } from './db.js';

export const MEMBER_PREFIX = 'SR';
const PREFIX_LEN = MEMBER_PREFIX.length + 5; // "SR2026-" is 7 characters, the number starts at the 8th

/** (2026, 1) -> "SR2026-00001". */
export const formatMemberCode = (year, n) => `${MEMBER_PREFIX}${year}-${String(n).padStart(5, '0')}`;
export const isMemberCode = s => /^SR\d{4}-\d{5,}$/.test(String(s || ''));

let countersReady;

/**
 * Gives the account its member ID when it has none yet, and returns it. Safe to call twice; pass a transaction
 * connection when the account was created inside one. The yearly counter is seeded from the highest number in use.
 */
export async function assignMemberCode(db, userId) {
  countersReady ||= pool.query('CREATE TABLE IF NOT EXISTS counters (name VARCHAR(30) PRIMARY KEY, v BIGINT NOT NULL)');
  await countersReady;
  const [[u]] = await db.query('SELECT YEAR(created_at) y, member_code FROM users WHERE id = ?', [userId]);
  if (!u) return null;
  if (u.member_code) return u.member_code;
  const name = 'mem_' + u.y;
  await db.query('INSERT IGNORE INTO counters (name, v) SELECT ?, COALESCE(MAX(CAST(SUBSTRING(member_code, ?) AS UNSIGNED)), 0) FROM users WHERE member_code LIKE ?', [name, PREFIX_LEN + 1, `${MEMBER_PREFIX}${u.y}-%`]);
  const [r] = await db.query('UPDATE counters SET v = LAST_INSERT_ID(v + 1) WHERE name = ?', [name]);
  const code = formatMemberCode(u.y, r.insertId);
  await db.query('UPDATE users SET member_code = ? WHERE id = ? AND member_code IS NULL', [code, userId]);
  return code;
}

/** Numbers every account that has no member ID yet, oldest first. Returns how many were numbered. */
export async function backfillMemberCodes(db = pool) {
  const [rows] = await db.query('SELECT id FROM users WHERE member_code IS NULL ORDER BY created_at, id');
  for (const { id } of rows) await assignMemberCode(db, id);
  return rows.length;
}
