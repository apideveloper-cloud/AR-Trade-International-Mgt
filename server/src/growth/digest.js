// Weekly growth digest: a short plain-English e-mail built from the Search & Growth overview. Sent only when the owner turned it on.
// Settings live in the growth row key `growthDigest` { enabled:false, to:'' }; the shop e-mail (site.email) is the fallback address.
// sendGrowthDigest never throws: it answers { sent:true, to } or { skipped:true, reason }.
import { esc } from '../util.js';
import { searchFacts, SEVERITY_ORDER } from './overview.js';
import { isEmail } from './business.js';

const n0 = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const num = v => n0(v).toLocaleString('en-US');
const pickNum = (...vals) => { for (const v of vals) if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))) return Number(v); return null; };
/** Impressions now and before, whatever the Search Console summary calls them. */
export function impressionFacts(s) {
  const x = s && typeof s === 'object' ? s : {};
  return {
    impressions: pickNum(x.impressions, x.cur?.impressions, x.last28?.impressions, x.current?.impressions, x.totals?.impressions, x.period?.impressions),
    prevImpressions: pickNum(x.prevImpressions, x.previousImpressions, x.prev28?.impressions, x.previous?.impressions, x.prev?.impressions, x.totalsPrev?.impressions)
  };
}
const change = (now, prev) => (now === null ? '' : prev === null ? `${num(now)}` : `${num(now)} (before: ${num(prev)}${prev > 0 ? `, ${now >= prev ? '+' : ''}${Math.round(((now - prev) / prev) * 100)}%` : ''})`);

/** { subject, text, html, empty } from an overview payload (pure). empty = nothing worth e-mailing. */
export function digestFromOverview(ov, origin = '') {
  const health = ov?.health || {}, actions = [...(ov?.actions || [])].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || n0(b.count) - n0(a.count)).slice(0, 8);
  const s = searchFacts(ov?.search), im = impressionFacts(ov?.search);
  const counts = [
    ['Reviews waiting for approval', n0(health.reviews?.pending)], ['Pages with structured data errors', n0(health.schema?.pagesWithErrors ?? health.schema?.counts?.error)],
    ['Price and stock issues', n0(health.price?.total)], ['Review requests waiting for you to send on WhatsApp', n0(health.reviews?.whatsappWaiting)]
  ];
  const link = (origin || '') + '/admin/growth';
  const empty = actions.length === 0 && !s.connected && counts.every(c => c[1] === 0);
  const t = [`Your weekly search and growth summary.`, ''], h = [];
  if (s.connected && s.clicks !== null) {
    t.push('Search in the last 28 days', `- Clicks: ${change(s.clicks, s.prevClicks)}`);
    h.push(`<h3 style="margin:14px 0 4px">Search in the last 28 days</h3><ul style="margin:0;padding-left:18px"><li>Clicks: ${esc(change(s.clicks, s.prevClicks))}</li>`);
    if (im.impressions !== null) { t.push(`- Impressions: ${change(im.impressions, im.prevImpressions)}`); h.push(`<li>Impressions: ${esc(change(im.impressions, im.prevImpressions))}</li>`); }
    h.push('</ul>'); t.push('');
  }
  t.push('Counts'); h.push('<h3 style="margin:14px 0 4px">Counts</h3><ul style="margin:0;padding-left:18px">');
  for (const [l, n] of counts) { t.push(`- ${l}: ${n}`); h.push(`<li>${esc(l)}: <b>${n}</b></li>`); }
  h.push('</ul>'); t.push('');
  if (actions.length) {
    t.push('What to do first'); h.push('<h3 style="margin:14px 0 4px">What to do first</h3><ol style="margin:0;padding-left:18px">');
    for (const a of actions) { t.push(`- [${a.severity}] ${a.title}`); h.push(`<li>${esc(a.title)} <span style="color:#667">(${esc(a.severity)})</span></li>`); }
    h.push('</ol>');
  } else { t.push('Nothing needs your attention this week.'); h.push('<p>Nothing needs your attention this week.</p>'); }
  t.push('', `Open the console: ${link}`); h.push(`<p><a href="${esc(link)}">Open the Search &amp; Growth console</a></p>`);
  const subject = actions.length ? `AR Trade growth digest: ${actions.length} thing${actions.length === 1 ? '' : 's'} to look at` : 'AR Trade growth digest: all clear';
  return { subject, text: t.join('\n'), html: `<div style="font-family:Arial,sans-serif;color:#0b1631">${h.join('')}</div>`, empty };
}

async function defaultDeps() {
  const [ov, sf, mailer, site, { pool }, { parseJson }] = await Promise.all([import('./overview.js'), import('./siteFiles.js'), import('../mailer.js'), import('./site.js'), import('../db.js'), import('../util.js')]);
  return {
    loadOverview: () => ov.loadOverview(), readGrowth: sf.readGrowth, mailReady: () => mailer.mailReady(), sendMail: mailer.sendMail, origin: site.siteOrigin,
    async shopEmail() { try { const [r] = await pool.query('SELECT v FROM settings WHERE k = ?', ['site']); return String((r.length ? parseJson(r[0].v) : null)?.email || '').trim(); } catch { return ''; } }
  };
}
/** Builds the digest. deps.loadOverview / deps.origin are injectable. */
export async function buildGrowthDigest(deps) {
  const d = { ...(await defaultDeps()), ...(deps || {}) };
  const ov = await d.loadOverview();
  return digestFromOverview(ov, await Promise.resolve(d.origin?.()).catch(() => '') || '');
}
/** Sends it. force (the admin "send test") ignores the on/off switch; to overrides the saved address. Never throws. */
export async function sendGrowthDigest({ force = false, to: toOverride, deps } = {}) {
  try {
    const d = { ...(await defaultDeps()), ...(deps || {}) };
    const cfg = (await d.readGrowth())?.growthDigest || {};
    if (!force && cfg.enabled !== true) return { skipped: true, reason: 'digest is turned off' };
    if (!d.mailReady()) return { skipped: true, reason: 'mail is not set up' };
    const to = String(toOverride || cfg.to || '').trim() || String(await d.shopEmail() || '').trim();
    if (!isEmail(to)) return { skipped: true, reason: 'no valid e-mail address' };
    const dg = await buildGrowthDigest(d);
    if (dg.empty) return { skipped: true, reason: 'nothing to say' };
    try { if ((await d.sendMail({ to, subject: dg.subject, text: dg.text, html: dg.html })) === false) return { skipped: true, reason: 'mail is not set up' }; }
    catch (e) { return { skipped: true, reason: 'mail failed', error: String(e?.message || e).slice(0, 200) }; }
    return { sent: true, to, subject: dg.subject };
  } catch (e) { return { skipped: true, reason: 'digest failed: ' + String(e?.message || e).slice(0, 200) }; }
}
