import { getAdminToken } from '../../adminApi.js';
export { send } from './pricesApi.js';
export { mcMsg, sendDelete, trMsg } from './mcApi.js';

/** PUT that keeps the error body: returns { status, ok, body }. Never throws. */
export async function sendPut(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getAdminToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  try {
    const res = await fetch('/api/admin' + url, { method: 'PUT', headers, body: JSON.stringify(body || {}) });
    return { status: res.status, ok: res.ok, body: await res.json().catch(() => ({})) };
  } catch {
    return { status: 0, ok: false, body: { error: "Can't reach the server. Check your internet connection and try again." } };
  }
}

// The labels are English keys: translate them with tr() where they are shown.
export const KINDS = [['citation', 'Business listing'], ['backlink', 'Link from another site'], ['social', 'Social profile'], ['press', 'Press mention'], ['supplier', 'Supplier']];
export const KIND_TEXT = Object.fromEntries(KINDS);
export const STATUSES = [['planned', 'Planned', '○'], ['submitted', 'Submitted', '➤'], ['live', 'Live', '✔'], ['lost', 'Lost', '⚠'], ['rejected', 'Rejected', '✖']];
export const STATUS_TEXT = Object.fromEntries(STATUSES.map(s => [s[0], s[1]]));
export const STATUS_ICON = Object.fromEntries(STATUSES.map(s => [s[0], s[2]]));
