import { Router } from 'express';
import dns from 'node:dns/promises';
import { pool } from './db.js';
import { ADMINS, guard } from './admin.js';
import { fail, parseJson, wrap } from './util.js';

const staff = Router();
const pub = Router();
const MKT = [...ADMINS, 'Marketing manager'];
const PREF_KEYS = ['offers', 'festivals', 'tips', 'refill'];
const PROVIDERS = {
  Mailchimp: { d: 'Easy campaigns', spf: 'servers.mcsv.net', dkim: ['k2._domainkey', 'dkim2.mcsv.net'] },
  Brevo: { d: 'Email + SMS', spf: 'spf.brevo.com', dkim: ['brevo1._domainkey', 'b1.artradeinternational.com.dkim.brevo.com'] },
  'Amazon SES': { d: 'Lowest cost at scale', spf: 'amazonses.com', dkim: ['selector._domainkey', 'selector.dkim.amazonses.com'] }
};

const getCfg = async () => { const [[r]] = await pool.query('SELECT v FROM settings WHERE k = "mkt"'); return parseJson(r.v); };
const putCfg = cfg => pool.query('UPDATE settings SET v = ? WHERE k = "mkt"', [JSON.stringify(cfg)]);
const logPref = (email, what) => pool.query('INSERT INTO mkt_log (email,what) VALUES (?,?)', [email, what]);

const prefsOf = row => ({ offers: !!(row?.offers ?? 1), festivals: !!(row?.festivals ?? 1), tips: !!(row?.tips ?? 1), refill: !!(row?.refill ?? 1) });
const campOut = c => ({
  id: c.id, code: 'CMP-' + (200 + c.id), name: c.name, tag: c.tag, template: c.template_id, subjA: c.subj_a, subjB: c.subj_b, audience: c.audience, status: c.status, at: c.send_at,
  sent: c.sent, opens: c.opens, clicks: c.clicks, unsubs: c.unsubs, revenue: c.revenue, ab: c.ab_a != null && c.ab_b != null ? [c.ab_a, c.ab_b] : null
});

/** Confirmed subscribers who allow this kind of email. */
async function audience(kind) {
  const [subs] = await pool.query('SELECT s.email, p.offers, p.festivals, p.tips, p.refill FROM subscribers s LEFT JOIN mkt_prefs p ON p.email = s.email');
  return subs.filter(r => kind === 'all' || (r[kind] ?? 1));
}

/** Called when somebody confirms their subscription: queue the welcome series if it is switched on. */
export async function onSubscribed(email) {
  const [[a]] = await pool.query('SELECT * FROM mkt_automations WHERE id = "welcome" AND active = 1');
  if (!a) return;
  const [[ex]] = await pool.query('SELECT COUNT(*) n FROM mkt_outbox WHERE email = ? AND automation_id = "welcome"', [email]);
  if (ex.n) return;
  const days = { 'Day 0': 0, 'Day 2': 2, 'Day 7': 7 };
  for (const [label, subject] of parseJson(a.steps)) {
    await pool.query('INSERT INTO mkt_outbox (email,automation_id,step_label,subject,send_at) VALUES (?,?,?,?,DATE_ADD(NOW(), INTERVAL ? DAY))', [email, 'welcome', label, subject, days[label] ?? 0]);
  }
}

// ---------- staff: reports ----------
staff.get('/reports', guard(MKT), wrap(async (req, res) => {
  const [camps] = await pool.query('SELECT * FROM mkt_campaigns WHERE status = "Sent" ORDER BY send_at DESC');
  const [autos] = await pool.query('SELECT * FROM mkt_automations ORDER BY sort_order');
  const [queued] = await pool.query('SELECT automation_id, COUNT(*) n FROM mkt_outbox WHERE status = "Queued" GROUP BY automation_id');
  const [[subs]] = await pool.query('SELECT COUNT(*) n FROM subscribers');
  const [[unsub]] = await pool.query('SELECT COUNT(*) n FROM mkt_log WHERE what LIKE "Unsubscribed%"');
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

// ---------- automations ----------
staff.get('/automations', guard(MKT), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM mkt_automations ORDER BY sort_order');
  const [queued] = await pool.query('SELECT automation_id, COUNT(*) n FROM mkt_outbox WHERE status = "Queued" GROUP BY automation_id');
  res.json(rows.map(a => ({ id: a.id, name: a.name, trigger: a.trigger_text, steps: parseJson(a.steps), active: !!a.active, queued: queued.find(q => q.automation_id === a.id)?.n || 0, live: a.id === 'welcome', sent: a.sent, opens: a.opens, clicks: a.clicks, revenue: a.revenue })));
}));
staff.put('/automations/:id', guard(MKT), wrap(async (req, res) => {
  await pool.query('UPDATE mkt_automations SET active = ? WHERE id = ?', [+!!req.body.active, req.params.id]);
  res.json({ ok: true });
}));

// ---------- templates ----------
staff.get('/templates', guard(MKT), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM mkt_templates ORDER BY sort_order');
  res.json(rows.map(t => ({ id: t.id, name: t.name, kind: t.kind, subject: t.subject, preheader: t.preheader, headline: t.headline, body: t.body, cta: t.cta, hero: t.hero })));
}));

