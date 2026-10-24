import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchBlobUrl, fld } from './adminApi.js';
import { Modal, hueOf } from './ui.jsx';
import './field.css';

// Small shared pieces for the web views of the field app (sales, accounts, reports).
export const BD = 'Asia/Dhaka';
export const fDate = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: BD, day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fDateTime = iso => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: BD, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fTime = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: BD, hour: '2-digit', minute: '2-digit' }) : '—');
export const taka = n => '৳ ' + Math.round(Number(n) || 0).toLocaleString('en-US');
export const todayBd = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
export const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
export const Av = ({ name }) => <span className="fd-av" style={{ '--h': hueOf(name) }}>{initials(name)}</span>;
/** The PDF file icon (page with a folded corner and a red PDF label), used on every PDF button. */
export const PdfIcon = ({ size = 18 }) => (
  <svg className="pdf-ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 2h8.2L20 7.8V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke="#c9d1de" strokeWidth="1" />
    <path d="M14.2 2L20 7.8h-4.6a1.2 1.2 0 0 1-1.2-1.2V2z" fill="#e3e9f3" />
    <rect x="2.2" y="11.4" width="15.6" height="7.2" rx="1.6" fill="#e0483c" />
    <text x="10" y="16.9" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="5.6" fill="#fff">PDF</text>
  </svg>
);
export const Chip = ({ tone = 'off', children }) => <span className={'fd-chip ' + tone}>{children}</span>;
const ER_ICON = {
  lock: <><rect x="6" y="11" width="12" height="9" rx="2.5" fill="currentColor" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>,
  offline: <><path d="M4 9.5a11 11 0 0 1 16 0M7.2 13a6.5 6.5 0 0 1 9.6 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="17" r="1.6" fill="currentColor" /><path d="M5 5l14 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></>,
  alert: <><path d="M12 7v6.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /><circle cx="12" cy="17.2" r="1.5" fill="currentColor" /></>
};
/** A graphical error: an icon that says what kind of problem it is, a plain title, the exact message and, where it helps, a Try again button. */
export function Notice({ err, onRetry }) {
  if (!err) return null;
  const kind = /role|turned off|permission|not allowed|cannot do this|access/i.test(err) ? 'lock' : /reach the server|internet|network|fetch|restarting|busy/i.test(err) ? 'offline' : 'alert';
  const title = { lock: 'Not available for your role', offline: "We couldn't reach the server", alert: 'Something went wrong' }[kind];
  return (
    <div className={'er-card ' + kind} role="alert">
      <span className="er-ic"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">{ER_ICON[kind]}</svg></span>
      <div className="er-tx"><b>{title}</b>{err !== 'Something went wrong' && <p>{err}</p>}{kind === 'alert' && err === 'Something went wrong' && <p>Please try again. If it keeps happening, tell the Master Admin.</p>}</div>
      {onRetry && kind !== 'lock' && <button type="button" className="er-retry" onClick={onRetry}>↻ Try again</button>}
    </div>
  );
}

/** Status word -> chip colour, for every module. */
const TONES = {
  active: 'ok', approved: 'ok', delivered: 'ok', received: 'ok', done: 'ok', paid: 'ok', open: 'amber', pending: 'amber', placed: 'blue', ready: 'blue', ontheway: 'violet',
  submitted: 'amber', managerapproved: 'blue', upcoming: 'violet', inactive: 'off', rejected: 'bad', cancelled: 'bad', overdue: 'bad', chequepending: 'amber', draft: 'off'
};
export const toneOf = s => TONES[String(s || '').toLowerCase().replace(/[^a-z]/g, '')] || 'off';

/** GET from /api/field with a guard against answers that arrive out of order. */
export function useFld(path) {
  const [st, setSt] = useState({ data: null, err: '', loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (path == null) { setSt({ data: null, err: '', loading: false }); return undefined; }
    let stale = false;
    setSt(s => ({ ...s, loading: true }));
    fld.get(path).then(d => { if (!stale) setSt({ data: d, err: '', loading: false }); }).catch(e => { if (!stale) setSt({ data: null, err: e.message, loading: false }); });
    return () => { stale = true; };
  }, [path, n]);
  return { ...st, reload: useCallback(() => setN(x => x + 1), []) };
}

export function useDebounced(v, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

/** Pill tabs: items = [[key, label, count?]]. */
export function Tabs({ items, value, onChange }) {
  return (
    <div className="fd-filters">
      {items.map(([k, l, c]) => <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}{c != null && <small className="fd-cnt">{c}</small>}</button>)}
    </div>
  );
}

const SIZES = [10, 25, 50, 100];

/** Pager bar in the console's style: "1-10 of 177", a page-size picker and the page buttons. */
export function PagerBar({ total, page, pages, size, setPage, setSize }) {
  const from = total ? (page - 1) * size + 1 : 0, to = Math.min(total, page * size);
  const list = [...new Set([1, page - 1, page, page + 1, pages].filter(p => p >= 1 && p <= pages))].sort((a, b) => a - b);
  return (
    <div className="a-pager fd-pager">
      <span>{from}–{to} of {total}</span>
      <select value={size} onChange={e => setSize(+e.target.value)} aria-label="Rows per page">{SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}</select>
      {pages > 1 && <>
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
        {list.map(p => <button type="button" key={p} className={p === page ? 'on' : ''} onClick={() => setPage(p)}>{p}</button>)}
        <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
      </>}
    </div>
  );
}

