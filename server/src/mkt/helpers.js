// Pure helpers for email marketing (no database, no network): shapes, cleaning and DNS-record checks.
import { parseJson } from '../util.js';
import { HEROES } from '../emailTemplate.js';

export const PREF_KEYS = ['offers', 'festivals', 'tips', 'refill'];
export const TAGS = { 't-eid': 'Eid', 't-puja': 'Puja', 't-boishakh': 'Boishakh' };
/** Days after confirming when each welcome-series step goes out. */
export const WELCOME_DAYS = { 'Day 0': 0, 'Day 2': 2, 'Day 7': 7 };
export const PROVIDERS = {
  Mailchimp: { d: 'Easy campaigns', spf: 'servers.mcsv.net', dkim: ['k2._domainkey', 'dkim2.mcsv.net'] },
  Brevo: { d: 'Email + SMS', spf: 'spf.brevo.com', dkim: ['brevo1._domainkey', 'b1.artradeinternational.com.dkim.brevo.com'] },
  'Amazon SES': { d: 'Lowest cost at scale', spf: 'amazonses.com', dkim: ['selector._domainkey', 'selector.dkim.amazonses.com'] }
};

/** A person's email preferences; anything not set yet counts as allowed. */
export const prefsOf = row => ({ offers: !!(row?.offers ?? 1), festivals: !!(row?.festivals ?? 1), tips: !!(row?.tips ?? 1), refill: !!(row?.refill ?? 1) });

/** A campaign row in the shape the console shows. */
export const campOut = c => ({
  id: c.id, code: 'CMP-' + (200 + c.id), name: c.name, tag: c.tag, template: c.template_id, subjA: c.subj_a, subjB: c.subj_b, audience: c.audience, status: c.status, at: c.send_at,
  design: parseJson(c.design) || null, sent: c.sent, opens: c.opens, clicks: c.clicks, unsubs: c.unsubs, revenue: c.revenue, ab: c.ab_a != null && c.ab_b != null ? [c.ab_a, c.ab_b] : null
});

/** Cleans what the campaign form sends before it is stored or rendered. */
export const cleanDesign = d => {
  const t = (v, n) => String(v ?? '').trim().slice(0, n);
  return {
    kicker: t(d?.kicker, 80), headline: t(d?.headline, 120), hero: HEROES[d?.hero] ? d.hero : 'navy', cta: t(d?.cta, 40), ctaUrl: /^https?:\/\//i.test(d?.ctaUrl || '') ? t(d.ctaUrl, 400) : '',
    products: (Array.isArray(d?.products) ? d.products : []).map(Number).filter(Number.isInteger).slice(0, 8)
  };
};

/** The product ids a campaign may show: whole numbers only, at most 8, order kept. */
export const cleanProductIds = ids => (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 8);

/** A/B test: every second recipient gets subject B (when there is one). `i` counts only the recipients since B exists. */
export const pickSubject = (c, i) => (c.subj_b && i % 2 ? c.subj_b : c.subj_a);

/** Subscribers who allow this kind of email ('all' keeps everyone; a missing preference counts as allowed). */
export const filterAudience = (subs, kind) => subs.filter(r => kind === 'all' || (r[kind] ?? 1));

/** Which of the three DNS records pass, given the looked-up values. */
export function dnsVerdict(p, domain, { spfTxt, dkimCnames, dmarcTxt }) {
  return {
    spf: spfTxt.some(t => t.startsWith('v=spf1') && t.includes(p.spf)),
    dkim: dkimCnames.some(c => c.replace(/\.$/, '') === p.dkim[1]),
    dmarc: dmarcTxt.some(t => t.startsWith('v=DMARC1'))
  };
}

/** The three records the owner must add at their DNS host, with their current pass / fail state. */
export const dnsRecords = (p, cfg) => [
  { k: 'SPF', type: 'TXT', host: cfg.domain, val: `v=spf1 include:${p.spf} ~all`, ok: !!cfg.dns.spf },
  { k: 'DKIM', type: 'CNAME', host: `${p.dkim[0]}.${cfg.domain}`, val: p.dkim[1], ok: !!cfg.dns.dkim },
  { k: 'DMARC', type: 'TXT', host: `_dmarc.${cfg.domain}`, val: `v=DMARC1; p=none; rua=mailto:dmarc@${cfg.domain}`, ok: !!cfg.dns.dmarc }
];