// ---------- campaigns (with optional A/B subject) ----------
const TAGS = { 't-eid': 'Eid', 't-puja': 'Puja', 't-boishakh': 'Boishakh' };
staff.get('/campaigns', guard(MKT), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM mkt_campaigns ORDER BY send_at DESC');
  res.json(rows.map(campOut));
}));
staff.post('/campaigns', guard(MKT), wrap(async (req, res) => {
  const { name, tpl, subjA, subjB, aud, when, body } = req.body;
  if (!name || !subjA) throw fail(400, 'Campaign name and subject line A are required');
  const [[t]] = tpl ? await pool.query('SELECT * FROM mkt_templates WHERE id = ?', [tpl]) : [[null]];
  const tag = TAGS[tpl] || (t?.kind === 'Health tip' ? 'Health tip' : 'Offer');
  const at = when ? new Date(when) : new Date();
  const later = at.getTime() > Date.now() + 60000;
  const kind = ['offers', 'festivals', 'tips', 'all'].includes(aud) ? aud : 'offers';
  const sent = later ? 0 : (await audience(kind)).length;
  const [r] = await pool.query('INSERT INTO mkt_campaigns (name,tag,template_id,subj_a,subj_b,body,audience,status,send_at,sent) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [name, tag, tpl || null, subjA, subjB || '', body || null, kind, later ? 'Scheduled' : 'Sent', at.toISOString().slice(0, 19).replace('T', ' '), sent]);
  const [[c]] = await pool.query('SELECT * FROM mkt_campaigns WHERE id = ?', [r.insertId]);
  res.json(campOut(c));
}));
staff.post('/campaigns/:id/send', guard(MKT), wrap(async (req, res) => {
  const [[c]] = await pool.query('SELECT * FROM mkt_campaigns WHERE id = ?', [req.params.id]);
  if (!c || c.status !== 'Scheduled') throw fail(400, 'Only scheduled campaigns can be sent');
  await pool.query('UPDATE mkt_campaigns SET status = "Sent", send_at = NOW(), sent = ? WHERE id = ?', [(await audience(c.audience)).length, c.id]);
  res.json({ ok: true });
}));
staff.delete('/campaigns/:id', guard(MKT), wrap(async (req, res) => {
  await pool.query('DELETE FROM mkt_campaigns WHERE id = ? AND status = "Scheduled"', [req.params.id]);
  res.json({ ok: true });
}));
/** Enter results copied from the email provider's dashboard (or posted by a provider webhook later). */
staff.put('/campaigns/:id/results', guard(MKT), wrap(async (req, res) => {
  const n = v => (v === '' || v == null ? null : Math.max(0, parseInt(v, 10) || 0));
  const { opens, clicks, unsubs, revenue, abA, abB } = req.body;
  await pool.query('UPDATE mkt_campaigns SET opens = ?, clicks = ?, unsubs = ?, revenue = ?, ab_a = ?, ab_b = ? WHERE id = ? AND status = "Sent"',
    [n(opens), n(clicks), n(unsubs) ?? 0, n(revenue), n(abA), n(abB), req.params.id]);
  res.json({ ok: true });
}));

// ---------- audience, preferences, log ----------
staff.get('/audience', guard(MKT), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT s.email, s.created_at, p.offers, p.festivals, p.tips, p.refill, (SELECT token FROM consents c WHERE c.email = s.email AND c.status <> "Unsubscribed" ORDER BY c.id DESC LIMIT 1) token FROM subscribers s LEFT JOIN mkt_prefs p ON p.email = s.email ORDER BY s.created_at DESC');
  const [log] = await pool.query('SELECT * FROM mkt_log ORDER BY id DESC LIMIT 40');
  res.json({ subscribers: rows.map(r => ({ email: r.email, since: r.created_at, token: r.token, prefs: prefsOf(r) })), log: log.map(l => ({ email: l.email, what: l.what, at: l.at })) });
}));
staff.delete('/audience/:email', guard(MKT), wrap(async (req, res) => {
  await pool.query('DELETE FROM subscribers WHERE email = ?', [req.params.email]);
  await pool.query('UPDATE consents SET status = "Unsubscribed" WHERE email = ? AND status <> "Unsubscribed"', [req.params.email]);
  await pool.query('UPDATE mkt_outbox SET status = "Skipped" WHERE email = ? AND status = "Queued"', [req.params.email]);
  await logPref(req.params.email, 'Unsubscribed by staff on request');
  res.json({ ok: true });
}));

