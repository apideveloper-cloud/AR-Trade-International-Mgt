export const pct = (a, b) => (b && a != null ? Math.round(a / b * 1000) / 10 : null);
export const dash = '—';
/** Runs a mutation, reloads on success and tells the user on failure (no unhandled rejection). */
export const act = async (fn, after) => { try { await fn(); after?.(); } catch (e) { window.alert(e.message || 'Request failed'); } };
export const TABS = [['reports', 'Reports'], ['automations', 'Automations'], ['campaigns', 'Campaigns'], ['templates', 'Templates'], ['audience', 'Audience & preferences'], ['setup', 'Sending & compliance']];
export const TAG = { Eid: ['oklch(0.94 0.05 165)', 'oklch(0.38 0.1 165)'], Puja: ['oklch(0.95 0.05 45)', 'oklch(0.45 0.14 35)'], Boishakh: ['oklch(0.95 0.05 25)', 'oklch(0.48 0.17 25)'], 'Health tip': ['oklch(0.95 0.03 220)', 'oklch(0.42 0.1 230)'], Offer: ['oklch(0.95 0.04 255)', 'oklch(0.42 0.15 258)'] };
