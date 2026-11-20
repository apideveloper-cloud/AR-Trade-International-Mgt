// Staff routes: audience list and the sending / DNS setup.
import dns from 'node:dns/promises';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { fail, wrap } from '../util.js';
import { PROVIDERS, dnsRecords, dnsVerdict, prefsOf } from './helpers.js';
import { getCfg, logPref, putCfg, unsubscribeEverywhere } from './store.js';

/** Adds the audience and setup routes to the staff router. */
export function registerAudienceRoutes(staff) {
  staff.get('/audience', guard('marketing.manage'), wrap(async (req, res) => {
    const [[rows], [log]] = await Promise.all([pool.query('SELECT s.email, s.created_at, p.offers, p.festivals, p.tips, p.refill, (SELECT token FROM consents c WHERE c.email = s.email AND c.status <> "Unsubscribed" ORDER BY c.id DESC LIMIT 1) token FROM subscribers s LEFT JOIN mkt_prefs p ON p.email = s.email ORDER BY s.created_at DESC'), pool.query('SELECT * FROM mkt_log ORDER BY id DESC LIMIT 40')]);
    res.json({ subscribers: rows.map(r => ({ email: r.email, since: r.created_at, token: r.token, prefs: prefsOf(r) })), log: log.map(l => ({ email: l.email, what: l.what, at: l.at })) });
  }));
  staff.delete('/audience/:email', guard('marketing.manage'), wrap(async (req, res) => {
    await unsubscribeEverywhere(req.params.email);
    await logPref(req.params.email, 'Unsubscribed by staff on request');
    res.json({ ok: true });
  }));

  staff.get('/setup', guard('marketing.manage'), wrap(async (req, res) => {
    const cfg = await getCfg();
    const p = PROVIDERS[cfg.provider] || PROVIDERS.Brevo;
    res.json({
      provider: cfg.provider, hasKey: !!cfg.apiKey, keyHint: cfg.apiKey ? '••••' + String(cfg.apiKey).slice(-4) : '', from: cfg.from, domain: cfg.domain,
      providers: Object.entries(PROVIDERS).map(([n, v]) => ({ n, d: v.d })),
      dns: dnsRecords(p, cfg)
    });
  }));
  staff.put('/setup', guard('marketing.setup'), wrap(async (req, res) => {
    const cfg = await getCfg();
    const { provider, apiKey, from } = req.body;
    if (provider) { if (!PROVIDERS[provider]) throw fail(400, 'Unknown provider'); cfg.provider = provider; cfg.dns = { spf: false, dkim: false, dmarc: false }; }
    if (apiKey) cfg.apiKey = String(apiKey).trim();
    if (from) cfg.from = String(from).slice(0, 200);
    await putCfg(cfg);
    res.json({ ok: true });
  }));
  /** Real DNS lookups for the three authentication records. */
  staff.post('/setup/check-dns', guard('marketing.manage'), wrap(async (req, res) => {
    const cfg = await getCfg();
    const p = PROVIDERS[cfg.provider] || PROVIDERS.Brevo; // same fallback as GET /setup: an unset provider must not crash the check
    const txt = async host => { try { return (await dns.resolveTxt(host)).map(r => r.join('')); } catch { return []; } };
    const cname = async host => { try { return await dns.resolveCname(host); } catch { return []; } };
    const found = { spfTxt: await txt(cfg.domain), dkimCnames: await cname(`${p.dkim[0]}.${cfg.domain}`), dmarcTxt: await txt(`_dmarc.${cfg.domain}`) };
    const { spf, dkim, dmarc } = dnsVerdict(p, cfg.domain, found);
    cfg.dns = { spf, dkim, dmarc };
    await putCfg(cfg);
    res.json({ spf, dkim, dmarc });
  }));
}
