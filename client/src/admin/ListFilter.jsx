import { Fragment, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/lang.jsx';
import './i18n/dict/common.js';
import './filterCard.css';

// One filter card for every list: search box, any number of drop-downs, a date period (quick ranges + from / to) and an optional amount range.
// It drives a server-paged table from useTable: every change is sent to the server and the table goes back to page 1.
//
//   <ListFilter t={table} noun="order" search={{ placeholder: 'Name, phone…' }}
//     selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['New', 'Done'] }]}
//     range={{ label: 'Created' }} amount={{ label: 'Amount' }} />
//
// Column widths are out of 12: search.span (default c4), a select's own span (default c3), resetSpan (default c2). To keep a card on one row, make them add up to 12 or less.
// plural is for nouns that do not take a plain s (noun="delivery" plural="deliveries").
// range.def is the period the list opens on: 'all' (default), 'today', 'd7', 'month' or 'd30'. Reset returns to it.

/** Dhaka calendar day (YYYY-MM-DD) of a date. */
export const ymd = d => new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10);
export const daysAgo = n => ymd(new Date(Date.now() - n * 864e5));
/** The five quick periods, in Dhaka time. */
export function periods() {
  const now = new Date(), t = ymd(now);
  const [y, m] = t.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate(), p = x => String(x).padStart(2, '0');
  return [['today', 'Today', t, t], ['d7', 'Last 7 days', daysAgo(6), t], ['month', 'This month', `${y}-${p(m)}-01`, `${y}-${p(m)}-${p(last)}`], ['d30', 'Last 30 days', daysAgo(29), t], ['all', 'All time', '', '']];
}
/** { from, to } for a period key, to seed useTable with. */
export const periodOf = key => { const r = periods().find(x => x[0] === key); return r ? { from: r[2], to: r[3] } : { from: '', to: '' }; };

const svg = d => <svg viewBox="0 0 24 24">{d}</svg>;
const ICONS = {
  search: svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>),
  status: svg(<><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.3 2.4 2.4 4.6-4.9" /></>),
  card: svg(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>),
  box: svg(<><path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>),
  user: svg(<><circle cx="12" cy="8" r="3.4" /><path d="M5 20c.7-3.6 3.6-5.6 7-5.6s6.3 2 7 5.6" /></>),
  pin: svg(<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></>),
  tag: svg(<><path d="M3.5 12.5V4.5h8l9 9-8 8-9-9z" /><circle cx="8" cy="9" r="1.4" /></>),
  grid: svg(<><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>),
  cal: svg(<><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></>)
};
const SPAN = { search: 'c4', select: 'c3', date: 'c3', amount: 'c4', reset: 'c2' };

