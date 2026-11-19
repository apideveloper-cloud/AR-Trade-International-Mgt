// Offline tests for the pure helpers behind src/field.js, modules/purchase.js and modules/reports.js (no database).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfile, serverTime, bdDayStartUtc, bdDayWindow, summariseDay, parseVoucher, parseExpense } from '../src/field/core/rules.js';
import { totals, budgetOf, tagQuotes, numberId, dueDateBD, cleanLine, BUDGET } from '../src/field/purchase/calc.js';
import { foldDays, lateDay, hoursOf } from '../src/field/reports/attendance.js';
import { expenseFigures } from '../src/field/reports/expense.js';
import { agingBuckets } from '../src/field/reports/collection.js';
import { filterRows } from '../src/field/reports/export.js';
import { dateText, clockText } from '../src/field/reports/datasets.js';
import { dayText } from '../src/field/reports/shared.js';

test('profile form is cleaned and validated', () => {
  assert.deepEqual(parseProfile({ name: ' Rafi ', email: ' A@B.com ', phone: '+880 1712-345678' }), { name: 'Rafi', email: 'a@b.com', phone: '01712345678' });
  assert.throws(() => parseProfile({ name: 'R', email: 'a@b.com', phone: '01712345678' }), /name/);
  assert.throws(() => parseProfile({ name: 'Rafi', email: 'nope', phone: '01712345678' }), /email/);
  assert.throws(() => parseProfile({ name: 'Rafi', email: 'a@b.com', phone: '12345' }), /11-digit/);
});

test('the phone clock is trusted only within 5 minutes', () => {
  const now = Date.parse('2026-11-18T10:00:00Z');
  assert.equal(serverTime('2026-11-18T10:03:00Z', now), Date.parse('2026-11-18T10:03:00Z'));
  assert.equal(serverTime('2026-11-18T10:06:00Z', now), now);
  assert.equal(serverTime('garbage', now), now);
  assert.equal(serverTime(undefined, now), now);
});

test('Bangladesh day windows', () => {
  assert.equal(bdDayStartUtc(Date.parse('2026-11-18T20:00:00Z')).toISOString(), '2026-11-18T18:00:00.000Z'); // already 19 Nov 02:00 in Dhaka
  assert.equal(bdDayStartUtc(Date.parse('2026-11-18T10:00:00Z')).toISOString(), '2026-11-17T18:00:00.000Z');
  const w = bdDayWindow('2026-11-18');
  assert.equal(w.start.toISOString(), '2026-11-17T18:00:00.000Z');
  assert.equal(w.end.toISOString(), '2026-11-18T18:00:00.000Z');
  assert.equal(w.monthStart.toISOString(), '2026-10-31T18:00:00.000Z');
});

test('summariseDay: status and duty minutes', () => {
  const base = { date: '2026-11-18', today: '2026-11-18', weeklyOff: false, now: Date.parse('2026-11-18T05:00:00Z') };
  const punches = [{ type: 'Clocked In', at: '2026-11-18T03:00:00Z' }, { type: 'Clocked Out', at: '2026-11-18T03:30:00Z' }, { type: 'Clocked In', at: '2026-11-18T04:00:00Z' }];
  const open = summariseDay(punches, base);
  assert.equal(open.status, 'On duty');
  assert.equal(open.minutes, 90);
  assert.equal(open.lastOut, '2026-11-18T03:30:00Z');
  assert.equal(summariseDay(punches, { ...base, onLeave: true }).status, 'On leave');
  assert.equal(summariseDay([], base).status, 'Absent');
  assert.equal(summariseDay([], { ...base, weeklyOff: true }).status, 'Weekly off');
  assert.equal(summariseDay([], { ...base, date: '2026-11-19' }).status, '—');
  assert.equal(summariseDay(punches.slice(0, 2), base).status, 'Present');
});

test('voucher photos and expense claims are validated', () => {
  const ok = parseVoucher('data:image/png;base64,AAAA');
  assert.equal(ok.ext, '.png');
  assert.equal(ok.buf.length, 3);
  assert.throws(() => parseVoucher('data:image/gif;base64,AAAA'), /JPG, PNG or WebP/);
  assert.throws(() => parseVoucher('data:image/jpeg;base64,' + Buffer.alloc(4 * 1048576 + 1).toString('base64')), /under 4 MB/);
  assert.deepEqual(parseExpense({ title: ' Fuel ', category: 'Travel', amount: '12.345' }), { title: 'Fuel', category: 'Travel', amount: 12.35 });
  assert.throws(() => parseExpense({ title: 'x', category: 'y', amount: 0 }), /required/);
  assert.throws(() => parseExpense({ title: 'x', category: 'y', amount: 10000001 }), /required/);
});