/** Client-side paging of a list (10 rows by default): { items, start, bar } where bar is the pager to render under the list. */
export function usePaged(list, firstSize = 10) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(firstSize);
  const pages = Math.max(1, Math.ceil(list.length / size));
  useEffect(() => { setPage(1); }, [list.length, size]);
  const p = Math.min(page, pages);
  const items = useMemo(() => list.slice((p - 1) * size, p * size), [list, p, size]);
  return { items, start: (p - 1) * size, page: p, pages, bar: list.length > SIZES[0] ? <PagerBar total={list.length} page={p} pages={pages} size={size} setPage={setPage} setSize={setSize} /> : null };
}

/** A plain table on a CSS grid, 10 rows per page. rows = [{ key, cells: [node...], item }]; a row with full: true is the detail of the row before it and stays with it. */
const nodeText = n => (n == null || n === false ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(nodeText).join(' ') : nodeText(n.props?.children));

export function Grid({ cols, head, rows, onRow, empty = 'Nothing here yet.', search = true }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => { const g = []; for (const r of rows) { if (r.full && g.length) g[g.length - 1].push(r); else g.push([r]); } return g; }, [rows]);
  const found = useMemo(() => { const w = q.trim().toLowerCase(); return w ? groups.filter(g => nodeText(g[0].cells).toLowerCase().includes(w)) : groups; }, [groups, q]);
  const pg = usePaged(found);
  const shown = pg.items.flat();
  return (<>
    {search && rows.length > 0 && (
      <div className="fd-gs"><input className="a-input" type="search" placeholder="Search this table…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search this table" />{q.trim() && <small>{found.length} of {groups.length} match</small>}</div>
    )}
    <div className="fd-tbl" role="table">
      <div className="fd-th" role="row" style={{ gridTemplateColumns: cols }}>{head.map(h => <span key={h}>{h}</span>)}</div>
      {shown.map((r, i) => (
        <div key={r.key ?? i} role="row" className={'fd-tr' + (onRow && r.item ? ' click' : '') + (r.full ? ' full' : '')} style={{ gridTemplateColumns: r.full ? '1fr' : cols }} onClick={onRow && r.item ? () => onRow(r.item) : undefined}>
          {r.cells.map((c, j) => <span key={j}>{c}</span>)}
        </div>
      ))}
      {!found.length && <div className="a-empty">{rows.length ? 'No row matches your search.' : empty}</div>}
    </div>
    {pg.bar}
  </>);
}

export function downloadCsv(name, columns, rows) {
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = [columns.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** A labelled value inside detail drawers. */
export const Fact = ({ k, children }) => (children == null || children === '' ? null : <div className="fd-fact"><small>{k}</small><span>{children}</span></div>);

/** Placeholder lines that shimmer while a drawer or card loads its details. */
export const Skeleton = ({ rows = 6 }) => (
  <div className="sk" role="status" aria-label="Loading">
    <span className="sk-l w40" />
    {Array.from({ length: rows }, (_, i) => <span key={i} className={'sk-l w' + [90, 75, 100, 60, 85, 70][i % 6]} />)}
  </div>
);

/** PDF preview in a side panel: shows the document, with Download, Print and Open in a new tab. */
export function PdfPreview({ url, title, filename, onClose }) {
  const [href, setHref] = useState('');
  const [err, setErr] = useState('');
  const frame = useRef(null);
  useEffect(() => {
    let alive = true, made = '';
    setHref(''); setErr('');
    fetchBlobUrl(url).then(h => { made = h; if (alive) setHref(h); else URL.revokeObjectURL(h); }).catch(e => { if (alive) setErr(e.message); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [url]);
  const print = () => { try { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); } catch { window.open(href, '_blank'); } };
  return (
    <Modal side cls="pdf" kicker="PDF preview" title={title} onClose={onClose}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Close</button>
        <a className={'a-btn ghost' + (href ? '' : ' off')} href={href || undefined} target="_blank" rel="noreferrer">Open in a new tab</a>
        <button type="button" className="a-btn ghost" disabled={!href} onClick={print}>Print</button>
        <a className={'a-btn' + (href ? '' : ' off')} href={href || undefined} download={filename}>Download PDF</a></>}>
      {err && <div className="a-msg err">{err}</div>}
      {!href && !err && <Skeleton rows={10} />}
      {href && <iframe ref={frame} title={title} src={href + '#zoom=page-fit&navpanes=0'} className="fd-pdf" />}
    </Modal>
  );
}
/** The table / panel button for a document: the file icon and "PDF", in the red-tinted style. */
export const PdfButton = ({ onClick, title = 'Preview as PDF', label = 'PDF' }) => (
  <button type="button" className="a-mini fd-pdfbtn" title={title} aria-label={title} onClick={e => { e.stopPropagation(); onClick(); }}><PdfIcon /> <span>{label}</span></button>
);
