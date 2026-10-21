import { STATUS_COLORS } from './adminApi.js';

export function Pill({ s, label }) {
  const [bg, fg] = STATUS_COLORS[s] || ['#eef2f8', '#2b3550'];
  return <span className="a-pill" style={{ background: bg, color: fg }}>{label || s}</span>;
}

/** Search box + optional filter selects + page size, like the design's grid toolbar. */
export function Toolbar({ t, search = true, filters = [], sizes = [10, 25, 50], children }) {
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

export function Modal({ kicker, title, onClose, onSubmit, children, footer }) {
  return (
    <>
      <div className="a-scrim" style={{ background: 'rgba(11,22,49,.55)' }} onClick={onClose} />
      <form className="a-modal" onSubmit={onSubmit}>
        <div className="hd"><div><small>{kicker}</small><b>{title}</b></div><button type="button" className="a-x" onClick={onClose}>✕</button></div>
        <div className="bd">{children}</div>
        {footer && <div className="ft">{footer}</div>}
      </form>
    </>
  );
}
