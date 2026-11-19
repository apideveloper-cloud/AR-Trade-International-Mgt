// Small database helpers shared by the marketing modules.
import { pool } from '../db.js';
import { parseJson } from '../util.js';
import { cleanProductIds, filterAudience } from './helpers.js';

export const getCfg = async () => { const [[r]] = await pool.query('SELECT v FROM settings WHERE k = "mkt"'); return parseJson(r.v); };
export const putCfg = cfg => pool.query('UPDATE settings SET v = ? WHERE k = "mkt"', [JSON.stringify(cfg)]);
/** Writes one line to the preference / unsubscribe log. */
export const logPref = (email, what) => pool.query('INSERT INTO mkt_log (email,what) VALUES (?,?)', [email, what]);

/** Confirmed subscribers who allow this kind of email. */
export async function audience(kind) {
  const [subs] = await pool.query('SELECT s.email, p.offers, p.festivals, p.tips, p.refill FROM subscribers s LEFT JOIN mkt_prefs p ON p.email = s.email');
  return filterAudience(subs, kind);
}

export const consentToken = async email => (await pool.query('SELECT token FROM consents WHERE email = ? AND status = "Confirmed" ORDER BY id DESC LIMIT 1', [email]))[0][0]?.token;

/** Products picked for a campaign, in the order chosen, with the fields the email card needs. */
export async function productsByIds(ids) {
  const list = cleanProductIds(ids);
  if (!list.length) return [];
  const [rows] = await pool.query('SELECT id, brand, name, slug, old_price, price, img FROM products WHERE active = 1 AND id IN (?)', [list]);
  return list.map(id => rows.find(r => r.id === id)).filter(Boolean).map(r => ({ id: r.id, name: r.name, slug: r.slug, price: r.price, old: r.old_price, img: r.img }));
}

/** Unsubscribes a person everywhere: subscriber row, consent and any queued automation mail. */
export async function unsubscribeEverywhere(email) {
  await pool.query('DELETE FROM subscribers WHERE email = ?', [email]);
  await pool.query('UPDATE consents SET status = "Unsubscribed" WHERE email = ? AND status <> "Unsubscribed"', [email]);
  await pool.query('UPDATE mkt_outbox SET status = "Skipped" WHERE email = ? AND status = "Queued"', [email]);
}
