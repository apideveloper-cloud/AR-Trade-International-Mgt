// Public preference centre (token from the confirmation email).
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { PREF_KEYS, prefsOf } from './helpers.js';
import { logPref, unsubscribeEverywhere } from './store.js';

async function byToken(token) {
  const [[c]] = await pool.query('SELECT * FROM consents WHERE token = ?', [token]);
  if (!c) throw fail(404, 'This preference link is not valid');
  const [[s]] = await pool.query('SELECT email FROM subscribers WHERE email = ?', [c.email]);
  const [[p]] = await pool.query('SELECT * FROM mkt_prefs WHERE email = ?', [c.email]);
  return { email: c.email, subscribed: !!s, prefs: prefsOf(p) };
}

/** Works out the new preferences and the log lines from a request body (pure). */
export function applyPrefChanges(current, body) {
  const next = { ...current };
  const changed = [];
  for (const k of PREF_KEYS) if (k in body && !!body[k] !== current[k]) { next[k] = !!body[k]; changed.push(`${next[k] ? 'Turned on' : 'Turned off'} ${k}`); }
  return { next, changed };
}

/** Adds the public preference routes to the prefs router. */
export function registerPrefsRoutes(pub) {
  pub.get('/:token', wrap(async (req, res) => { res.json(await byToken(req.params.token)); }));
  pub.put('/:token', wrap(async (req, res) => {
    const cur = await byToken(req.params.token);
    if (!cur.subscribed) throw fail(400, 'You are unsubscribed — resubscribe first');
    const { next, changed } = applyPrefChanges(cur.prefs, req.body);
    await pool.query('INSERT INTO mkt_prefs (email,offers,festivals,tips,refill) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE offers=VALUES(offers), festivals=VALUES(festivals), tips=VALUES(tips), refill=VALUES(refill)', [cur.email, +next.offers, +next.festivals, +next.tips, +next.refill]);
    for (const w of changed) await logPref(cur.email, w);
    res.json({ ok: true, prefs: next });
  }));
  pub.post('/:token/unsubscribe', wrap(async (req, res) => {
    const cur = await byToken(req.params.token);
    await unsubscribeEverywhere(cur.email);
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
}
