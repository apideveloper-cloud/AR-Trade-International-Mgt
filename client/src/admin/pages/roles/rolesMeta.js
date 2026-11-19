import { ROLE_HUE } from '../../ui.jsx';

/** Accent hue of a role (grey-blue when unknown). */
export const hue = r => ROLE_HUE[r] ?? 250;
export const GROUP_ICON = { Overview: '📊', Sales: '🧾', Catalog: '📦', Delivery: '🚚', Engage: '📣', 'Field & mobile app': '📍', System: '⚙️' };
export const GROUP_HUE = { Overview: 250, Sales: 160, Catalog: 45, Delivery: 200, Engage: 330, 'Field & mobile app': 120, System: 300 };
/** The one permission that only the Master Admin holds and nobody can tick. */
export const MASTER_ONLY = 'roles.manage';
export const editable = key => key !== MASTER_ONLY;
