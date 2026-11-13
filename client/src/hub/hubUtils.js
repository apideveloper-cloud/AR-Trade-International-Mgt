import { can } from '../admin/adminApi.js';

/** Can run own deliveries but has no dispatch board: shown the rider app only. */
export const isRiderOnly = staff => !can(staff, 'hub.view') && can(staff, 'hub.deliver');

export const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
export const DONE = ['Delivered', 'Cancelled', 'Returned'];
