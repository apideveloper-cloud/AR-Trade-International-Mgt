// The uploads backup: scan the folder (to detect changes) and check the finished tar.
import fs from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';
import { UPLOADS } from './config.js';

/** Walks the uploads folder: how many files, how many bytes, and the newest change. The three together say "has anything changed?". */
export async function scanUploads() {
  let n = 0, bytes = 0, newest = 0;
  const walk = async dir => {
    for (const e of await fs.promises.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) { const s = await fs.promises.stat(p); n++; bytes += s.size; if (s.mtimeMs > newest) newest = s.mtimeMs; }
    }
  };
  if (fs.existsSync(UPLOADS)) await walk(UPLOADS);
  return { n, bytes, sig: `${n}:${bytes}:${Math.round(newest)}` };
}

/** The finished archive must list at least `minFiles` entries. */
export async function verifyTar(file, minFiles) {
  let entries = 0;
  await tar.t({ file, onReadEntry: () => { entries++; } });
  if (entries < minFiles) throw new Error('The uploads archive is incomplete');
}