// ---------- sending & compliance ----------
staff.get('/setup', guard(MKT), wrap(async (req, res) => {
  const cfg = await getCfg();
  const p = PROVIDERS[cfg.provider] || PROVIDERS.Brevo;
  res.json({
    provider: cfg.provider, hasKey: !!cfg.apiKey, keyHint: cfg.apiKey ? '••••' + String(cfg.apiKey).slice(-4) : '', from: cfg.from, domain: cfg.domain,
    providers: Object.entries(PROVIDERS).map(([n, v]) => ({ n, d: v.d })),
    dns: [
      { k: 'SPF', type: 'TXT', host: cfg.domain, val: `v=spf1 include:${p.spf} ~all`, ok: !!cfg.dns.spf },
      { k: 'DKIM', type: 'CNAME', host: `${p.dkim[0]}.${cfg.domain}`, val: p.dkim[1], ok: !!cfg.dns.dkim },
      { k: 'DMARC', type: 'TXT', host: `_dmarc.${cfg.domain}`, val: `v=DMARC1; p=none; rua=mailto:dmarc@${cfg.domain}`, ok: !!cfg.dns.dmarc }
    ]
  });
}));
staff.put('/setup', guard(ADMINS), wrap(async (req, res) => {
  const cfg = await getCfg();
  const { provider, apiKey, from } = req.body;
  if (provider) { if (!PROVIDERS[provider]) throw fail(400, 'Unknown provider'); cfg.provider = provider; cfg.dns = { spf: false, dkim: false, dmarc: false }; }
  if (apiKey) cfg.apiKey = String(apiKey).trim();
  if (from) cfg.from = String(from).slice(0, 200);
  await putCfg(cfg);
  res.json({ ok: true });
}));
/** Real DNS lookups for the three authentication records. */
staff.post('/setup/check-dns', guard(MKT), wrap(async (req, res) => {
  const cfg = await getCfg();
  const p = PROVIDERS[cfg.provider];
  const txt = async host => { try { return (await dns.resolveTxt(host)).map(r => r.join('')); } catch { return []; } };
  const cname = async host => { try { return await dns.resolveCname(host); } catch { return []; } };
  const spf = (await txt(cfg.domain)).some(t => t.startsWith('v=spf1') && t.includes(p.spf));
  const dkim = (await cname(`${p.dkim[0]}.${cfg.domain}`)).some(c => c.replace(/\.$/, '') === p.dkim[1]);
  const dmarc = (await txt(`_dmarc.${cfg.domain}`)).some(t => t.startsWith('v=DMARC1'));
  cfg.dns = { spf, dkim, dmarc };
  await putCfg(cfg);
  res.json({ spf, dkim, dmarc });
}));

// ---------- public preference centre (token from the confirmation email) ----------
async function byToken(token) {
  const [[c]] = await pool.query('SELECT * FROM consents WHERE token = ?', [token]);
  if (!c) throw fail(404, 'This preference link is not valid');
  const [[s]] = await pool.query('SELECT email FROM subscribers WHERE email = ?', [c.email]);
  const [[p]] = await pool.query('SELECT * FROM mkt_prefs WHERE email = ?', [c.email]);
  return { email: c.email, subscribed: !!s, prefs: prefsOf(p) };
}
pub.get('/:token', wrap(async (req, res) => { res.json(await byToken(req.params.token)); }));
pub.put('/:token', wrap(async (req, res) => {
  const cur = await byToken(req.params.token);
  if (!cur.subscribed) throw fail(400, 'You are unsubscribed — resubscribe first');
  const next = { ...cur.prefs };
  const changed = [];
  for (const k of PREF_KEYS) if (k in req.body && !!req.body[k] !== cur.prefs[k]) { next[k] = !!req.body[k]; changed.push(`${next[k] ? 'Turned on' : 'Turned off'} ${k}`); }
  await pool.query('INSERT INTO mkt_prefs (email,offers,festivals,tips,refill) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE offers=VALUES(offers), festivals=VALUES(festivals), tips=VALUES(tips), refill=VALUES(refill)', [cur.email, +next.offers, +next.festivals, +next.tips, +next.refill]);
  for (const w of changed) await logPref(cur.email, w);
  res.json({ ok: true, prefs: next });
}));
pub.post('/:token/unsubscribe', wrap(async (req, res) => {
  const cur = await byToken(req.params.token);
  await pool.query('DELETE FROM subscribers WHERE email = ?', [cur.email]);
  await pool.query('UPDATE consents SET status = "Unsubscribed" WHERE email = ? AND status <> "Unsubscribed"', [cur.email]);
  await pool.query('UPDATE mkt_outbox SET status = "Skipped" WHERE email = ? AND status = "Queued"', [cur.email]);
  await logPref(cur.email, 'Unsubscribed from all — effective immediately');
  res.json({ ok: true });
}));
pub.post('/:token/resubscribe', wrap(async (req, res) => {
  const cur = await byToken(req.params.token);
  await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [cur.email]);
  await pool.query('UPDATE consents SET status = "Confirmed" WHERE token = ?', [req.params.token]);
  await logPref(cur.email, 'Resubscribed');
  res.json({ ok: true });
}));

export { staff as mktRouter, pub as prefsRouter };
