import { fmtMoney } from '../../adminApi.js';
import { Avatar } from './Avatar.jsx';
import { AREA } from './constants.js';

export function OrderHero({ o }) {
  const qty = o.items.reduce((t, i) => t + i.qty, 0);
  return (
    <div className="od-hero">
      <Avatar name={o.customer.name} cls="od-av" />
      <div className="od-who"><b>{o.customer.name}</b><span>{o.customer.phone} · {AREA[o.area]}</span>
        <div className="od-badges"><i className={'od-pay ' + (o.payStatus === 'Paid' ? 'ok' : 'due')}>{o.payStatus === 'Paid' ? '✓ Paid' : '● Unpaid'}</i><i>{o.payment}</i><i>{o.source && o.source !== 'Customer' ? 'By ' + o.source + (o.placedBy ? ' · ' + o.placedBy : '') : 'By customer (website)'}</i>{o.slot && <i>⏱ {o.slot}</i>}</div></div>
      <div className="od-amt"><small>Order total</small><b>{fmtMoney(o.total)}</b><span>{qty} item{qty === 1 ? '' : 's'}</span></div>
    </div>
  );
}
