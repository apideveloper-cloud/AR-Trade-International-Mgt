// Finds accounts that still use the seeded demo passwords (admin123, rider123, demo123 ...) and locks them.
//   npm run db:lockdown            report only, changes nothing
//   npm run db:lockdown -- --apply disable the demo accounts; the demo admin stays Active with a NEW random password (printed once)
// Run it against the live database right after importing an export from a development machine.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const apply = process.argv.includes('--apply');
const DEMO_STAFF = {
  'admin@artradeinternational.com': ['admin123'], 'rider@artradeinternational.com': ['rider123'], 'rider2@artradeinternational.com': ['rider123'],
  'rider3@artradeinternational.com': ['rider123'], 'rider4@artradeinternational.com': ['rider123'], 'marketing@artradeinternational.com': ['market123'],
  'writer@artradeinternational.com': ['writer123'], 'field@artradeinternational.com': ['field123'], 'manager@artradeinternational.com': ['manager123'],
  'accounts@artradeinternational.com': ['accounts123']
};
const DEMO_CUSTOMERS = { 'demo@artrade.com': ['demo123'] };
const fresh = () => crypto.randomBytes(9).toString('base64url');

async function demoRows(table, list) {
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE email IN (?)`, [Object.keys(list)]);
  const hits = [];
  for (const r of rows) if ((await Promise.all(list[r.email].map(p => bcrypt.compare(p, r.password_hash)))).some(Boolean)) hits.push(r);
  return hits;
}

const staff = await demoRows('staff', DEMO_STAFF);
const customers = await demoRows('users', DEMO_CUSTOMERS);
console.log(`Staff accounts still on a demo password: ${staff.length}`);
staff.forEach(s => console.log(`  - ${s.email} (${s.role}, ${s.status})`));
console.log(`Customer accounts still on a demo password: ${customers.length}`);
customers.forEach(u => console.log(`  - ${u.email}`));

if (!apply) {
  console.log(staff.length || customers.length ? '\nNothing changed. Re-run with --apply to lock them.' : '\nNothing to do.');
} else {
  for (const s of staff) {
    const pass = fresh();
    const keep = s.email === 'admin@artradeinternational.com';
    await pool.query('UPDATE staff SET password_hash = ?, status = ? WHERE id = ?', [await bcrypt.hash(pass, 10), keep ? 'Active' : 'Disabled', s.id]);
    if (keep) console.log(`\nNEW PASSWORD for ${s.email}: ${pass}   (sign in and change it; store it somewhere safe)`);
  }
  for (const u of customers) await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(fresh(), 10), u.id]);
  console.log(`\nLocked ${staff.length} staff and ${customers.length} customer demo accounts.`);
}
await pool.end();
