import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Router } from 'express';
import { ensureFieldSchema } from './field/migrate.js';
import { moduleGate, ensureModuleTable } from './field/gate.js';
import authRoutes from './field/core/auth.js';
import attendanceRoutes from './field/core/attendance.js';
import trackRoutes from './field/core/track.js';
import expenseRoutes from './field/core/expenses.js';

// REST API for the AR Trade mobile app: sign-in, attendance, live GPS tracking and expenses (src/field/core/*), then the feature modules.
const router = Router();
// the admin can switch whole areas off (see field/gate.js); the core areas are gated here, module files below
for (const area of ['attendance', 'track', 'expenses', 'vouchers']) router.use('/' + area, moduleGate(area));
router.use(authRoutes, attendanceRoutes, trackRoutes, expenseRoutes);

// ---------- feature modules: src/field/modules/*.js, each mounted at /api/field/<file name> ----------
// A module that fails to load is logged and skipped so one broken file can never take the whole API down.
await ensureFieldSchema();
await ensureModuleTable().catch(e => console.error('[field] module switches:', e.message));
const modulesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'field', 'modules');
if (fs.existsSync(modulesDir)) {
  for (const f of fs.readdirSync(modulesDir).filter(f => f.endsWith('.js')).sort()) {
    try {
      const m = await import(pathToFileURL(path.join(modulesDir, f)).href);
      const name = f.replace(/\.js$/, '');
      router.use('/' + name, moduleGate(name), m.default);
    } catch (e) { console.error(`[field] module ${f} failed to load: ${e.message}`); }
  }
}

export default router;
