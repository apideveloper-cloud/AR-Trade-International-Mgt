import { useState } from 'react';
import { can, dateF, fmtMoney, slNo, useTable, STATUS_COLORS } from '../../adminApi.js';
import { Empty, Pager, Pill, Summary, Toolbar } from '../../ui.jsx';
import { STATUSES, AREA } from './constants.js';
import { OrderDrawer } from './OrderDrawer.jsx';
import { OrderCreate } from './OrderCreate.jsx';
import { SOURCE_TONE } from './sources.js';
import { OrderSearch, monthRange } from './OrderSearch.jsx';
import './salesInline.css';

/** Orders page: summary cards, search, status tabs with counts, the order grid, and the create/detail drawers. */
export function Orders({ staff }) {
  const t = useTable('/orders', { status: '', source: '', pay: '', customer: '', product: '', ...monthRange(), min: '', max: '', summary: 1 });
  const [open, setOpen] = useState(null); const [create, setCreate] = useState(false);
  const counts = t.data.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const rider = staff.role === 'Delivery rider';
  return (
    <>
      <div className="a-chips oc-bar">
        {can(staff, 'orders.create') && <button type="button" className="a-btn sm grad oc-new" onClick={() => setCreate(true)}>＋ New order</button>}
      </div>
      {t.data.summary && (() => {
        const m = t.data.summary;
        return <Summary items={[
          ['Orders', m.total, m.cancelled + ' cancelled', 'blue', 'cart'],
          ['Revenue', fmtMoney(m.revenue), 'Avg ' + fmtMoney(m.avg) + ' per order', 'green', 'money'],
          ['Today', m.today, fmtMoney(m.todayRevenue) + ' today', 'violet', 'clock'],
          ['Open orders', m.open, fmtMoney(m.openValue) + ' to deliver', 'amber', 'truck'],
          ['To collect', fmtMoney(m.unpaid), 'Unpaid, not cancelled', 'red', 'alert']
        ]} />;
      })()}
      <OrderSearch t={t} />
      <Toolbar t={t} />
      <div className="oc-gridwrap">
      <div className="oc-tabs" role="tablist" aria-label="Order status"
        onKeyDown={e => { // left / right arrows move between the tabs
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const tabs = [...e.currentTarget.querySelectorAll('[role=tab]')], i = tabs.indexOf(document.activeElement);
          if (i < 0) return;
          e.preventDefault();
          const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          n.focus(); n.click();
        }}>
        {[['', 'All', all], ...STATUSES.map(s => [s, s, counts[s] || 0])].map(([v, label, n]) => {
          const on = (t.params.status || '') === v;
          return (
            <button key={v || 'all'} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className={'oc-tab' + (on ? ' on' : '')}
              style={{ '--c': v ? STATUS_COLORS[v][1] : '#16181d' }} onClick={() => t.set({ status: v })}>
              {v && <i className="oc-dot" aria-hidden="true" />}{label}<b>{n}</b>
            </button>
          );
        })}
      </div>
      <div className="a-table ord" role="tabpanel" style={{ opacity: t.loading ? .6 : 1 }}>
        <div className="sinl-min804">
          <div className="head sinl-ordcols"><span>SL</span><span>Order</span><span>Customer</span><span>Date</span><span>Payment</span><span>Status</span><span className="sinl-right">Total</span></div>
          {t.data.rows.map((o, i) => (
            <button key={o.id} className="row sinl-ordcols" onClick={() => setOpen(o.id)}>
              <span className="sl">{slNo(t, i)}</span>
              <b>{o.id}</b>
              <span className="sinl-stack"><b className="sinl-name">{o.customer.name}</b><span className="sinl-sub">{o.customer.phone} · {AREA[o.area]}{o.source && o.source !== 'Customer' && <i className={'oc-tag ' + (SOURCE_TONE[o.source] || '')}>{o.source}</i>}</span></span>
              <span className="sinl-muted">{dateF(o.date)}</span><span>{o.payment}{o.payStatus === 'Paid' ? ' ✓' : ''}</span><Pill s={o.status} />
              <b className="sinl-right">{fmtMoney(o.total)}</b>
            </button>
          ))}
        </div>
      </div>
      </div>
      <Empty t={t} /><Pager t={t} />
      {create && <OrderCreate staff={staff} onClose={() => setCreate(false)} onCreated={o => { t.reload(); setOpen(o.id); }} />}
      {open && <OrderDrawer id={open} riderOnly={rider} canDelete={!rider} onClose={() => setOpen(null)} onChanged={t.reload} />}
    </>
  );
}
