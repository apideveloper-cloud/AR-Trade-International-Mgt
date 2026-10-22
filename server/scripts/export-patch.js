/** Writes a data-only catalog patch for the live DB (upserts, never drops, never touches orders/customers/staff).  npm run db:patch -- out.sql
 *  Run `npm run db:setup` on the target first so the new columns/tables exist. */
import fs from 'node:fs';
import { pool } from '../src/db.js';

const out = process.argv[2] || 'catalog-patch.sql';
const esc = v => {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'object') v = JSON.stringify(v);
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\0/g, '') + "'";
};
// table -> [where, replaceAll]  (replaceAll: child rows are wiped for the exported parents then re-inserted)
const PLAN = [
  ['products', '', false], ['product_images', '', true], ['product_specs', '', true],
  ['site_pages', '', false], ['blog_posts', '', false],
  ['settings', "k IN ('content')", false]
];
const w = fs.createWriteStream(out);
w.write('-- AR Trade International: catalog patch (upserts only)\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSTART TRANSACTION;\n\n');
for (const [t, where, wipe] of PLAN) {
  const [rows] = await pool.query(`SELECT * FROM \`${t}\`${where ? ' WHERE ' + where : ''}`);
  if (wipe) w.write(`DELETE FROM \`${t}\`;\n`);
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    const keys = Object.keys(part[0]);
    const cols = keys.map(k => '`' + k + '`').join(',');
    w.write(`INSERT INTO \`${t}\` (${cols}) VALUES\n${part.map(r => '(' + Object.values(r).map(esc).join(',') + ')').join(',\n')}\n` +
      (wipe ? ';\n' : `ON DUPLICATE KEY UPDATE ${keys.map(k => `\`${k}\`=VALUES(\`${k}\`)`).join(',')};\n`));
  }
  console.log(t.padEnd(18), rows.length);
}
w.write('\nCOMMIT;\nSET FOREIGN_KEY_CHECKS = 1;\n');
w.end();
await new Promise(r => w.on('finish', r));
await pool.end();
