// Encrypted credential vault for the Search & Growth console (Google client secret / refresh token, Bing API key, ...).
// AES-256-GCM, master key from SECRETS_KEY (any string: it is hashed to 32 bytes). Without SECRETS_KEY the JWT_SECRET is used
// instead and fallbackKey() is true so the admin can see a warning. Secrets live in their own table (never in `settings`,
// which the admin API returns whole) and are never sent to the browser: only { set, last4, updatedAt } is exposed.
import crypto from 'node:crypto';
import { pool } from '../db.js';

let keyCache = null;
export function masterKey() {
  if (keyCache) return keyCache;
  const raw = process.env.SECRETS_KEY || process.env.JWT_SECRET || 'dev-only-key';
  keyCache = crypto.createHash('sha256').update('growth-vault:' + raw).digest();
  return keyCache;
}
export const resetKeyCache = () => { keyCache = null; };
export const fallbackKey = () => !process.env.SECRETS_KEY;

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', masterKey(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return 'v1.' + [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}
export function decrypt(blob) {
  const [v, iv, tag, enc] = String(blob || '').split('.');
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('Unreadable secret');
  const d = crypto.createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

export async function ensureVault() {
  await pool.query(`CREATE TABLE IF NOT EXISTS growth_secrets (
    k VARCHAR(60) NOT NULL PRIMARY KEY, v_enc TEXT NOT NULL, last4 VARCHAR(4) NOT NULL DEFAULT '',
    updated_by VARCHAR(80) NOT NULL DEFAULT '', updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
}
export async function setSecret(k, value, by = '') {
  const v = String(value ?? '').trim();
  if (!v) throw new Error('Empty secret');
  await pool.query('INSERT INTO growth_secrets (k, v_enc, last4, updated_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE v_enc = VALUES(v_enc), last4 = VALUES(last4), updated_by = VALUES(updated_by)', [k, encrypt(v), v.slice(-4), String(by).slice(0, 80)]);
}
export async function getSecret(k) {
  const [r] = await pool.query('SELECT v_enc FROM growth_secrets WHERE k = ?', [k]);
  if (!r.length) return '';
  try { return decrypt(r[0].v_enc); } catch { return ''; } // wrong key or damaged: behaves as "not set"
}
export async function deleteSecret(k) { await pool.query('DELETE FROM growth_secrets WHERE k = ?', [k]); }
/** { key: { set, last4, updatedAt } } for the given keys: the only view of a secret the browser ever gets. */
export async function secretStatus(keys) {
  const [r] = await pool.query('SELECT k, last4, updated_at FROM growth_secrets WHERE k IN (?)', [keys.length ? keys : ['']]);
  const out = {};
  for (const k of keys) { const x = r.find(y => y.k === k); out[k] = { set: !!x, last4: x ? x.last4 : '', updatedAt: x ? x.updated_at : null }; }
  return out;
}
