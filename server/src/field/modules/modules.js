// Module switches for the field app (controlled from the Admin console).
//   GET /api/field/modules/me      -> { modules: [keys this user may use] }          (any signed-in staff)
//   GET /api/field/modules/config  -> every module with enabled + roles              (admin only)
//   PUT /api/field/modules/config/:key { enabled?, roles? }                          (admin only)
import { Router } from 'express';
import { pool, guard, wrap, fail, roleKey } from '../common.js';
import { MODULES, ALL_ROLES, moduleConfig, moduleAllowed, dropModuleCache } from '../gate.js';

const router = Router();

router.get('/me', guard(), wrap(async (req, res) => {
  const role = roleKey(req.staff.role);
  const allowed = [];
  for (const m of MODULES) if (await moduleAllowed(m.key, role)) allowed.push(m.key);
  res.json({ modules: allowed });
}));

const adminOnly = [guard(), (req, res, next) => (roleKey(req.staff.role) === 'admin' ? next() : res.status(403).json({ error: 'Only an admin can change the modules' }))];

router.get('/config', adminOnly, wrap(async (req, res) => {
  const cfg = await moduleConfig(true);
  res.json({ roles: ALL_ROLES, modules: MODULES.map(m => ({ key: m.key, label: m.label, bn: m.bn, icon: m.icon, enabled: cfg[m.key].enabled, roles: cfg[m.key].roles })) });
}));

router.put('/config/:key', adminOnly, wrap(async (req, res) => {
  const m = MODULES.find(x => x.key === req.params.key);
  if (!m) throw fail(404, 'Unknown module');
  const cfg = await moduleConfig(true);
  const enabled = req.body.enabled == null ? cfg[m.key].enabled : !!req.body.enabled;
  const roles = Array.isArray(req.body.roles) ? [...new Set(req.body.roles.filter(r => ALL_ROLES.includes(r)))] : cfg[m.key].roles;
  await pool.query('UPDATE field_module_config SET enabled = ?, roles = ?, updated_by = ? WHERE module_key = ?', [enabled ? 1 : 0, JSON.stringify(roles), req.staff.name, m.key]);
  dropModuleCache();
  res.json({ key: m.key, enabled, roles });
}));

export default router;
