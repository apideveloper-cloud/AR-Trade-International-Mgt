// Test helper (not a test): an in-memory stand-in for the tables review requests touch. Select queries return every row and rely on the
// code's own pure filters (due selection), so only the statements the code really issues are understood.
import { pool } from '../src/db.js';
import { clearSiteFilesCache } from '../src/growth/siteFiles.js';

export function fakeReviewDb({ orders = [], items = [], settings = null } = {}) {
  const db = { orders, items, requests: [], optouts: [], reviews: [], settings: new Map(), nextId: 1, nextOpt: 1 };
  if (settings) db.settings.set('growth', JSON.stringify({ reviewRequests: settings }));
  clearSiteFilesCache();
  pool.query = async (sql, p = []) => {
    const s = String(sql).replace(/\s+/g, ' ');
    let m;
    if (s.includes('SELECT v FROM settings')) return [db.settings.has(p[0]) ? [{ v: db.settings.get(p[0]) }] : []];
    if (s.includes('INSERT INTO settings')) { db.settings.set(p[0], p[1]); return [{}]; }
    if (s.startsWith('SELECT id, user_id, customer_name')) return [db.orders.filter(o => o.id === p[0])];
    if (s.startsWith('SELECT product_id FROM order_items WHERE order_id = ? LIMIT 1')) return [db.items.filter(i => i.order_id === p[0]).slice(0, 1)];
    if (s.startsWith('SELECT DISTINCT product_id FROM order_items')) return [db.items.filter(i => i.order_id === p[0])];
    if (s.startsWith('SELECT DISTINCT name FROM order_items')) return [db.items.filter(i => i.order_id === p[0])];
    if (s.startsWith('SELECT product_id, MIN(name)')) return [db.items.filter(i => i.order_id === p[0]).map(i => ({ product_id: i.product_id, name: i.name, img: i.img }))];
    if (s.startsWith('SELECT id FROM review_optouts')) return [db.optouts.filter(o => p[0].includes(o.contact_key))];
    if (s.startsWith('INSERT IGNORE INTO review_optouts')) { if (db.optouts.some(o => o.contact_key === p[0])) return [{ affectedRows: 0 }]; db.optouts.push({ id: db.nextOpt++, contact_key: p[0], kind: p[1] }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('INSERT IGNORE INTO review_requests')) {
      if (db.requests.some(r => r.order_id === p[0])) return [{ affectedRows: 0 }];
      const [order_id, user_id, name, email, phone, channel, status, send_at, expires_at] = p;
      db.requests.push({ id: db.nextId++, order_id, user_id, name, email, phone, channel, status, send_at, expires_at, sent_at: null, opened_at: null, reviewed_at: null, reminder_at: null, last_error: '' });
      return [{ affectedRows: 1 }];
    }
    if (s.startsWith('SELECT r.*, o.customer_name FROM review_requests')) { const r = db.requests.find(x => x.id === p[0]); const o = r && db.orders.find(x => x.id === r.order_id); return [r ? [{ ...r, customer_name: o?.customer_name }] : []]; }
    if (s.startsWith('SELECT * FROM review_requests WHERE id = ?')) return [db.requests.filter(r => r.id === p[0])];
    if (s.startsWith('SELECT * FROM review_requests WHERE')) return [db.requests.map(r => ({ ...r }))];
    if ((m = s.match(/^UPDATE review_requests SET (.+) WHERE id = \? AND status = 'Queued'$/))) { const r = db.requests.find(x => x.id === p[1]); if (!r || r.status !== 'Queued') return [{ affectedRows: 0 }]; r.status = 'Sent'; r.sent_at = p[0]; return [{ affectedRows: 1 }]; }
    if (s.startsWith('UPDATE review_requests SET reminder_at = ? WHERE id = ? AND reminder_at IS NULL')) { const r = db.requests.find(x => x.id === p[1]); if (!r || r.reminder_at) return [{ affectedRows: 0 }]; r.reminder_at = p[0]; return [{ affectedRows: 1 }]; }
    if (s.startsWith('UPDATE review_requests SET opened_at = COALESCE')) { const r = db.requests.find(x => x.id === p[2]); r.opened_at ||= p[0]; r.sent_at ||= p[1]; if (['Queued', 'Sent'].includes(r.status)) r.status = 'Opened'; return [{ affectedRows: 1 }]; }
    if (s.startsWith("UPDATE review_requests SET status = 'Reviewed'")) { const r = db.requests.find(x => x.id === p[1]); if (r && ['Queued', 'Sent', 'Opened'].includes(r.status)) { r.status = 'Reviewed'; r.reviewed_at = p[0]; } return [{ affectedRows: 1 }]; }
    if (s.startsWith("UPDATE review_requests SET status = 'OptedOut'")) {
      let n = 0;
      for (const r of db.requests) if (['Queued', 'Sent', 'Opened', 'Failed'].includes(r.status) && (r.id === p[0] || (r.email && r.email.toLowerCase() === p[1]) || (r.phone && r.phone === p[2]))) { r.status = 'OptedOut'; n++; }
      return [{ affectedRows: n }];
    }
    if ((m = s.match(/^UPDATE review_requests SET (.+) WHERE id = \?$/))) { const r = db.requests.find(x => x.id === p[p.length - 1]); m[1].split(', ').forEach((c, i) => { r[c.split(' = ')[0]] = p[i]; }); return [{ affectedRows: 1 }]; }
    if (s.startsWith('SELECT product_id FROM reviews')) return [db.reviews.filter(r => r.order_id === p[0] && r.status !== 'Rejected')];
    if (s.startsWith('INSERT INTO reviews')) { const [product_id, user_id, name, rating, title, body, verified, status, order_id, source, ip_hash, spam_reason] = p; db.reviews.push({ product_id, user_id, name, rating, title, body, verified, status, order_id, source, ip_hash, spam_reason }); return [{ affectedRows: 1 }]; }
    throw new Error('growth_review_fake: unexpected SQL ' + s.slice(0, 100));
  };
  return db;
}
