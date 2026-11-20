import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pool } from '../src/db.js';
import { ensureReviewColumns, parseReviewUpdate, buildReviewStats, REVIEW_COLUMNS } from '../src/growth/reviewSchema.js';

function stub({ cols, statusType = "enum('Pending','Approved','Rejected')", index = false }) {
  const have = new Set(cols), ran = [];
  const orig = pool.query;
  pool.query = async sql => {
    const s = String(sql);
    if (s.includes('information_schema.COLUMNS')) return [[...have].map(c => ({ c, t: c === 'status' ? statusType : 'text' }))];
    if (s.includes('information_schema.STATISTICS')) return [index ? [{ i: 'idx_order' }] : []];
    ran.push(s);
    const m = /ADD COLUMN (\w+)/.exec(s);
    if (m) have.add(m[1]);
    if (/ENUM\(.*Spam/.test(s)) statusType = "enum('Pending','Approved','Rejected','Spam')";
    if (/ADD INDEX/.test(s)) index = true;
    return [{}];
  };
  return { ran, restore: () => { pool.query = orig; } };
}

test('adds only missing columns, enum and index; idempotent', async () => {
  const st = stub({ cols: ['id', 'status', 'admin_reply', 'source'] });
  const log = console.log; console.log = () => {};
  try {
    await ensureReviewColumns();
    const adds = st.ran.filter(s => s.includes('ADD COLUMN'));
    assert.equal(adds.length, REVIEW_COLUMNS.length - 2);
    assert.ok(!adds.some(s => /ADD COLUMN (admin_reply|source) /.test(s)));
    assert.equal(st.ran.filter(s => s.includes('MODIFY COLUMN status')).length, 1);
    assert.equal(st.ran.filter(s => s.includes('ADD INDEX')).length, 1);
    const n = st.ran.length;
    await ensureReviewColumns();
    assert.equal(st.ran.length, n);
  } finally { console.log = log; st.restore(); }
});
test('no enum change when Spam already present; no table -> no-op', async () => {
  const st = stub({ cols: ['status', ...REVIEW_COLUMNS.map(c => c[0])], statusType: "enum('Pending','Approved','Rejected','Spam')", index: true });
  try { await ensureReviewColumns(); assert.deepEqual(st.ran, []); } finally { st.restore(); }
  const s2 = stub({ cols: [] });
  try { await ensureReviewColumns(); assert.deepEqual(s2.ran, []); } finally { s2.restore(); }
});

test('PUT validation', () => {
  const p = (b, n = 'Rafi') => parseReviewUpdate(b, n);
  assert.throws(() => p({}), /Nothing to update/);
  assert.throws(() => p({ status: 'Bogus' }), /Unknown status/);
  assert.throws(() => p({ reply: 'x'.repeat(1001) }), /too long/);
  assert.throws(() => p({ reply: 5 }), /text/);
  const s = p({ status: 'Spam' }); assert.deepEqual(s.sets, ['status = ?', 'reviewed_at = NOW()']); assert.deepEqual(s.vals, ['Spam']);
  const r = p({ reply: ' Thanks! ' }); assert.deepEqual(r.vals, ['Thanks!', 'Rafi']); assert.ok(r.sets.includes('replied_at = NOW()')); assert.ok(!r.sets.includes('reviewed_at = NOW()'));
  const c = p({ reply: '  ' }); assert.ok(c.sets.includes('admin_reply = NULL')); assert.deepEqual(c.vals, []);
  const both = p({ status: 'Approved', reply: 'ok' }); assert.deepEqual(both.vals, ['Approved', 'ok', 'Rafi']);
});

test('stats arithmetic', () => {
  const s = buildReviewStats({
    byStatus: [{ status: 'Pending', n: 2 }, { status: 'Approved', n: 4 }, { status: 'Rejected', n: 1 }, { status: 'Spam', n: 3 }],
    approvedRows: [{ rating: 5, n: 3, verified: '2' }, { rating: 4, n: 1, verified: null }],
    last30: { received: 6, approved: null }, replied: 1
  });
  assert.deepEqual(s, { total: 10, pending: 2, approved: 4, rejected: 1, spam: 3, avgRating: 4.75, byRating: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 3 }, verifiedShare: 0.5, last30: { received: 6, approved: 0 }, repliedShare: 0.25 });
  const e = buildReviewStats();
  assert.equal(e.avgRating, 0); assert.equal(e.repliedShare, 0); assert.equal(e.total, 0);
});

test('public queries never expose Pending/Spam; JSON-LD source counts Approved only', () => {
  const cat = fs.readFileSync(new URL('../src/routes/catalog.js', import.meta.url), 'utf8');
  const list = cat.split('\n').find(l => l.includes('FROM reviews WHERE product_id = ? AND status = "Approved"'));
  assert.ok(list && list.includes('admin_reply'));
  assert.ok(cat.includes("m.status === 'Spam' ? 'Pending'"));
  assert.ok(cat.includes('status NOT IN ("Rejected", "Spam")'));
  const seo = fs.readFileSync(new URL('../src/seo.js', import.meta.url), 'utf8');
  const qs = seo.split('\n').filter(l => /FROM reviews/.test(l));
  assert.ok(qs.length >= 2);
  for (const q of qs) assert.match(q, /status = "Approved"/);
});