export function ListFilter({ t, title = 'Search & filter', noun = 'record', plural, search = { placeholder: 'Search…' }, selects = [], range, amount, resetSpan, children }) {
  const tr = useT();
  const p = t.params;
  // With four or more other filters, the search box and the first filter share the first row and the rest sit on the row below.
  const searchRow = !!search && !search.span && selects.length > 0 && selects.length + (range ? 2 : 0) + (amount ? 1 : 0) >= 4;
  const [open, setOpen] = useState(true);
  const timers = useRef({});
  const stopTyping = () => Object.values(timers.current).forEach(clearTimeout);
  useEffect(() => stopTyping, []); // eslint-disable-line react-hooks/exhaustive-deps
  const defKey = range?.def || 'all';
  const dflt = useRef(range ? periodOf(defKey) : {});
  const textKeys = [search && 'q', amount && 'min', amount && 'max'].filter(Boolean);
  const keys = [...textKeys, ...selects.map(s => s.key), ...(range ? ['from', 'to'] : [])];
  const typed = (k, v) => { clearTimeout(timers.current[k]); timers.current[k] = setTimeout(() => t.set({ [k]: v }), 350); };
  const isDefaultRange = !range || (p.from || '') === dflt.current.from && (p.to || '') === dflt.current.to;
  const active = keys.filter(k => p[k] && !(range && (k === 'from' || k === 'to') && isDefaultRange)).length;
  const reset = () => { stopTyping(); t.set({ ...Object.fromEntries(keys.map(k => [k, ''])), ...(range ? dflt.current : {}) }); };
  const quick = range ? periods() : [];
  const current = (quick.find(r => r[2] === (p.from || '') && r[3] === (p.to || '')) || [])[0];
  const found = t.loading ? tr('Searching…') : tr('{n} {what} found', { n: t.data.total, what: tr(t.data.total === 1 ? noun : plural || noun + 's') });
  const input = (k, placeholder, icon, type = 'text') => (
    <span className="os-in">{icon}<input key={k + (p[k] === '' ? '-e' : '')} type={type} defaultValue={p[k] || ''} placeholder={placeholder ? tr(placeholder) : placeholder} onChange={e => typed(k, e.target.value)} /></span>
  );
  return (
    <section className="os-card">
      <div className="os-hd">
        <button type="button" className="os-tgl" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span className="os-ic"><svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg></span>
          <b>{tr(title)}</b>{active > 0 && <i className="os-badge">{tr('{n} active', { n: active })}</i>}
        </button>
        {range && (
          <span className="os-seg" role="group" aria-label={tr('{label} period', { label: tr(range.label || 'Date') })}>
            {quick.map(([k, label, from, to]) => <button key={k} type="button" className={current === k ? 'on' : ''} onClick={() => t.set({ from, to })}>{tr(label)}</button>)}
          </span>
        )}
        <span className="os-sp" />
        <em className="os-found">{found}</em>
        <button type="button" className="os-chev" onClick={() => setOpen(o => !o)} aria-label={open ? tr('Collapse filters') : tr('Expand filters')}>{open ? '▴' : '▾'}</button>
      </div>
      {open && (
        <div className="os-box">
          <div className="os-grid">
            {search && <label className={'os-f os-s ' + (search.span || (searchRow ? 'cfull' : SPAN.search))}>{tr(search.label || 'Search')}{input('q', search.placeholder, ICONS.search)}</label>}
            {selects.map((s, i) => (
              <Fragment key={s.key}>
              <label className={'os-f ' + (s.span || SPAN.select) + (searchRow && i === 0 ? ' cfirst' : '')}>{tr(s.label)}
                <span className="os-in os-sel">{ICONS[s.icon || 'grid']}
                  <select value={p[s.key] || ''} onChange={e => t.set({ [s.key]: e.target.value })}>
                    <option value="">{tr(s.all || 'All')}</option>
                    {s.options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{tr(o.t ?? o)}</option>)}
                  </select>
                </span>
              </label>
              {searchRow && i === 0 && <i className="os-br" aria-hidden="true" />}
              </Fragment>
            ))}
            {range && <>
              <label className={'os-f ' + SPAN.date}>{tr('{label} from', { label: tr(range.label || 'Date') })}<span className="os-in os-dt">{ICONS.cal}<input type="date" value={p.from || ''} max={p.to || undefined} onChange={e => t.set({ from: e.target.value })} /></span></label>
              <label className={'os-f ' + SPAN.date}>{tr('{label} to', { label: tr(range.label || 'Date') })}<span className="os-in os-dt">{ICONS.cal}<input type="date" value={p.to || ''} min={p.from || undefined} onChange={e => t.set({ to: e.target.value })} /></span></label>
            </>}
            {amount && (
              <div className={'os-f os-amt ' + SPAN.amount}>{tr(amount.label || 'Amount')}
                <div><b>৳</b>
                  <input key={'min' + (p.min === '' ? '-e' : '')} type="number" min="0" placeholder={tr('Min')} defaultValue={p.min || ''} onChange={e => typed('min', e.target.value)} aria-label={tr('Minimum')} />
                  <span>{tr('to')}</span>
                  <input key={'max' + (p.max === '' ? '-e' : '')} type="number" min="0" placeholder={tr('Max')} defaultValue={p.max || ''} onChange={e => typed('max', e.target.value)} aria-label={tr('Maximum')} />
                </div>
              </div>
            )}
            {children}
            <div className={'os-f os-end ' + (resetSpan || SPAN.reset)}>{active > 0 || !isDefaultRange ? <button type="button" className="os-clr" onClick={reset}>↺ {tr('Reset')}</button> : <span className="os-hint">{tr('No filters')}</span>}</div>
          </div>
        </div>
      )}
    </section>
  );
}
