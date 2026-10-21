/** Dumps the application database to a .sql file (schema + data) without needing mysqldump.  npm run db:export -- out.sql */
import fs from 'node:fs';
import { pool } from '../src/db.js';

const out = process.argv[2] || 'artradeint_mgt.sql';
const esc = v => {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`;
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'object') v = JSON.stringify(v);
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\0/g, '') + "'";
};
const w = fs.createWriteStream(out);
w.write('-- AR Trade International: database export\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n');
const [tabs] = await pool.query("SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
for (const { t } of tabs) {
  const [[c]] = await pool.query(`SHOW CREATE TABLE \`${t}\``);
  w.write(`DROP TABLE IF EXISTS \`${t}\`;\n${c['Create Table']};\n`);
  const [rows] = await pool.query(`SELECT * FROM \`${t}\``);
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    const cols = Object.keys(part[0]).map(k => '`' + k + '`').join(',');
    w.write(`INSERT INTO \`${t}\` (${cols}) VALUES\n${part.map(r => '(' + Object.values(r).map(esc).join(',') + ')').join(',\n')};\n`);
  }
  w.write('\n');
  console.log(t.padEnd(22), rows.length);
}
w.write('SET FOREIGN_KEY_CHECKS = 1;\n');
w.end();
await new Promise(r => w.on('finish', r));
await pool.end();
