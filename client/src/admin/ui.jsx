import { useEffect, useState } from 'react';
import { STATUS_COLORS } from './adminApi.js';

export function Pill({ s, label }) {
  const [bg, fg] = STATUS_COLORS[s] || ['#eef2f8', '#2b3550'];
  return <span className="a-pill" style={{ background: bg, color: fg }}>{label || s}</span>;
}

/** Search box + optional filter selects + page size, like the design's grid toolbar. */
export function Toolbar({ t, search = true, filters = [], sizes = [10, 25, 50, 100], children }) {
  const { params, set, data, loading } = t;
  const dirty = params.q || filters.some(f => params[f.key]);
  const from = data.total ? (params.page - 1) * params.size + 1 : 0;
  const to = Math.min(params.page * params.size, data.total);
  return (
    <div className="a-bar">
      {search && <label className="q"><span style={{ color: '#8a8f9b' }}>⌕</span><input defaultValue={params.q} key={params.q === '' ? 'empty' : 'q'} onChange={e => { const v = e.target.value; clearTimeout(Toolbar._t); Toolbar._t = setTimeout(() => set({ q: v }), 300); }} placeholder="Search…" /></label>}
      {filters.map(f => (
        <select key={f.key} title={f.label} value={params[f.key] || ''} onChange={e => set({ [f.key]: e.target.value })}>
          <option value="">{f.label}</option>{f.options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.t ?? o}</option>)}
        </select>
      ))}
      {dirty && <button className="clr" onClick={() => set(Object.fromEntries(['q', ...filters.map(f => f.key)].map(k => [k, ''])))}>Clear ×</button>}
      {children}
      <span className="info">{loading ? <b style={{ color: 'oklch(0.5 0.15 252)' }}>⟳ Fetching…</b> : `${from}–${to} of ${data.total}`}</span>
      <select value={params.size} onChange={e => set({ size: +e.target.value })}>{sizes.map(s => <option key={s} value={s}>{s} / page</option>)}</select>
    </div>
  );
}

export function Pager({ t }) {
  const { params, go, data } = t;
  const pages = Math.max(1, Math.ceil(data.total / params.size));
  if (pages <= 1) return null;
  const list = [...new Set([1, params.page - 1, params.page, params.page + 1, pages].filter(p => p >= 1 && p <= pages))].sort((a, b) => a - b);
  return (
    <div className="a-pager">
      <span>Page {params.page} of {pages}</span>
      <button disabled={params.page <= 1} onClick={() => go(params.page - 1)}>‹ Prev</button>
      {list.map(p => <button key={p} className={p === params.page ? 'on' : ''} onClick={() => go(p)}>{p}</button>)}
      <button disabled={params.page >= pages} onClick={() => go(params.page + 1)}>Next ›</button>
    </div>
  );
}

export const Empty = ({ t }) => (!t.loading && !t.data.rows.length ? <div className="a-empty">{t.error || 'No records match your search or filters.'}</div> : null);

export function Switch({ on, onChange, title }) {
  return <button type="button" className={'a-sw' + (on ? ' on' : '')} title={title} onClick={() => onChange(!on)} />;
}

export function Drawer({ title, sub, onClose, children }) {
  return (
    <>
      <div className="a-scrim" onClick={onClose} />
      <aside className="a-drawer">
        <div className="hd"><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontFamily: 'var(--disp)', fontWeight: 800, fontSize: 22 }}>{title}</span><span style={{ fontSize: 12, color: '#5d6270' }}>{sub}</span></div><button className="a-x" onClick={onClose}>✕</button></div>
        <div className="bd">{children}</div>
      </aside>
    </>
  );
}

/** Dialog. With `side` it slides in from the right as a full-height panel (used for the bigger forms). */
export function Modal({ kicker, title, onClose, onSubmit, children, footer, side, narrow, cls = '' }) {
  return (
    <>
      <div className={'a-scrim' + (cls ? ' ' + cls : '')} style={{ background: 'rgba(11,22,49,.55)' }} onClick={onClose} />
      <form className={'a-modal' + (side ? ' slide' : '') + (narrow ? ' narrow' : '') + (cls ? ' ' + cls : '')} onSubmit={onSubmit}>
        <div className="hd"><div><small>{kicker}</small><b>{title}</b></div><button type="button" className="a-x" onClick={onClose}>✕</button></div>
        <div className="bd">{children}</div>
        {footer && <div className="ft">{footer}</div>}
      </form>
    </>
  );
}

