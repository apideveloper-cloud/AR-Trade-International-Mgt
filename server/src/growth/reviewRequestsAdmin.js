// Read side of the review request screens: counts, list rows (with the WhatsApp link), opt-outs.
import { pool } from '../db.js';
import { mailReady, mailSetupHint } from '../mailer.js';
import { SHOP, firstName, productsText, renderMessage, pickLanguage, waUrl } from './reviewRequestsCore.js';
import { linksFor, productNames } from './reviewRequestsMail.js';
import { readSettings } from './reviewRequests.js';

const STATUSES = ['Queued', 'Sent', 'Opened', 'Reviewed', 'Expired', 'Failed', 'Cancelled', 'OptedOut'];
const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);

export async function reviewStats() {
  const s = await readSettings();
  const [by] = await pool.query('SELECT status, COUNT(*) n FROM review_requests GROUP BY status');
  const n = Object.fromEntries(by.map(r => [r.status, Number(r.n)]));
  const [[wa]] = await pool.query("SELECT COUNT(*) n FROM review_requests WHERE channel = 'whatsapp' AND status = 'Queued'");
  const [[oo]] = await pool.query('SELECT COUNT(*) n FROM review_optouts');
  const [[all]] = await pool.query('SELECT COUNT(*) sent, SUM(status = "Reviewed") reviewed FROM review_requests WHERE sent_at IS NOT NULL OR status = "Reviewed"');
  const [[m]] = await pool.query('SELECT SUM(sent_at >= ?) sent, SUM(status = "Reviewed" AND reviewed_at >= ?) reviewed FROM review_requests', [new Date(Date.now() - 30 * 864e5), new Date(Date.now() - 30 * 864e5)]);
  const sent = Number(all?.sent || 0), reviewed = Number(all?.reviewed || 0);
  return {
    enabled: s.enabled, mailReady: mailReady('sales'), mailHint: mailReady('sales') ? '' : mailSetupHint('sales'),
    counts: { queued: n.Queued || 0, sent: n.Sent || 0, opened: n.Opened || 0, reviewed: n.Reviewed || 0, expired: n.Expired || 0, failed: n.Failed || 0, whatsappWaiting: Number(wa?.n || 0), optedOut: Number(oo?.n || 0) },
    rate: { sent, reviewed, pct: pct(reviewed, sent) }, last30: { sent: Number(m?.sent || 0), reviewed: Number(m?.reviewed || 0) }
  };
}

const paging = q => { const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 15)), page = Math.max(1, parseInt(q.page, 10) || 1); return { limit, page, offset: (page - 1) * limit }; };
const iso = d => (d ? new Date(d).toISOString() : null);

export async function listRequests(q) {
  const { limit, page, offset } = paging(q);
  const status = STATUSES.includes(q.status) ? q.status : '';
  const where = status ? 'WHERE status = ?' : '', p = status ? [status] : [];
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) total FROM review_requests ${where}`, p);
  const [rows] = await pool.query(`SELECT * FROM review_requests ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...p, limit, offset]);
  const s = await readSettings(), out = [];
  for (const r of rows) {
    let whatsappUrl = '';
    if (r.channel === 'whatsapp' && ['Queued', 'Sent'].includes(r.status)) {
      try {
        const { link, optout } = await linksFor(r);
        const m = renderMessage(s, pickLanguage(s.language, r.name), { name: firstName(r.name), shop: SHOP, products: productsText(await productNames(r.order_id)), link, optout });
        whatsappUrl = waUrl(r.phone, m.body.split('\n').filter(x => !x.includes(optout)).join('\n').replace(/\n{3,}/g, '\n\n').trim());
      } catch { whatsappUrl = ''; }
    }
    out.push({ id: Number(r.id), orderId: r.order_id, orderRef: r.order_id, name: r.name, email: r.email, phone: r.phone, channel: r.channel, status: r.status, sendAt: iso(r.send_at), sentAt: iso(r.sent_at), openedAt: iso(r.opened_at), reviewedAt: iso(r.reviewed_at), reminderAt: iso(r.reminder_at), lastError: r.last_error || '', ...(whatsappUrl ? { whatsappUrl } : {}) });
  }
  return { rows: out, total: Number(total), page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listOptouts(q) {
  const { limit, page, offset } = paging(q);
  const [[{ total }]] = await pool.query('SELECT COUNT(*) total FROM review_optouts');
  const [rows] = await pool.query('SELECT id, contact_key, kind, created_at FROM review_optouts ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
  return { rows: rows.map(r => ({ id: r.id, contact: r.contact_key, kind: r.kind, createdAt: iso(r.created_at) })), total: Number(total), page, pages: Math.max(1, Math.ceil(total / limit)) };
}
