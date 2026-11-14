import { useRef, useState } from 'react';
import { AREA, PAYMENTS } from './constants.js';
import '../../filterCard.css';

const KEYS = ['q', 'product', 'area', 'pay', 'from', 'to', 'min', 'max'];
const ymd = d => new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10);
const daysAgo = n => ymd(new Date(Date.now() - n * 864e5));
const svg = d => <svg viewBox="0 0 24 24">{d}</svg>;
const ICON = {
  search: svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>),
  box: svg(<><path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>),
  pin: svg(<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></>),
  card: svg(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>),
  cal: svg(<><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></>)
};

/** Search for the Deliveries queue: order / customer / phone, product, area, payment, order date and amount.
 *  The queue is two lists (packed, shipped); every change is applied to both. */
export function DeliverySearch({ lists }) {
  const p = lists[0].params;
  const [open, setOpen] = useState(true);
  const timer = useRef({});
  const apply = patch => lists.forEach(l => l.set(patch));
  const text = (k, v) => { clearTimeout(timer.current[k]); timer.current[k] = setTimeout(() => apply({ [k]: v }), 350); };
  const active = KEYS.filter(k => p[k]).length;
  const found = lists.some(l => l.loading) ? 'Searching…' : `${lists.reduce((t, l) => t + l.data.total, 0)} in this view`;
  const ranges = [['today', 'Today', ymd(new Date()), ymd(new Date())], ['d7', 'Last 7 days', daysAgo(6), ymd(new Date())], ['d30', 'Last 30 days', daysAgo(29), ymd(new Date())], ['all', 'All time', '', '']];
  const current = (ranges.find(r => r[2] === (p.from || '') && r[3] === (p.to || '')) || [])[0];
  const box = (k, label, icon, props = {}) => (
    <label className="os-f os-s">{label}
      <span className="os-in">{icon}<input key={k + (p[k] === '' ? '-e' : '')} defaultValue={p[k] || ''} onChange={e => text(k, e.target.value)} {...props} /></span>
    </label>
  );
  return (
    <section className="os-card">
      <div className="os-hd">
        <button type="button" className="os-tgl" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span className="os-ic"><svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg></span>
          <b>Search deliveries</b>{active > 0 && <i className="os-badge">{active} active</i>}
        </button>
        <span className="os-seg" role="group" aria-label="Order date">
          {ranges.map(([k, label, from, to]) => <button key={k} type="button" className={current === k ? 'on' : ''} onClick={() => apply({ from, to })}>{label}</button>)}
        </span>
        <span className="os-sp" />
        <em className="os-found">{found}</em>
        <button type="button" className="os-chev" onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse search' : 'Expand search'}>{open ? '▴' : '▾'}</button>
      </div>
      {open && (
        <div className="os-box">
          <div className="os-grid">
            <div className="c4">{box('q', 'Order, customer or phone', ICON.search, { placeholder: 'WP-21158, name or 01…' })}</div>
            <div className="c3">{box('product', 'Product', ICON.box, { placeholder: 'Product name' })}</div>
            <label className="os-f c2">Area<span className="os-in os-sel">{ICON.pin}<select value={p.area || ''} onChange={e => apply({ area: e.target.value })}><option value="">All areas</option>{Object.entries(AREA).filter(([k]) => k !== 'suburb' /* the old suburb zone no longer exists at checkout */).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></span></label>
            <label className="os-f c3">Payment<span className="os-in os-sel">{ICON.card}<select value={p.pay || ''} onChange={e => apply({ pay: e.target.value })}><option value="">All payments</option>{PAYMENTS.map(m => <option key={m}>{m}</option>)}</select></span></label>
            <label className="os-f c3">Order date from<span className="os-in os-dt">{ICON.cal}<input type="date" value={p.from || ''} max={p.to || undefined} onChange={e => apply({ from: e.target.value })} /></span></label>
            <label className="os-f c3">Order date to<span className="os-in os-dt">{ICON.cal}<input type="date" value={p.to || ''} min={p.from || undefined} onChange={e => apply({ to: e.target.value })} /></span></label>
            <div className="os-f os-amt c4">Order amount
              <div><b>৳</b><input key={'min' + (p.min === '' ? '-e' : '')} type="number" min="0" placeholder="Min" defaultValue={p.min || ''} onChange={e => text('min', e.target.value)} aria-label="Minimum amount" /><span>to</span><input key={'max' + (p.max === '' ? '-e' : '')} type="number" min="0" placeholder="Max" defaultValue={p.max || ''} onChange={e => text('max', e.target.value)} aria-label="Maximum amount" /></div>
            </div>
            <div className="os-f c2 os-end">{active > 0 ? <button type="button" className="os-clr" onClick={() => apply(Object.fromEntries(KEYS.map(k => [k, ''])))}>↺ Reset</button> : <span className="os-hint">No filters</span>}</div>
          </div>
        </div>
      )}
    </section>
  );
}
