// Real sending: campaigns and automation steps go out through the SMTP account in .env.
import { pool } from '../db.js';
import { parseJson } from '../util.js';
import { mailReady, sendMail, siteUrl } from '../mailer.js';
import { renderEmail } from '../emailTemplate.js';
import { WELCOME_DAYS, pickSubject } from './helpers.js';
import { audience, consentToken, productsByIds } from './store.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** One marketing email with the unsubscribe / preferences link every message must carry. Returns false when the person has no confirmed consent. */
async function sendMarketing(email, subject, content) {
  const token = await consentToken(email);
  if (!token) return false; // no confirmed opt-in on record: never mail them
  const { html, text } = renderEmail({ ...content, subject, prefsUrl: siteUrl() + '/prefs/' + token, siteUrl: siteUrl() });
  await sendMail({ to: email, subject, text, html });
  return true;
}

/** Sends every scheduled campaign whose time has come (each is claimed first, so it can never go out twice). */
async function sendDueCampaigns() {
  const [due] = await pool.query('SELECT * FROM mkt_campaigns WHERE status = "Scheduled" AND send_at <= NOW() ORDER BY send_at');
  for (const c of due) {
    const [claim] = await pool.query('UPDATE mkt_campaigns SET status = "Sent" WHERE id = ? AND status = "Scheduled"', [c.id]);
    if (!claim.affectedRows) continue;
    const [[t]] = c.template_id ? await pool.query('SELECT * FROM mkt_templates WHERE id = ?', [c.template_id]) : [[null]];
    const d = parseJson(c.design) || {};
    const content = { preheader: t?.preheader, kicker: d.kicker, headline: d.headline || t?.headline || c.subj_a, body: c.body || t?.body || '', hero: d.hero, cta: d.cta || t?.cta, ctaUrl: d.ctaUrl || siteUrl() + '/shop/all', products: await productsByIds(d.products) };
    let sent = 0, i = 0;
    for (const r of await audience(c.audience)) {
      const subject = pickSubject(c, i); // A/B: every second recipient gets subject B
      if (c.subj_b) i++;
      try { if (await sendMarketing(r.email, subject, content)) sent++; } catch (e) { console.error('campaign mail failed:', e.message); }
      await sleep(150);
    }
    await pool.query('UPDATE mkt_campaigns SET sent = ? WHERE id = ?', [sent, c.id]);
  }
}

/** Sends up to 50 queued automation (welcome series) emails that are due. */
async function sendDueAutomationSteps() {
  const [due] = await pool.query('SELECT * FROM mkt_outbox WHERE status = "Queued" AND send_at <= NOW() ORDER BY send_at LIMIT 50');
  for (const m of due) {
    const [[sub]] = await pool.query('SELECT email FROM subscribers WHERE email = ?', [m.email]);
    let ok = false;
    if (sub) {
      try {
        ok = await sendMarketing(m.email, m.subject, { headline: m.subject, body: 'Thanks for joining AR Trade International.\nUse code WELCOME10 for 10% off your first order.', cta: 'Start shopping', ctaUrl: siteUrl() + '/shop/all' });
      } catch (e) { console.error('automation mail failed:', e.message); continue; } // leave it queued and try again next minute
    }
    await pool.query('UPDATE mkt_outbox SET status = ? WHERE id = ?', [ok ? 'Sent' : 'Skipped', m.id]);
    if (ok) await pool.query('UPDATE mkt_automations SET sent = sent + 1 WHERE id = ?', [m.automation_id]);
    await sleep(150);
  }
}

let working = false;
/** One pass of the mail worker (also called straight away when staff press "Send now"). */
export const tick = async () => {
  if (working) return;
  working = true;
  try { await sendDueCampaigns(); await sendDueAutomationSteps(); } catch (e) { console.error('mail worker:', e.message); } finally { working = false; }
};

let intervalTimer = null, firstTimer = null;
/** Checks every minute for scheduled campaigns and queued automation steps. Without SMTP + SITE_URL nothing is sent and they simply wait. */
export function startMailWorker() {
  if (!mailReady() || !siteUrl()) { console.log('Marketing email is off: set SMTP_HOST and SITE_URL in server/.env. Campaigns and automations wait until then.'); return; }
  stopMailWorker();
  intervalTimer = setInterval(tick, 60000); intervalTimer.unref();
  firstTimer = setTimeout(tick, 15000); firstTimer.unref();
}

/** Clears the worker's timers (for a clean shutdown). */
export function stopMailWorker() {
  clearInterval(intervalTimer); clearTimeout(firstTimer);
  intervalTimer = firstTimer = null;
}

/** Called when somebody confirms their subscription: queue the welcome series if it is switched on. */
export async function onSubscribed(email) {
  const [[a]] = await pool.query('SELECT * FROM mkt_automations WHERE id = "welcome" AND active = 1');
  if (!a) return;
  const [[ex]] = await pool.query('SELECT COUNT(*) n FROM mkt_outbox WHERE email = ? AND automation_id = "welcome"', [email]);
  if (ex.n) return;
  for (const [label, subject] of parseJson(a.steps)) {
    await pool.query('INSERT INTO mkt_outbox (email,automation_id,step_label,subject,send_at) VALUES (?,?,?,?,DATE_ADD(NOW(), INTERVAL ? DAY))', [email, 'welcome', label, subject, WELCOME_DAYS[label] ?? 0]);
  }
}
