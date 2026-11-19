// Staff routes: reports, automations and templates.
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { parseJson, wrap } from '../util.js';
import { getCfg } from './store.js';

/** Adds the report, automation and template routes to the staff router. */
export function registerInsightRoutes(staff) {
  staff.get('/reports', guard('marketing.manage'), wrap(async (req, res) => {
    const [[camps], [autos], [queued], [[subs]], [[unsub]]] = await Promise.all([pool.query('SELECT * FROM mkt_campaigns WHERE status = "Sent" ORDER BY send_at DESC'), pool.query('SELECT * FROM mkt_automations ORDER BY sort_order'), pool.query('SELECT automation_id, COUNT(*) n FROM mkt_outbox WHERE status = "Queued" GROUP BY automation_id'), pool.query('SELECT COUNT(*) n FROM subscribers'), pool.query('SELECT COUNT(*) n FROM mkt_log WHERE what LIKE "Unsubscribed%"')]);
    const cfg = await getCfg();
    const rows = [
      ...camps.map(c => ({ name: c.name, kind: 'Campaign · ' + c.tag, when: c.send_at, sent: c.sent, opens: c.opens, clicks: c.clicks, unsubs: c.unsubs, revenue: c.revenue })),
      ...autos.map(a => ({ name: a.name, kind: 'Automation', when: null, running: !!a.active, sent: a.sent, queued: queued.find(q => q.automation_id === a.id)?.n || 0, opens: a.opens || null, clicks: a.clicks || null, unsubs: a.unsubs, revenue: a.revenue || null }))
    ];
    const sum = k => rows.reduce((t, r) => t + (r[k] || 0), 0);
    res.json({
      connected: !!cfg.apiKey, subscribers: subs.n, unsubscribed: unsub.n, campaignsSent: camps.length, rows,
      totals: { sent: sum('sent'), opens: sum('opens'), clicks: sum('clicks'), unsubs: sum('unsubs'), revenue: sum('revenue') },
      hasTracking: rows.some(r => r.opens != null)
    });
  }));

  staff.get('/automations', guard('marketing.manage'), wrap(async (req, res) => {
    const [[rows], [queued]] = await Promise.all([pool.query('SELECT * FROM mkt_automations ORDER BY sort_order'), pool.query('SELECT automation_id, COUNT(*) n FROM mkt_outbox WHERE status = "Queued" GROUP BY automation_id')]);
    res.json(rows.map(a => ({ id: a.id, name: a.name, trigger: a.trigger_text, steps: parseJson(a.steps), active: !!a.active, queued: queued.find(q => q.automation_id === a.id)?.n || 0, live: a.id === 'welcome', sent: a.sent, opens: a.opens, clicks: a.clicks, revenue: a.revenue })));
  }));
  staff.put('/automations/:id', guard('marketing.manage'), wrap(async (req, res) => {
    await pool.query('UPDATE mkt_automations SET active = ? WHERE id = ?', [+!!req.body.active, req.params.id]);
    res.json({ ok: true });
  }));

  staff.get('/templates', guard('marketing.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM mkt_templates ORDER BY sort_order');
    res.json(rows.map(t => ({ id: t.id, name: t.name, kind: t.kind, subject: t.subject, preheader: t.preheader, headline: t.headline, body: t.body, cta: t.cta, hero: t.hero })));
  }));
}