const SUM_ICONS = {
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.7.6 2.7 2.2 3 4.7" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  money: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.6.8 2.6 2-1.2 2-2.6 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8m0 8v1.5" /></>,
  repeat: <><path d="M4 11V9a3 3 0 0 1 3-3h11l-3-3M20 13v2a3 3 0 0 1-3 3H6l3 3" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" /><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" /></>,
  alert: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r=".7" fill="currentColor" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4.5 17 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4" /></>,
  tag: <><path d="M3.5 12.5V4.5h8l9 9-8 8-9-9z" /><circle cx="8" cy="9" r="1.4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></>,
  cart: <><path d="M5 7h14l-1.4 9.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 7z" /><path d="M9 7V6a3 3 0 0 1 6 0v1" /></>
};

/** A row of summary cards at the top of a page. items: [title, value, sub, tone, icon] where tone is blue | amber | violet | green | red. */
export function Summary({ items }) {
  return (
    <div className="kpis sum">
      {items.map(([title, value, sub, tone, icon]) => (
        <div className={'kpi tone-' + tone} key={title}>
          <span className="kic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{SUM_ICONS[icon]}</svg></span>
          <small>{title}</small>
          <b className={typeof value === 'string' && value.length > 14 ? 'txt' : ''} title={String(value)}>{value}</b>
          <span>{sub}</span>
        </div>
      ))}
    </div>
  );
}

SUM_ICONS.mail = <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>;

/** Colour (hue) of each role, used on the Team and Roles pages. */
export const ROLE_HUE = { 'Master Admin': 85, Admin: 250, Manager: 160, Accountant: 300, 'Purchase Officer': 45, RM: 15, 'Field Officer': 200, 'Delivery rider': 230, 'Marketing manager': 330, 'Content writer': 120 };
export const hueOf = s => [...String(s || '')].reduce((a, c) => (a + c.charCodeAt(0) * 7) % 360, 0);

/** List | Grid choice remembered per page in this browser. */
export function useView(key, fallback = 'list') {
  const k = 'ar_view_' + key;
  const [view, setView] = useState(() => { try { const v = localStorage.getItem(k); return v === 'grid' || v === 'list' ? v : fallback; } catch { return fallback; } });
  const set = v => { setView(v); try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
  return [view, set];
}
export function ViewToggle({ view, setView }) {
  return (
    <div className="vt" role="group" aria-label="Layout">
      <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')} title="List view"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>List</button>
      <button type="button" className={view === 'grid' ? 'on' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')} title="Grid view"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>Grid</button>
    </div>
  );
}

/* ---- confirm / alert dialogs in the console's own style (instead of the browser's grey boxes) ---- */
let showDialog = null;
const ask = req => new Promise(resolve => {
  if (!showDialog) { resolve(req.kind === 'confirm' ? window.confirm(req.message) : (window.alert(req.message), true)); return; }
  showDialog({ ...req, resolve });
});
/** await confirmBox('Delete this?', { danger: true, confirmLabel: 'Delete' }) -> true / false */
export const confirmBox = (message, opts = {}) => ask({ kind: 'confirm', message, ...opts });
/** await alertBox('Something went wrong') */
export const alertBox = (message, opts = {}) => ask({ kind: 'alert', message, ...opts });

/** Mounted once in the admin frame: shows whichever dialog confirmBox / alertBox asked for. */
export function DialogHost() {
  const [d, setD] = useState(null);
  useEffect(() => { showDialog = setD; return () => { showDialog = null; }; }, []);
  useEffect(() => {
    if (!d) return undefined;
    const key = e => { if (e.key === 'Escape') { setD(null); d.resolve(d.kind === 'confirm' ? false : true); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [d]);
  if (!d) return null;
  const done = v => { setD(null); d.resolve(v); };
  const tone = d.danger || d.kind === 'alert' ? 'bad' : 'info';
  return (
    <div className="a-dlg-bg" onMouseDown={e => { if (e.target === e.currentTarget) done(d.kind === 'confirm' ? false : true); }}>
      <div className="a-dlg" role={d.kind === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={d.title || (d.kind === 'alert' ? 'Notice' : 'Please confirm')}>
        <span className={'ic ' + tone}>{tone === 'bad' ? '!' : '?'}</span>
        <h3>{d.title || (d.kind === 'alert' ? 'Something needs your attention' : 'Please confirm')}</h3>
        <p>{d.message}</p>
        <div className="acts">
          {d.kind === 'confirm' && <button type="button" className="a-btn ghost" onClick={() => done(false)}>{d.cancelLabel || 'Cancel'}</button>}
          <button type="button" autoFocus className={'a-btn' + (d.danger ? ' danger' : '')} onClick={() => done(true)}>{d.confirmLabel || (d.kind === 'alert' ? 'OK' : 'Yes, continue')}</button>
        </div>
      </div>
    </div>
  );
}
