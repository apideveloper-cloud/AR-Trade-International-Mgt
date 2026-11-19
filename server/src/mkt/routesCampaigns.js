// Staff routes: campaigns (with optional A/B subject), the product picker, the live preview and results entry.
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { fail, wrap } from '../util.js';
import { mailReady, siteUrl } from '../mailer.js';
import { renderEmail } from '../emailTemplate.js';
import { TAGS, campOut, cleanDesign } from './helpers.js';
import { productsByIds } from './store.js';
import { tick } from './worker.js';

/** A result figure from the form: blank stays null, anything else becomes a whole number of at least 0. */
export const resultNumber = v => (v === '' || v == null ? null : Math.max(0, parseInt(v, 10) || 0));

/** Adds the campaign routes to the staff router. */
export function registerCampaignRoutes(staff) {
  staff.get('/campaigns', guard('marketing.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM mkt_campaigns ORDER BY send_at DESC');
    res.json(rows.map(campOut));
  }));
  staff.post('/campaigns', guard('marketing.manage'), wrap(async (req, res) => {
    const { name, tpl, subjA, subjB, aud, when, body } = req.body;
    const design = cleanDesign(req.body.design);
    if (!name || !subjA) throw fail(400, 'Campaign name and subject line A are required');
    const [[t]] = tpl ? await pool.query('SELECT * FROM mkt_templates WHERE id = ?', [tpl]) : [[null]];
    const tag = TAGS[tpl] || (t?.kind === 'Health tip' ? 'Health tip' : 'Offer');
    const at = when ? new Date(when) : new Date();
    if (isNaN(at)) throw fail(400, 'Choose a valid send date');
    if (String(name).length > 160 || String(subjA).length > 200 || String(subjB || '').length > 200) throw fail(400, 'The name or subject line is too long');
    const kind = ['offers', 'festivals', 'tips', 'all'].includes(aud) ? aud : 'offers';
    // a campaign is only "Sent" once the mail worker has really sent it; until then it stays Scheduled
    const [r] = await pool.query('INSERT INTO mkt_campaigns (name,tag,template_id,subj_a,subj_b,body,design,audience,status,send_at,sent) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [name, tag, tpl || null, subjA, subjB || '', body || null, JSON.stringify(design), kind, 'Scheduled', at, 0]);
    const [[c]] = await pool.query('SELECT * FROM mkt_campaigns WHERE id = ?', [r.insertId]);
    res.json(campOut(c));
  }));
  /** Product picker for the campaign designer. */
  staff.get('/products', guard('marketing.manage'), wrap(async (req, res) => {
    const q = '%' + String(req.query.q || '').trim().replace(/[%_]/g, '') + '%';
    const [rows] = await pool.query('SELECT id, brand, name, old_price, price, img FROM products WHERE active = 1 AND (name LIKE ? OR brand LIKE ?) ORDER BY featured DESC, popular DESC, id DESC LIMIT 30', [q, q]);
    res.json(rows.map(r => ({ id: r.id, brand: r.brand, name: r.name, price: r.price, old: r.old_price, img: r.img })));
  }));
  /** Live preview of the email exactly as the template renders it (sample unsubscribe link, nothing is sent). */
  staff.post('/preview', guard('marketing.manage'), wrap(async (req, res) => {
    const { subject, body, tpl } = req.body;
    const [[t]] = tpl ? await pool.query('SELECT * FROM mkt_templates WHERE id = ?', [tpl]) : [[null]];
    const d = cleanDesign(req.body.design);
    const base = siteUrl() || req.protocol + '://' + req.get('host'); // preview only: real mail always uses SITE_URL
    const { html } = renderEmail({
      subject, preheader: t?.preheader, kicker: d.kicker, headline: d.headline || t?.headline || subject || 'Your headline', body: body || t?.body || '', hero: d.hero,
      cta: d.cta || t?.cta, ctaUrl: d.ctaUrl || base + '/shop/all', products: await productsByIds(d.products), prefsUrl: base + '/prefs/preview', siteUrl: base
    });
    res.json({ html });
  }));
  staff.post('/campaigns/:id/send', guard('marketing.manage'), wrap(async (req, res) => {
    const [[c]] = await pool.query('SELECT * FROM mkt_campaigns WHERE id = ?', [req.params.id]);
    if (!c || c.status !== 'Scheduled') throw fail(400, 'Only scheduled campaigns can be sent');
    if (!mailReady() || !siteUrl()) throw fail(409, 'Email sending is not set up yet (SMTP_HOST and SITE_URL in server/.env), so nothing can be sent.');
    await pool.query('UPDATE mkt_campaigns SET send_at = NOW() WHERE id = ?', [c.id]);
    tick(); // the worker picks it up now rather than at the next minute
    res.json({ ok: true, queued: true });
  }));
  staff.delete('/campaigns/:id', guard('marketing.manage'), wrap(async (req, res) => {
    await pool.query('DELETE FROM mkt_campaigns WHERE id = ? AND status = "Scheduled"', [req.params.id]);
    res.json({ ok: true });
  }));
  /** Enter results copied from the email provider's dashboard (or posted by a provider webhook later). */
  staff.put('/campaigns/:id/results', guard('marketing.manage'), wrap(async (req, res) => {
    const n = resultNumber;
    const { opens, clicks, unsubs, revenue, abA, abB } = req.body;
    await pool.query('UPDATE mkt_campaigns SET opens = ?, clicks = ?, unsubs = ?, revenue = ?, ab_a = ?, ab_b = ? WHERE id = ? AND status = "Sent"',
      [n(opens), n(clicks), n(unsubs) ?? 0, n(revenue), n(abA), n(abB), req.params.id]);
    res.json({ ok: true });
  }));
}
