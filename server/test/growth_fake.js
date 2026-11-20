// Test helper (not a test): replaces pool.query with an in-memory stand-in for the few growth tables, and builds fake fetch responses.
import { pool } from '../src/db.js';

export function fakeDb() {
  const db = { secrets: new Map(), integ: new Map(), logs: [], settings: new Map() };
  pool.query = async (sql, p = []) => {
    const s = String(sql);
    if (s.includes('INSERT INTO growth_secrets')) { db.secrets.set(p[0], { v_enc: p[1], last4: p[2] }); return [{}]; }
    if (s.includes('SELECT v_enc FROM growth_secrets')) return [db.secrets.has(p[0]) ? [{ v_enc: db.secrets.get(p[0]).v_enc }] : []];
    if (s.includes('DELETE FROM growth_secrets')) { db.secrets.delete(p[0]); return [{}]; }
    if (s.includes('FROM growth_secrets WHERE k IN')) return [[...db.secrets].filter(([k]) => p[0].includes(k)).map(([k, v]) => ({ k, last4: v.last4, updated_at: null }))];
    if (s.includes('FROM growth_integrations')) return [db.integ.has(p[0]) ? [db.integ.get(p[0])] : []];
    if (s.includes('INSERT INTO growth_integrations')) { db.integ.set(p[0], { status: p[1], account: p[2], last_sync: p[3], last_error: p[4], meta: p[5] }); return [{}]; }
    if (s.includes('INSERT INTO integration_logs')) { const [integration, action, method, target, status, ok, ms, attempt, error] = p; db.logs.push({ integration, action, method, target, status, ok, ms, attempt, error }); return [{}]; }
    if (s.includes('SELECT v FROM settings')) return [db.settings.has(p[0]) ? [{ v: db.settings.get(p[0]) }] : []];
    if (s.includes('INSERT INTO settings')) { db.settings.set(p[0], p[1]); return [{}]; }
    throw new Error('fakeDb: unexpected SQL ' + s.slice(0, 80));
  };
  return db;
}
/** A fetch Response stand-in. */
export const res = (status, body, headers = {}) => ({ status, text: async () => (typeof body === 'string' ? body : body == null ? '' : JSON.stringify(body)), headers: { get: k => headers[k.toLowerCase()] ?? null } });
/** fetch replacement answering from a queue (or a function) and recording every call. */
export function scriptedFetch(answers) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, ...init }); const a = typeof answers === 'function' ? answers(url, init, calls.length) : answers.shift(); if (a instanceof Error) throw a; return a; };
  f.calls = calls;
  return f;
}
