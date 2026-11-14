export { Av, Chip, initials } from '../../fieldKit.jsx';

// Small helpers shared by the field pages (team map, attendance, approvals, module switches).
const BD = 'Asia/Dhaka';
export const hhmm = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: BD, hour: '2-digit', minute: '2-digit' }) : '—');
export const dayTime = iso => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: BD, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const hours = m => (m > 0 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : '—');
export const ago = sec => (sec == null ? 'no signal yet' : sec < 90 ? 'just now' : sec < 3600 ? Math.round(sec / 60) + ' min ago' : sec < 86400 ? Math.round(sec / 3600) + ' h ago' : Math.round(sec / 86400) + ' d ago');
export const Ic = ({ d }) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
export const ICON_CALL = <path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5 5l1.3-2 4 1.6V17a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z" />;
export const ICON_MSG = <><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M7.5 10h9M7.5 13h5.5" /></>;
export const ICON_INFO = <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></>;
export const ICON_PIN = <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></>;
export const osm = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
export const STATE = { 'In office': 'ok', 'On duty': 'blue', 'At client': 'violet', 'Off route': 'bad', Offline: 'off' };
export const DOT = { ok: '#1fa463', blue: '#2f7de1', violet: '#7a5af0', bad: '#e0483c', off: '#9aa3b5' };
