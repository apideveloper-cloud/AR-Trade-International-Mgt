import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DIR, NAME } from './config.js';

/** Deletes one backup file (only names that look like our own backups). */
export const removeFile = async (f, dir = DEFAULT_DIR) => { if (NAME.test(f)) await fs.promises.rm(path.join(dir, f), { force: true }); };
