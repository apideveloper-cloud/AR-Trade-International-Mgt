import { useState } from 'react';
import { Pill } from '../../../ui.jsx';
import { trServer } from '../seoModel.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';
import './activity.css';

const ACTIONS = { save: ['Edited', 'Confirmed'], slug: ['Slug changed', 'Packed'], bulk: ['Bulk', 'Shipped'], csv: ['CSV import', 'New'], settings: ['Settings', 'Approved'], revert: ['Reverted', 'none'] };
const clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

/** Same as ago(), in the admin language. */
export function agoTr(iso, tr) {
  const m = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (!(m >= 1)) return tr('just now');
  if (m < 60) return tr('{n} min ago', { n: m });
  if (m < 1440) return tr('{n} h ago', { n: Math.round(m / 60) });
  return tr('{n} d ago', { n: Math.round(m / 1440) });
}

export function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (!(m >= 1)) return 'just now';
  if (m < 60) return m + ' min ago';
  if (m < 1440) return Math.round(m / 60) + ' h ago';
  return Math.round(m / 1440) + ' d ago';
}

const exact = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isMeta = f => /meta.?(title|description)|^(title|description)$/i.test(f);
const empty = v => v == null || v === '';
const show = (field, v) => (empty(v) ? (isMeta(field) ? '(template)' : '(empty)') : typeof v === 'object' ? JSON.stringify(v) : String(v));

function Val({ field, v }) {
  const tr = useT();
  const s = show(field, v);
  const sh = s === '(template)' || s === '(empty)' ? tr(s) : s;
  return <span className={'adac-val' + (empty(v) ? ' none' : '')} title={sh}>{clip(sh, 120)}</span>;
}

/** One history entry: time, who, action pill, summary, expandable changed fields, Revert. Props: e (row), name (node, optional), onRevert, busy. */
export function EntryRow({ e, name, onRevert, busy }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [label, tone] = ACTIONS[e.action] || [e.action, 'none'];
  const n = (e.fields || []).length;
  return (
    <div className={'adac-row' + (e.reverted ? ' reverted' : '')}>
      <div className="adac-top">
        <span className="adac-time" title={exact(e.at)}>{agoTr(e.at, tr)}</span>
        <span className="adac-who">{e.who || tr('System')}</span>
        <Pill s={tone} label={label} />
        {e.reverted && <Pill s="none" label="Reverted" />}
        {name && <span className="adac-name">{name}</span>}
      </div>
      {e.summary && <div className="adac-sum">{trServer(tr, e.summary)}</div>}
      <div className="adac-acts">
        {n > 0 && <button type="button" className="a-mini" aria-expanded={open} onClick={() => setOpen(o => !o)}>{n === 1 ? tr('1 field changed') : tr('{n} fields changed', { n })} {open ? '▴' : '▾'}</button>}
        {e.canRevert && !e.reverted && onRevert && <button type="button" className="a-mini bad" disabled={busy} onClick={() => onRevert(e)}>{busy ? tr('Reverting…') : tr('Revert')}</button>}
      </div>
      {open && (
        <ul className="adac-fields">
          {e.fields.map((f, i) => <li key={f.field + i}><b>{tr(f.field)}</b><Val field={f.field} v={f.from} /><span className="adac-arrow">→</span><Val field={f.field} v={f.to} /></li>)}
        </ul>
      )}
    </div>
  );
}
