import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useStore } from '../../store.jsx';

// Small pieces shared by the account tabs: the /account API wrapper, status badges, section heading, thumbnails and the orders hooks.

export const acc = {
  get: u => api.get('/account' + u), post: (u, b) => api.post('/account' + u, b), put: (u, b) => api.put('/account' + u, b),
  del: async (u, b) => {
    const res = await fetch('/api/account' + u, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: b ? JSON.stringify(b) : undefined });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Something went wrong');
    return d;
  }
};
export const STEPS = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];
export const SCOL = { Pending: ['oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'], Confirmed: ['oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)'], Packed: ['oklch(0.95 0.03 300)', 'oklch(0.42 0.14 300)'], Shipped: ['oklch(0.95 0.04 200)', 'oklch(0.42 0.12 210)'], Delivered: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'], Cancelled: ['oklch(0.96 0.03 25)', 'oklch(0.48 0.17 25)'], New: ['oklch(0.95 0.05 85)', 'oklch(0.45 0.12 70)'], Scheduled: ['oklch(0.95 0.03 240)', 'oklch(0.42 0.15 250)'], 'In progress': ['oklch(0.95 0.03 300)', 'oklch(0.42 0.14 300)'], Completed: ['oklch(0.95 0.05 150)', 'oklch(0.4 0.12 150)'] };
export const Badge = ({ s }) => <span className="ac-badge" style={{ background: (SCOL[s] || [])[0], color: (SCOL[s] || [])[1] }}>{s}</span>;
export const H2 = ({ children, right }) => <div className="ac-h2"><h2>{children}</h2>{right}</div>;
export const Thumb = ({ src, size = 40 }) => <div className="ac-thumb" style={{ width: size, height: size }}>{src && <div style={{ width: size - 8, height: size - 8, backgroundImage: `url('${src}')` }} />}</div>;
export const summary = o => { const n = o.items.reduce((a, i) => a + i.qty, 0); return `${o.items[0]?.name.split(' (')[0] || ''}${o.items.length > 1 ? ` + ${o.items.length - 1} more` : ''} · ${n} item${n > 1 ? 's' : ''}`; };
export const isOpen = o => !['Delivered', 'Cancelled'].includes(o.status); // still being processed
export const Loading = () => <div className="ac-loading-box"><span className="spin" /></div>;
// Empty-state message. size: default = card with generous padding, card = compact card, plain = bare text block, sm = bare text block, tighter.
const EMPTY_CLASS = { default: 'ac-card ac-empty', card: 'ac-card ac-empty-card', plain: 'ac-empty', sm: 'ac-empty-sm' };
export const Empty = ({ children, size = 'default' }) => <div className={EMPTY_CLASS[size]}>{children}</div>;
// Header strip of a card: bold title, then a hint (or any node passed as right) pushed to the far side.
export const CardHead = ({ title, hint, right, className = '' }) => <div className={('ac-card-hd ' + className).trim()}><b>{title}</b>{right ?? (hint != null && <span className="ac-hint">{hint}</span>)}</div>;

export function useOrders() {
  const [orders, setOrders] = useState(null);
  const { user } = useStore();
  const reload = useCallback(() => (user ? api.get('/orders').then(setOrders).catch(() => setOrders([])) : Promise.resolve()), [user]); // no request while signed out
  useEffect(() => { reload(); }, [reload]);
  return [orders, reload];
}

export function useBuyAgain() {
  const { addToCart, find, say } = useStore();
  const nav = useNavigate();
  return items => {
    let n = 0;
    items.forEach(i => { const p = find(i.id); if (p && p.price) { addToCart(p, i.qty); n++; } });
    if (n) nav('/cart'); else say('Those products are no longer available');
  };
}
