// Merchant Center sync: pushes the feed items to the Merchant API when they are new or changed, removes the ones that left the feed,
// and pulls the item issues back. merchant_sync_state remembers, per product, the hash of what Google last received. All outside
// dependencies are injectable (deps) so tests never touch the database, the feed or Google.
import { pool } from '../db.js';
import { getIntegration, setIntegration } from './http.js';
import { readMerchant } from './merchant.js';
import { feedItemToProductInput, itemHash } from './merchantMap.js';
import * as api from './merchantApi.js';

export const MAX_PER_RUN = 200;
let ready = false;
export async function ensureMerchantSync() {
  if (ready) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS merchant_sync_state (
    product_id INT NOT NULL PRIMARY KEY, offer_id VARCHAR(80) NOT NULL DEFAULT '', hash CHAR(40) NOT NULL DEFAULT '', status VARCHAR(12) NOT NULL DEFAULT 'Synced',
    issues JSON NULL, error VARCHAR(300) NOT NULL DEFAULT '', synced_at DATETIME NULL, KEY idx_mss_offer (offer_id), KEY idx_mss_status (status))`);
  ready = true;
}

const defaults = {
  settings: readMerchant,
  async query(sql, p) { await ensureMerchantSync(); const [r] = await pool.query(sql, p); return r; },
  async loadItems() {
    const { siteOrigin } = await import('./site.js');
    const base = await siteOrigin();
    if (!base) return null;
    const seo = await import('../seo.js');
    if (typeof seo.loadFeedItems !== 'function') throw new Error('The product feed is not available yet');
    return seo.loadFeedItems(base);
  },
  async googleState() {
    const g = await import('./google.js');
    const i = await getIntegration('google');
    return { connected: i.status === 'connected', merchantScope: (await g.grantedScopes()).includes(g.MERCHANT_SCOPE) };
  },
  setIntegration, api
};

const msg = r => String(r.error || 'HTTP ' + r.status).slice(0, 300);
const quota = () => Object.assign(new Error('Merchant API quota reached, will retry later'), { quota: true });
const stamp = now => new Date(now ?? Date.now());

/** Plain diff of feed items against the stored states: { toSend, remove, unchanged }. */
export function diffItems(items, states, full = false) {
  const byPid = new Map(states.map(s => [Number(s.product_id), s]));
  const seen = new Set(), toSend = [], remove = [];
  let unchanged = 0;
  for (const it of items) {
    const pid = Number(it.pid);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    seen.add(pid);
    const s = byPid.get(pid), hash = itemHash(it);
    if (!s || full || s.status !== 'Synced' || s.hash !== hash) toSend.push({ pid, item: it, hash, oldOffer: s && s.status === 'Synced' && s.offer_id && s.offer_id !== String(it.id) ? s.offer_id : '' });
    else unchanged++;
  }
  for (const s of states) if (s.status === 'Synced' && !seen.has(Number(s.product_id))) remove.push({ pid: Number(s.product_id), offerId: s.offer_id });
  return { toSend, remove, unchanged };
}

export async function runMerchantSync({ full = false, now, deps = {} } = {}) {
  const d = { ...defaults, ...deps };
  const s = await d.settings();
  if (!s.syncEnabled) return { skipped: true, reason: 'sync is off' };
  if (!s.accountId || !s.dataSourceId) return { skipped: true, reason: 'Merchant Center ID or data source is missing' };
  const g = await d.googleState();
  if (!g.connected) return { skipped: true, reason: 'Google is not connected' };
  if (!g.merchantScope) return { skipped: true, reason: 'Google was connected without Merchant Center access. Connect Google again.' };
  const items = await d.loadItems();
  if (!items) return { skipped: true, reason: 'no preferred domain' };
  if (full) await d.query("UPDATE merchant_sync_state SET hash = ''", []);
  const states = await d.query('SELECT product_id, offer_id, hash, status FROM merchant_sync_state', []);
  const { toSend, remove, unchanged } = diffItems(items, states, full);
  const out = { total: items.length, synced: 0, errors: 0, deleted: 0, unchanged, pending: 0 };
  const save = (pid, offer, hash, status, error) => d.query(
    'INSERT INTO merchant_sync_state (product_id, offer_id, hash, status, error, synced_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE offer_id = VALUES(offer_id), hash = VALUES(hash), status = VALUES(status), error = VALUES(error), synced_at = VALUES(synced_at)',
    [pid, String(offer).slice(0, 80), hash, status, String(error || '').slice(0, 300), stamp(now)]);
  const stopAuth = async r => { await d.setIntegration('merchant', { status: 'error', last_error: 'Reconnect Google' }); out.stopped = 'Reconnect Google'; return out; };
  let budget = MAX_PER_RUN;
  const name = o => api.productInputName(s.accountId, s.contentLanguage, s.feedLabel, o);

  for (const r of remove) {
    if (budget <= 0) { out.pending++; continue; }
    budget--;
    const x = await d.api.deleteProductInput(s.accountId, s.dataSourceId, name(r.offerId));
    if (x.ok || x.status === 404) { await save(r.pid, r.offerId, '', 'Deleted', ''); out.deleted++; continue; }
    if (x.status === 401 || x.status === 403) return stopAuth(x);
    if (x.status === 429) throw quota();
    await save(r.pid, r.offerId, '', 'Error', msg(x)); out.errors++;
  }
  for (const t of toSend) {
    if (budget <= 0) { out.pending++; continue; }
    budget--;
    if (t.oldOffer) await d.api.deleteProductInput(s.accountId, s.dataSourceId, name(t.oldOffer)); // the SKU changed: drop the old offer id (best effort)
    const x = await d.api.insertProductInput(s.accountId, s.dataSourceId, feedItemToProductInput(t.item, s));
    if (x.ok) { await save(t.pid, t.item.id, t.hash, 'Synced', ''); out.synced++; continue; }
    if (x.status === 401 || x.status === 403) return stopAuth(x);
    if (x.status === 429) throw quota();
    await save(t.pid, t.item.id, '', 'Error', msg(x)); out.errors++;
  }
  await d.setIntegration('merchant', { status: out.errors ? 'error' : 'connected', last_sync: new Date(), last_error: out.errors ? `${out.errors} product(s) were refused` : '', account: s.accountId });
  return out;
}

const MAX_PAGES = 10;
/** Pulls the product statuses (item issues) from Merchant Center into merchant_sync_state.issues. */
export async function refreshMerchantStatus({ deps = {} } = {}) {
  const d = { ...defaults, ...deps };
  const s = await d.settings();
  if (!s.syncEnabled) return { skipped: true, reason: 'sync is off' };
  if (!s.accountId) return { skipped: true, reason: 'Merchant Center ID is missing' };
  const g = await d.googleState();
  if (!g.connected || !g.merchantScope) return { skipped: true, reason: 'Google is not connected for Merchant Center' };
  const out = { pages: 0, products: 0, withIssues: 0 };
  let token = '';
  do {
    const r = await d.api.listProducts(s.accountId, token);
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) { await d.setIntegration('merchant', { status: 'error', last_error: 'Reconnect Google' }); return { ...out, stopped: 'Reconnect Google' }; }
      if (r.status === 429) throw quota();
      throw new Error(msg(r));
    }
    out.pages++;
    for (const p of r.data?.products || []) {
      out.products++;
      const issues = (p.productStatus?.itemLevelIssues || []).slice(0, 10).map(i => ({ code: i.code, severity: i.severity, attribute: i.attribute, description: String(i.description || '').slice(0, 200) }));
      const dest = (p.productStatus?.destinationStatuses || []).map(x => ({ context: x.reportingContext, approved: x.approvedCountries || [], pending: x.pendingCountries || [], disapproved: x.disapprovedCountries || [] }));
      if (issues.length) out.withIssues++;
      if (p.offerId) await d.query('UPDATE merchant_sync_state SET issues = ? WHERE offer_id = ?', [JSON.stringify({ issues, destinations: dest }), String(p.offerId).slice(0, 80)]);
    }
    token = r.data?.nextPageToken || '';
  } while (token && out.pages < MAX_PAGES);
  return out;
}
