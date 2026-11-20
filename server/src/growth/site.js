// Where the public site lives, read from the SEO settings (preferred domain) or SITE_URL. Shared by the Google, Bing and sitemap code.
import { pool } from '../db.js';
import { parseJson } from '../util.js';
import { mergeSeoSettings } from '../seoSettings.js';
import { hostOf } from '../seoAutomation.js';

export async function readSeo() {
  try { const [r] = await pool.query('SELECT v FROM settings WHERE k = ?', ['seo']); return mergeSeoSettings(r.length ? parseJson(r[0].v) : null); } catch { return mergeSeoSettings(null); }
}
const envBase = () => { const u = String(process.env.SITE_URL || '').replace(/\/+$/, ''); return /^https:\/\/[^/]+$/i.test(u) ? u : ''; };
/** 'https://host' of the public site: the preferred domain first, then SITE_URL; '' when neither is a https origin. */
export async function siteOrigin() { const h = hostOf(await readSeo()); return h ? 'https://' + h : envBase(); }
/** The address Google sends the browser back to after sign-in. SITE_URL wins (that is the real public address), then the preferred domain. */
export async function redirectUri() { const b = envBase() || (await siteOrigin()); return b ? b + '/api/admin/growth/google/callback' : ''; }
