import { saveTextFile } from '../../hooks/download.js';

/** Downloads the matrix as a CSV (group, permission, one Yes column per shown role). */
export function downloadRoleCsv(roles, perms, draft) {
  const rows = [['Group', 'Permission', ...roles.map(r => r.name)], ...perms.map(p => [p.group, p.label, ...roles.map(r => (r.locked || draft[r.name]?.has(p.key) ? 'Yes' : ''))])];
  const text = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  saveTextFile('ar-trade-role-matrix.csv', '﻿' + text);
}
