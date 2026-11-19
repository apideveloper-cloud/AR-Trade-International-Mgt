// The database backup: a plain-Node dump of every table in one consistent snapshot, gzip-compressed, and the check that it is complete.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { once } from 'node:events';
import mysql from 'mysql2/promise';
import { pool } from '../db.js';
import { BATCH, SKIP } from './config.js';
import { setProg } from './state.js';

/** Writes the whole database to `file` (gzip). Resolves to { tables, rows }. */
export async function dumpDb(file) {
  const conn = await pool.getConnection();
  const gz = zlib.createGzip({ level: 6 });
  const ws = fs.createWriteStream(file);
  const done = new Promise((res, rej) => { ws.on('finish', res); ws.on('error', rej); gz.on('error', rej); });
  gz.pipe(ws);
  const put = async s => { if (!gz.write(s)) await once(gz, 'drain'); };
  let tables = 0, rows = 0;
  try {
    await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT'); // one moment in time for every table
    const [[db]] = await conn.query('SELECT DATABASE() d');
    await put(`-- AR Trade International database backup\n-- Database: ${db.d}\n-- Started: ${new Date().toISOString()}\n`);
    await put("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n");
    const [list] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const names = list.map(r => Object.values(r)[0]).filter(n => !SKIP.has(n)).sort();
    let total = 0; // exact row count first (inside the same snapshot), so the percentage is real
    for (const t of names) { const [[n]] = await conn.query(`SELECT COUNT(*) n FROM ${mysql.escapeId(t)}`); total += Number(n.n); }
    total = Math.max(total, 1);
    for (const t of names) {
      const id = mysql.escapeId(t);
      setProg(2 + (rows / total) * 90, 'Saving table ' + t);
      const [[c]] = await conn.query(`SHOW CREATE TABLE ${id}`);
      await put(`-- Table ${t}\nDROP TABLE IF EXISTS ${id};\n${c['Create Table']};\n`);
      const [pk] = await conn.query("SELECT COLUMN_NAME c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION", [t]);
      const order = pk.length ? ' ORDER BY ' + pk.map(p => mysql.escapeId(p.c)).join(', ') : '';
      for (let off = 0; ; off += BATCH) {
        const [data, fields] = await conn.query({ sql: `SELECT * FROM ${id}${order} LIMIT ${BATCH} OFFSET ${off}`, dateStrings: true, typeCast: (f, next) => (f.type === 'JSON' ? f.string() : next()) });
        if (!data.length) break;
        const cols = fields.map(f => mysql.escapeId(f.name)).join(', ');
        await put(`INSERT INTO ${id} (${cols}) VALUES\n${data.map(r => '(' + fields.map(f => mysql.escape(r[f.name])).join(',') + ')').join(',\n')};\n`);
        rows += data.length;
        setProg(2 + (rows / total) * 90, 'Saving table ' + t);
        if (data.length < BATCH) break;
      }
      await put('\n');
      tables++;
    }
    await conn.query('COMMIT');
    await put(`SET FOREIGN_KEY_CHECKS=1;\nSET UNIQUE_CHECKS=1;\n-- Dump completed on ${new Date().toISOString()} (${tables} tables, ${rows} rows)\n`);
  } catch (e) {
    try { await conn.query('ROLLBACK'); } catch { /* connection already gone */ }
    gz.destroy();
    throw e;
  } finally {
    conn.release();
  }
  gz.end();
  await done;
  return { tables, rows };
}

/** True when the tail of a dump carries the "Dump completed" line. */
export const dumpIsComplete = tail => /-- Dump completed on /.test(tail);

/** A finished database copy must unzip cleanly and end with the "Dump completed" line. */
export async function verifyDb(file) {
  setProg(94, 'Checking the file');
  let tail = '';
  await new Promise((res, rej) => {
    fs.createReadStream(file).pipe(zlib.createGunzip()).on('data', d => { tail = (tail + d.toString('utf8')).slice(-400); }).on('end', res).on('error', rej);
  });
  if (!dumpIsComplete(tail)) throw new Error('The backup file is incomplete');
}
