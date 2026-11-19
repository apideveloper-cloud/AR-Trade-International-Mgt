import { useState } from 'react';
import { fmtMoney, useTable } from '../../adminApi.js';
import { Pager, Pill, Summary, Toolbar } from '../../ui.jsx';
import { AREA } from './constants.js';
import { OrderDrawer } from './OrderDrawer.jsx';
import { StatusDialog } from './StatusDialog.jsx';
import { DeliverySearch } from './DeliverySearch.jsx';
import { Avatar } from './Avatar.jsx';
import './salesInline.css';

/** Deliveries page: the packed/shipped queue with call, pick-up and delivered actions. */
export function Deliveries() {
  const t = useTable('/orders', { status: 'Packed,Shipped', queue: 1, q: '', product: '', area: '', pay: '', from: '', to: '', min: '', max: '', size: 25 });
  const [move, setMove] = useState(null); // { order, to }: the remarks dialog
  const [open, setOpen] = useState(null);
  const rows = t.data.rows;
  const counts = t.data.counts || {}, queue = t.data.queue || {};
  const reload = t.reload;
  const loading = t.loading && !rows.length;
  const filtered = ['q', 'product', 'area', 'pay', 'from', 'to', 'min', 'max'].some(k => t.params[k]);
  return (
    <>
      <Summary items={[
        ['Waiting for pickup', counts.Packed ?? 0, 'packed, ready to go', 'amber', 'box'],
        ['Out for delivery', counts.Shipped ?? 0, 'with a rider or courier', 'blue', 'truck'],
        ['COD to collect', fmtMoney(queue.cod), `${queue.codCount ?? 0} unpaid order${queue.codCount === 1 ? '' : 's'}`, 'red', 'money']
      ]} />
      <DeliverySearch lists={[t]} />
      <Toolbar t={t} search={false} />
      {t.error && <div className="a-msg err">{t.error}</div>}
      <section className="a-card dq">
        <div className="dq-hd">
          <div><b>Delivery queue</b><small>Pick up packed orders, then mark them delivered</small></div>
          <div className="a-chips">
            {[['Packed,Shipped', 'All', (counts.Packed ?? 0) + (counts.Shipped ?? 0)], ['Packed', 'Waiting for pickup', counts.Packed ?? 0], ['Shipped', 'Out for delivery', counts.Shipped ?? 0]].map(([k, l, n]) => <button key={k} type="button" className={'a-chip' + (t.params.status === k ? ' on' : '')} onClick={() => t.set({ status: k })}>{l} · {n}</button>)}
          </div>
        </div>
        {loading ? <span className="spin sinl-spin" /> : !rows.length ? (
          <div className="dq-empty"><span><svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></svg></span><b>{filtered ? 'No delivery matches your search' : 'Nothing to deliver right now'}</b><small>{filtered ? 'Change or reset the filters above to see more.' : 'Orders appear here once they are packed. Set an order to Packed from the Orders page.'}</small></div>
        ) : rows.map(o => (
          <div key={o.id} className="dq-row" onClick={() => setOpen(o.id)}>
            <Avatar name={o.customer.name} cls="dq-av" />
            <div className="dq-who"><b>{o.customer.name} <em className="mono">{o.id}</em></b><span>{o.address} · {AREA[o.area]}</span><small>{o.items.reduce((a, i) => a + i.qty, 0)} item(s){o.slot ? ' · ' + o.slot : ''}</small></div>
            <div className="dq-amt"><b>{fmtMoney(o.total)}</b><small className={o.payStatus === 'Paid' ? 'ok' : 'due'}>{o.payment} · {o.payStatus === 'Paid' ? 'Paid' : 'collect'}</small></div>
            <Pill s={o.status} />
            <div className="dq-act" onClick={e => e.stopPropagation()}>
              <a href={'tel:' + o.customer.phone} className="a-mini" title={o.customer.phone}>☎ Call</a>
              {o.status === 'Packed' && <button type="button" className="a-mini on" onClick={() => setMove({ order: o, to: 'Shipped' })}>Picked up</button>}
              {o.status === 'Shipped' && <button type="button" className="a-mini ok" onClick={() => setMove({ order: o, to: 'Delivered' })}>Mark delivered</button>}
            </div>
          </div>
        ))}
      </section>
      <Pager t={t} />
      {move && <StatusDialog id={move.order.id} from={move.order.status} to={move.to} onClose={() => setMove(null)} onSaved={() => { setMove(null); reload(); }} />}
      {open && <OrderDrawer id={open} riderOnly={false} canDelete={false} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}
