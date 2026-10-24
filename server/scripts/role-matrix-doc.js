// Writes ROLE_MATRIX.md (the default role matrix) from the code.  npm run docs:roles
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMS, ROLE_DEFS, DEFAULTS, MASTER } from '../src/permissions.js';

const roles = ROLE_DEFS;
const cell = (r, k) => (r.name === MASTER || DEFAULTS[r.name].includes(k) ? '✔' : '');
const head = ['Permission', ...roles.map(r => r.name)];
const lines = [
  '# AR Trade Admin Console: role matrix (default access)',
  '',
  'This is the **starting** access for each role. The Master Admin can change any tick (except Master Admin itself) in **Admin Console > Roles**; the live matrix is stored in the database table `role_perms` and every change is logged in `role_log`.',
  'Regenerate this file from the code defaults with `npm run docs:roles` (in `server/`).',
  '',
  '## Roles',
  '',
  '| Role | What it is for |', '|---|---|',
  ...roles.map(r => `| **${r.name}**${r.legacy ? ' (existing role)' : ''} | ${r.desc} |`),
  '',
  '## Matrix',
  '',
  '✔ = allowed. The Master Admin column is fixed. "Edit this role matrix" belongs to the Master Admin only and can never be granted.',
  ''
];
let group = '';
lines.push('| ' + head.join(' | ') + ' |', '|' + head.map((_, i) => (i ? ':-:' : '---')).join('|') + '|');
for (const [key, g, label] of PERMS) {
  if (g !== group) { group = g; lines.push(`| **${g}** |${' |'.repeat(roles.length)}`); }
  lines.push(`| ${label} (\`${key}\`) | ${roles.map(r => cell(r, key)).join(' | ')} |`);
}
lines.push('', '## Rules that always apply', '',
  '- Only the **Master Admin** can open the role matrix, make someone a Master Admin or an Admin, or change an Admin. There must always be one active Master Admin.',
  '- Admin and every other role get exactly the ticks set in the matrix; a role with no ticks (Field Officer by default) sees no console pages.',
  '- Changes apply on the person\'s next click; no sign-out is needed.',
  '- The mobile app treats Master Admin / Admin as *admin*, Manager as *manager*, Accountant as *accounts* and every other role as *employee*. Approving expense claims and seeing live staff tracking needs the "Field & mobile app" permission.',
  '- Riders (anyone who can run deliveries but has no dispatch board) only see their own deliveries and cannot close one without the OTP or signature.',
  '- The stricter checks on each action (own records only, no self-approval of expenses, one active Master Admin) are in the server code and are not affected by the matrix.',
  '');
const out = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../ROLE_MATRIX.md');
fs.writeFileSync(out, lines.join('\n'));
console.log('written', out, lines.length, 'lines');
process.exit(0);
