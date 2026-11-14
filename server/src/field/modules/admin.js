// Admin console of the field app (admin role only).
//   GET /api/field/admin/overview            web orders / revenue / automations count
//   GET /api/field/admin/automation          the three automation switches with live status text
//   PUT /api/field/admin/automation/:key     { enabled }
// (The per-module switches live in modules/modules.js: /api/field/modules/config.)
import { Router } from 'express';
import { pool, guardRole, wrap, fail } from '../common.js';
import { period, tsBetween, tkText, pctDelta } from '../report_util.js';

const router = Router();
const admin = guardRole('admin');

const AUTOS = [
  { key: 'accounting', icon: 'sync', title: 'Automated accounting', bn: 'বিক্রয়, পারচেজ ও ইনভয়েস অটো হিসাবভুক্ত', color: 'ok' },
  { key: 'seo', icon: 'travel_explore', title: 'SEO automation', bn: 'সার্চ র‍্যাঙ্কিং ধরে রাখতে অটো এসইও', color: 'info' },
  { key: 'mail_feedback', icon: 'forward_to_inbox', title: 'Auto mail feedback', bn: 'গ্রাহকের মেইল/ফিডব্যাকে তাৎক্ষণিক উত্তর', color: 'warn' }
];
const ago = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

async function statusText(key) {
  try {
    if (key === 'accounting') {
      const [[r]] = await pool.query('SELECT COUNT(*) n, MAX(created_at) last FROM field_invoices WHERE created_at >= NOW() - INTERVAL 30 DAY');
      return r.n ? `Last sync ${ago(Date.now() - new Date(r.last).getTime())} · ${r.n} invoices posted` : 'Waiting for the first invoice';
    }
    if (key === 'seo') {
      const [[r]] = await pool.query('SELECT COUNT(*) n FROM products WHERE active = 1');
      return `SEO policies applied to ${r.n} product pages`;
    }
    const [[r]] = await pool.query('SELECT COUNT(*) n FROM messages');
    return `${r.n} customer messages in the inbox · replies on auto`;
  } catch { return 'Running'; }
}

router.get('/overview', admin, wrap(async (req, res) => {
  const now = new Date();
  const cur = { start: new Date(now.getTime() - 30 * 864e5), end: now };
  const prev = { start: new Date(now.getTime() - 60 * 864e5), end: cur.start };
  const q = async w => { const t = tsBetween('created_at', w.start, w.end); const [[r]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(total), 0) s FROM orders WHERE status <> 'Cancelled' AND ${t.sql}`, t.args); return r; };
  const day = period('day');
  const td = tsBetween('created_at', day.start, day.end);
  const [[today]] = await pool.query(`SELECT COUNT(*) n FROM orders WHERE status <> 'Cancelled' AND ${td.sql}`, td.args);
  const c = await q(cur), p = await q(prev);
  const [[all]] = await pool.query("SELECT COUNT(*) n FROM orders WHERE status <> 'Cancelled'");
  const [autos] = await pool.query('SELECT k, enabled FROM field_automation');
  const on = autos.filter(a => a.enabled).length;
  res.json({
    webOrders: { count: c.n, total: all.n, today: today.n, sub: `+${today.n} today` },
    revenue: { amount: Math.round(c.s), display: tkText(c.s), delta: pctDelta(Number(c.s), Number(p.s)) },
    automations: { on, total: AUTOS.length, label: on === AUTOS.length ? 'All running' : `${AUTOS.length - on} paused` }
  });
}));

router.get('/automation', admin, wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT k, enabled FROM field_automation');
  const out = [];
  for (const a of AUTOS) {
    const on = !!rows.find(r => r.k === a.key)?.enabled;
    out.push({ ...a, enabled: on, status: on ? await statusText(a.key) : 'Paused · manual mode' });
  }
  res.json(out);
}));

router.put('/automation/:key', admin, wrap(async (req, res) => {
  if (!AUTOS.some(a => a.key === req.params.key)) throw fail(404, 'Unknown automation');
  await pool.query('UPDATE field_automation SET enabled = ?, updated_by = ? WHERE k = ?', [req.body.enabled ? 1 : 0, req.staff.name, req.params.key]);
  res.json({ key: req.params.key, enabled: !!req.body.enabled });
}));

export default router;
