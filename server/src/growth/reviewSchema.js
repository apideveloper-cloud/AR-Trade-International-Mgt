// Review table upgrades for Phase 3 (reply, Spam status, order link, source) plus the pure helpers the admin review routes use.
// ensureReviewColumns() is called from migrate.js on every start: it only adds what is missing.
import { pool } from '../db.js';

export const REVIEW_STATUSES = ['Pending', 'Approved', 'Rejected', 'Spam'];

export const REVIEW_COLUMNS = [
  ['admin_reply', 'TEXT NULL'],
  ['replied_at', 'DATETIME NULL'],
  ['replied_by', "VARCHAR(80) NOT NULL DEFAULT ''"],
  ['order_id', 'VARCHAR(20) NULL'], // orders.id is text like WP-20960
  ['source', "VARCHAR(12) NOT NULL DEFAULT 'site'"],
  ['ip_hash', "VARCHAR(64) NOT NULL DEFAULT ''"],
  ['spam_reason', "VARCHAR(120) NOT NULL DEFAULT ''"]
];

export async function ensureReviewColumns() {
  const [cols] = await pool.query("SELECT COLUMN_NAME c, COLUMN_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'");
  if (!cols.length) return; // table not there yet
  const have = new Set(cols.map(r => r.c));
  for (const [name, def] of REVIEW_COLUMNS) {
    if (have.has(name)) continue;
    await pool.query(`ALTER TABLE reviews ADD COLUMN ${name} ${def}`);
    console.log('Added reviews.' + name);
  }
  const oid = cols.find(r => r.c === 'order_id'); // an earlier build made it INT: orders.id is text
  if (oid && /^int/i.test(String(oid.t))) { await pool.query('ALTER TABLE reviews MODIFY COLUMN order_id VARCHAR(20) NULL'); console.log('Changed reviews.order_id to text'); }
  const st = cols.find(r => r.c === 'status');
  if (st && !/'Spam'/.test(String(st.t))) {
    await pool.query("ALTER TABLE reviews MODIFY COLUMN status ENUM('Pending','Approved','Rejected','Spam') NOT NULL DEFAULT 'Pending'");
    console.log("Added 'Spam' to reviews.status");
  }
  const [ix] = await pool.query("SELECT INDEX_NAME i FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND INDEX_NAME = 'idx_order'");
  if (!ix.length) { await pool.query('ALTER TABLE reviews ADD INDEX idx_order (order_id)'); console.log('Added reviews index idx_order'); }
}

/** Validate the PUT /reviews/:id body -> { sets:[sql fragments], vals:[], status?, reply? } (throws { status, message }-style Error via fail callback). */
export function parseReviewUpdate(body, staffName, failFn = (c, m) => Object.assign(new Error(m), { status: c })) {
  const b = body || {};
  const sets = [], vals = [];
  const hasStatus = b.status !== undefined && b.status !== null;
  const hasReply = b.reply !== undefined && b.reply !== null;
  if (!hasStatus && !hasReply) throw failFn(400, 'Nothing to update');
  if (hasStatus) {
    if (!REVIEW_STATUSES.includes(b.status)) throw failFn(400, 'Unknown status');
    sets.push('status = ?', 'reviewed_at = NOW()'); vals.push(b.status);
  }
  if (hasReply) {
    if (typeof b.reply !== 'string') throw failFn(400, 'Reply must be text');
    const text = b.reply.trim();
    if (text.length > 1000) throw failFn(400, 'Reply is too long (1000 characters max)');
    if (text) { sets.push('admin_reply = ?', 'replied_at = NOW()', 'replied_by = ?'); vals.push(text, String(staffName || '').slice(0, 80)); }
    else sets.push('admin_reply = NULL', 'replied_at = NULL', "replied_by = ''");
  }
  return { sets, vals, status: hasStatus ? b.status : undefined, reply: hasReply ? b.reply.trim() : undefined };
}

/** Shape the aggregate rows of the stats queries. byStatus: [{status,n}], approved: [{rating,n,verified}], last30: {received, approved}, replied: number. */
export function buildReviewStats({ byStatus = [], approvedRows = [], last30 = {}, replied = 0 } = {}) {
  const c = { Pending: 0, Approved: 0, Rejected: 0, Spam: 0 };
  for (const r of byStatus) if (r.status in c) c[r.status] = Number(r.n) || 0;
  const byRating = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0, n = 0, verified = 0;
  for (const r of approvedRows) {
    const k = Number(r.rating), cnt = Number(r.n) || 0;
    if (!(k >= 1 && k <= 5)) continue;
    byRating[k] += cnt; sum += k * cnt; n += cnt; verified += Math.min(cnt, Number(r.verified) || 0);
  }
  const r2 = x => Math.round(x * 100) / 100;
  return {
    total: c.Pending + c.Approved + c.Rejected + c.Spam,
    pending: c.Pending, approved: c.Approved, rejected: c.Rejected, spam: c.Spam,
    avgRating: n ? r2(sum / n) : 0,
    byRating,
    verifiedShare: n ? r2(verified / n) : 0,
    last30: { received: Number(last30.received) || 0, approved: Number(last30.approved) || 0 },
    repliedShare: n ? r2(Math.min(Number(replied) || 0, n) / n) : 0
  };
}
