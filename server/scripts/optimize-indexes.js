import { pool } from '../src/db.js';
import { ensureIndexes } from '../src/indexes.js';

const n = await ensureIndexes(pool, console.log);
console.log(`${n} index(es) created; table statistics refreshed.`);
await pool.end();
