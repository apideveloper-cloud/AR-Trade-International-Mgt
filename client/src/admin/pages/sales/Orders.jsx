import { useState } from 'react';
import { can, dateF, fmtMoney, slNo, useTable, STATUS_COLORS } from '../../adminApi.js';
import { Empty, Pager, Pill, Summary, Toolbar } from '../../ui.jsx';
import { STATUSES, AREA } from './constants.js';
import { OrderDrawer } from './OrderDrawer.jsx';
import { OrderCreate } from './OrderCreate.jsx';
import { SOURCE_TONE } from './sources.js';
import { OrderSearch, monthRange } from './OrderSearch.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';
import './salesInline.css';

/** Orders page: summary cards, search, status tabs with counts, the order grid, and the create/detail drawers. */
export function Orders({ staff }) {
  const tr = useT();
  const t = useTable('/orders', { status: '', source: '', pay: '', customer: '', product: '', ...monthRange(), min: '', max: '', summary: 1 });
  const [open, setOpen] = useState(null); const [create, setCreate] = useState(false);
  const counts = t.data.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const rider = staff.role === 'Delivery rider';
  return (
    <>
      <div className="a-chips oc-bar">
        {can(staff, 'orders.create') && <button type="button" className="a-btn sm grad oc-new" onClick={() => setCreate(true)}>＋ {tr('New order')}</button>}
      </div>
      {t.data.summary && (() => {
        const m = t.data.summary;
        return <Summary items={[
          [tr('Orders'), m.total, tr('{n} cancelled', { n: m.cancelled }), 'blue', 'cart'],
          [tr('Revenue'), fmtMoney(m.revenue), tr('Avg {n} per order', { n: fmtMoney(m.avg) }), 'green', 'money'],
          [tr('Today'), m.today, tr('{n} today', { n: fmtMoney(m.todayRevenue) }), 'violet', 'clock'],
          [tr('Open orders'), m.open, tr('{n} to deliver', { n: fmtMoney(m.openValue) }), 'amber', 'truck'],
          [tr('To collect'), fmtMoney(m.unpaid), tr('Unpaid, not cancelled'), 'red', 'alert']
        ]} />;
      })()}
      <OrderSearch t={t} />
      <Toolbar t={t} />
      <div className="oc-gridwrap">
      <div className="oc-tabs" role="tablist" aria-label={tr('Order status')}
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
              {v && <i className="oc-dot" aria-hidden="true" />}{tr(label)}<b>{n}</b>
            </button>
          );
        })}
      </div>
      <div className="a-table ord" role="tabpanel" style={{ opacity: t.loading ? .6 : 1 }}>
        <div className="sinl-min804">
          <div className="head sinl-ordcols"><span>{tr('SL')}</span><span>{tr('Order')}</span><span>{tr('Customer')}</span><span>{tr('Date')}</span><span>{tr('Payment')}</span><span>{tr('Status')}</span><span className="sinl-right">{tr('Total')}</span></div>
          {t.data.rows.map((o, i) => (
            <button key={o.id} className="row sinl-ordcols" onClick={() => setOpen(o.id)}>
              <span className="sl">{slNo(t, i)}</span>
              <b>{o.id}</b>
              <span className="sinl-stack"><b className="sinl-name">{o.customer.name}</b><span className="sinl-sub">{o.customer.phone} · {tr(AREA[o.area])}{o.source && o.source !== 'Customer' && <i className={'oc-tag ' + (SOURCE_TONE[o.source] || '')}>{tr(o.source)}</i>}</span></span>
              <span className="sinl-muted">{dateF(o.date)}</span><span>{tr(o.payment)}{o.payStatus === 'Paid' ? ' ✓' : ''}</span><Pill s={o.status} />
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
