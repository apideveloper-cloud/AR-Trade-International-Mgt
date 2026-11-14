import { fmtMoney } from '../../adminApi.js';
import { hueOf } from '../../ui.jsx';
import { AREA } from './constants.js';

export function OrderHero({ o }) {
  const qty = o.items.reduce((t, i) => t + i.qty, 0);
  return (
    <div className="od-hero">
      <span className="od-av" style={{ '--h': hueOf(o.customer.name) }}>{String(o.customer.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
      <div className="od-who"><b>{o.customer.name}</b><span>{o.customer.phone} · {AREA[o.area]}</span>
        <div className="od-badges"><i className={'od-pay ' + (o.payStatus === 'Paid' ? 'ok' : 'due')}>{o.payStatus === 'Paid' ? '✓ Paid' : '● Unpaid'}</i><i>{o.payment}</i><i>{o.source && o.source !== 'Customer' ? 'By ' + o.source + (o.placedBy ? ' · ' + o.placedBy : '') : 'By customer (website)'}</i>{o.slot && <i>⏱ {o.slot}</i>}</div></div>
      <div className="od-amt"><small>Order total</small><b>{fmtMoney(o.total)}</b><span>{qty} item{qty === 1 ? '' : 's'}</span></div>
    </div>
  );
}
