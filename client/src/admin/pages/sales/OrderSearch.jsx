import { useRef, useState } from 'react';
import { STATUSES, PAYMENTS } from './constants.js';
import '../../filterCard.css';

const SEARCH_KEYS = ['customer', 'product', 'pay', 'from', 'to', 'min', 'max'];
/** First and last day of the current month (Dhaka time): the Orders list opens on this month. */
export const monthRange = () => { const n = new Date(Date.now() + 6 * 3600e3); const y = n.getUTCFullYear(), m = n.getUTCMonth(), p = x => String(x).padStart(2, '0'); return { from: `${y}-${p(m + 1)}-01`, to: `${y}-${p(m + 1)}-${p(new Date(Date.UTC(y, m + 1, 0)).getUTCDate())}` }; };
const ymd = d => new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10);

/** Search by customer, product, date, status and order amount. Text boxes wait for a pause in typing; everything else applies at once. */
export function OrderSearch({ t }) {
  const p = t.params;
  const mr = monthRange();
  const [open, setOpen] = useState(true);
  const timer = useRef({});
  const text = (k, v) => { clearTimeout(timer.current[k]); timer.current[k] = setTimeout(() => t.set({ [k]: v }), 350); };
  const isDefault = p.from === mr.from && p.to === mr.to;
  const active = SEARCH_KEYS.filter(k => p[k] && !(isDefault && (k === 'from' || k === 'to'))).length + (p.status ? 1 : 0);
  const clear = () => t.set({ ...Object.fromEntries(SEARCH_KEYS.map(k => [k, ''])), status: '', ...mr });
  const now = new Date();
  const ranges = [['today', 'Today', ymd(now), ymd(now)], ['d7', 'Last 7 days', ymd(new Date(now.getTime() - 6 * 864e5)), ymd(now)], ['month', 'This month', mr.from, mr.to], ['d30', 'Last 30 days', ymd(new Date(now.getTime() - 29 * 864e5)), ymd(now)], ['all', 'All time', '', '']];
  const current = (ranges.find(r => r[2] === (p.from || '') && r[3] === (p.to || '')) || [])[0];
  const found = t.loading ? 'Searching…' : `${t.data.total} order${t.data.total === 1 ? '' : 's'} found`;
  const text_ = (k, label, icon, props = {}) => (
    <label className="os-f os-s">{label}
      <span className="os-in">{icon}<input key={k + (p[k] === '' ? '-e' : '')} defaultValue={p[k] || ''} onChange={e => text(k, e.target.value)} {...props} /></span>
    </label>
  );
  const svg = d => <svg viewBox="0 0 24 24">{d}</svg>;
  const stIc = svg(<><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.3 2.4 2.4 4.6-4.9" /></>);
  const payIc = svg(<><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>);
  const calIc = svg(<><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></>);
  const user = <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4" /><path d="M5 20c.7-3.6 3.6-5.6 7-5.6s6.3 2 7 5.6" /></svg>;
  const box = <svg viewBox="0 0 24 24"><path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></svg>;
  return (
    <section className="os-card">
      <div className="os-hd">
        <button type="button" className="os-tgl" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span className="os-ic"><svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg></span>
          <b>Filter orders</b>{active > 0 && <i className="os-badge">{active} active</i>}
        </button>
        <span className="os-seg" role="group" aria-label="Quick date range">
          {ranges.map(([k, label, from, to]) => <button key={k} type="button" className={current === k ? 'on' : ''} onClick={() => t.set({ from, to })}>{label}</button>)}
        </span>
        <span className="os-sp" />
        <em className="os-found">{found}</em>
        <button type="button" className="os-chev" onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse filters' : 'Expand filters'}>{open ? '▴' : '▾'}</button>
      </div>
      {open && (
        <div className="os-box">
          <div className="os-grid os-orders">
            <div className="cfull">{text_('customer', 'Customer', user, { placeholder: 'Name, phone, email or company' })}</div>
            <div className="cfirst">{text_('product', 'Product', box, { placeholder: 'Product name' })}</div>
            <i className="os-br" aria-hidden="true" />
            <label className="os-f c2">Status<span className="os-in os-sel">{stIc}<select value={p.status || ''} onChange={e => t.set({ status: e.target.value })}><option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></span></label>
            <label className="os-f c3">Payment<span className="os-in os-sel">{payIc}<select value={p.pay || ''} onChange={e => t.set({ pay: e.target.value })}><option value="">All payments</option>{PAYMENTS.map(m => <option key={m}>{m}</option>)}</select></span></label>
            <label className="os-f c3">Date from<span className="os-in os-dt">{calIc}<input type="date" value={p.from || ''} max={p.to || undefined} onChange={e => t.set({ from: e.target.value })} /></span></label>
            <label className="os-f c3">Date to<span className="os-in os-dt">{calIc}<input type="date" value={p.to || ''} min={p.from || undefined} onChange={e => t.set({ to: e.target.value })} /></span></label>
            <div className="os-f os-amt c4">Order amount
              <div><b>৳</b><input key={'min' + (p.min === '' ? '-e' : '')} type="number" min="0" placeholder="Min" defaultValue={p.min || ''} onChange={e => text('min', e.target.value)} aria-label="Minimum amount" /><span>to</span><input key={'max' + (p.max === '' ? '-e' : '')} type="number" min="0" placeholder="Max" defaultValue={p.max || ''} onChange={e => text('max', e.target.value)} aria-label="Maximum amount" /></div>
            </div>
            <div className="os-f c2 os-end">{(active > 0 || !isDefault) ? <button type="button" className="os-clr" onClick={clear}>↺ Reset</button> : <span className="os-hint">This month</span>}</div>
          </div>
        </div>
      )}
    </section>
  );
}