test('purchase totals, budget and ids', () => {
  const t = totals([{ qty: 10, unitPrice: 1000 }, { qty: 2, unitPrice: 500 }]);
  assert.deepEqual(t, { subtotal: 11000, vat: 550, freight: 1500, grand: 13050, pcs: 12 });
  assert.deepEqual(totals([]), { subtotal: 0, vat: 0, freight: 0, grand: 0, pcs: 0 });
  assert.equal(budgetOf(BUDGET + 5).within, false);
  assert.equal(budgetOf(BUDGET + 5).over, 5);
  assert.equal(budgetOf(1).over, 0);
  assert.equal(numberId('PO-', 884), 'PO-0884');
  assert.equal(numberId('PO-', 'PO-0884'), 'PO-0884');
  assert.equal(dueDateBD(3, Date.parse('2026-11-18T20:00:00Z')), '2026-11-22'); // 19 Nov in Dhaka + 3
});

test('vendor quotes get Lowest / Best value tags', () => {
  const tagged = tagQuotes([{ unitPrice: 100, rating: 3 }, { unitPrice: 110, rating: 5 }, { unitPrice: 150, rating: 3 }]);
  assert.deepEqual(tagged.map(q => q.tag), ['Lowest', 'Best value', '']);
  assert.deepEqual(tagQuotes([]), []);
});

test('order lines are cleaned', () => {
  assert.deepEqual(cleanLine({ productId: 'x', name: ' Toner ', sku: ' T1 ', qty: '5', unitPrice: '99' }), { productId: null, name: 'Toner', sku: 'T1', qty: 5, unitPrice: 99 });
});

test('attendance days fold punches per Bangladesh day', () => {
  const rows = [
    { staff_id: 1, type: 'Clocked Out', at_utc: '2026-11-17T20:00:00Z' }, // clock-out with no clock-in that day: ignored
    { staff_id: 1, type: 'Clocked In', at_utc: '2026-11-18T03:00:00Z' },
    { staff_id: 1, type: 'Clocked Out', at_utc: '2026-11-18T05:00:00Z' },
    { staff_id: 2, type: 'Clocked In', at_utc: '2026-11-18T03:30:00Z' }
  ];
  const days = foldDays(rows, Date.parse('2026-11-18T06:00:00Z'));
  assert.equal(days.length, 2);
  assert.equal(days[0].ms, 2 * 3600e3);
  assert.equal(days[1].ms, 2.5 * 3600e3); // still open: counted until now
  assert.equal(hoursOf(days), 2.25);
  assert.equal(hoursOf([]), 0);
  assert.ok(lateDay({ first: new Date('2026-11-18T03:30:00Z') })); // 09:30 Dhaka
  assert.ok(!lateDay({ first: new Date('2026-11-18T03:00:00Z') })); // 09:00 Dhaka
});

test('expense and collection figures', () => {
  const f = expenseFigures([
    { status: 'Approved', category: 'Fuel', n: 2, amount: '300' }, { status: 'Pending', category: 'Fuel', n: 1, amount: '100' }, { status: 'Rejected', category: 'Food', n: 1, amount: '50' }
  ]);
  assert.equal(f.total, 450);
  assert.equal(f.count, 4);
  assert.deepEqual(f.split.map(s => s.amount), [300, 100, 50]);
  assert.deepEqual(f.categories.map(c => c.name), ['Fuel', 'Food']);
  const a = agingBuckets([{ due: 10, age: 0 }, { due: 20, age: 16 }, { due: 30, age: 45 }, { due: 5, age: 15 }]);
  assert.deepEqual(a.map(b => b.amount), [15, 20, 30]);
});

test('export helpers', () => {
  assert.deepEqual(filterRows([['A', 'x'], ['B', 'y']], ' b '), [['B', 'y']]);
  assert.equal(filterRows([['A']], '').length, 1);
  assert.equal(dateText('2026-11-18T20:00:00Z'), '19 Nov 2026');
  assert.equal(dayText('2026-11-05'), '5 Nov 2026');
  assert.equal(clockText(9 * 60 + 5), '09:05');
});
