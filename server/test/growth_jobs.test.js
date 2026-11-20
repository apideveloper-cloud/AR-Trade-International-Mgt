// Job queue: recurring jobs that keep failing are not re-queued every tick; old finished rows are pruned. Also the OAuth state key and the IP limiter sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db.js';
import { registerRecurring, queueRecurring, pruneOld, _resetPrune, FAILED_PAUSE_MS, KEEP_DONE_MS } from '../src/growth/jobs.js';
import { signState, readState } from '../src/growth/google.js';
import { makeIpLimiter } from '../src/growth/reviewSpam.js';
import { isBlockedIp } from '../src/growth/linkCheck.js';
import { secret } from '../src/util.js';

function fakeJobs(rows) {
  const log = { inserted: [], deletes: [] };
  pool.query = async (sql, p = []) => {
    const s = String(sql);
    if (s.startsWith('SELECT 1 FROM growth_jobs')) {
      const [type, doneSince, failSince] = p;
      return [rows.filter(r => r.type === type && (['Queued', 'Running'].includes(r.status) || (r.status === 'Done' && r.finished_at > doneSince) || (r.status === 'Failed' && r.finished_at > failSince))).map(() => ({ 1: 1 }))];
    }
    if (s.startsWith('DELETE FROM growth_jobs WHERE dedupe_key')) return [{}];
    if (s.startsWith('INSERT IGNORE INTO growth_jobs')) { log.inserted.push(p[0]); return [{ affectedRows: 1, insertId: 1 }]; }
    if (s.startsWith('DELETE FROM')) { log.deletes.push({ sql: s, at: p[0] }); return [{}]; }
    throw new Error('unexpected SQL ' + s.slice(0, 60));
  };
  return log;
}

test('recurring: a job that failed minutes ago is not queued again, one that failed over an hour ago is', async () => {
  registerRecurring('t_fail_job', 24 * 3600e3);
  let log = fakeJobs([{ type: 't_fail_job', status: 'Failed', finished_at: new Date(Date.now() - 10 * 60e3) }]);
  await queueRecurring();
  assert.ok(!log.inserted.includes('t_fail_job'));
  log = fakeJobs([{ type: 't_fail_job', status: 'Failed', finished_at: new Date(Date.now() - FAILED_PAUSE_MS - 60e3) }]);
  await queueRecurring();
  assert.ok(log.inserted.includes('t_fail_job'));
});

test('prune: finished jobs and log rows older than the retention are deleted, at most once an hour', async () => {
  const log = fakeJobs([]);
  _resetPrune();
  const now = Date.now();
  await pruneOld(now);
  assert.equal(log.deletes.length, 3);
  assert.equal(log.deletes[0].at.getTime(), now - KEEP_DONE_MS);
  await pruneOld(now + 1000);
  assert.equal(log.deletes.length, 3);
});

test('google state: signed with its own key, so it is not a sign-in token', () => {
  const st = signState(7);
  assert.equal(readState(st), 7);
  assert.throws(() => jwt.verify(st, secret())); // the sign-in key does not accept it
  assert.equal(readState(jwt.sign({ sid: 7, p: 'growth-google' }, secret())), 0); // and a token made with the sign-in key is not a state
  assert.equal(readState('junk'), 0);
});

test('ip limiter: quiet keys are swept so the map does not grow without bound', () => {
  let t = 0;
  const l = makeIpLimiter({ max: 5, windowMs: 1000, now: () => t });
  for (let i = 0; i < 2500; i++) l.hit('ip' + i);
  t = 5000;
  l.hit('late');
  assert.equal(l.size(), 1);
});

test('link checker: benchmarking and IETF-protocol ranges are blocked too', () => {
  for (const ip of ['198.18.0.1', '198.19.255.1', '192.0.0.8']) assert.equal(isBlockedIp(ip), true, ip);
  assert.equal(isBlockedIp('198.20.0.1'), false);
  assert.equal(isBlockedIp('93.184.216.34'), false);
});
