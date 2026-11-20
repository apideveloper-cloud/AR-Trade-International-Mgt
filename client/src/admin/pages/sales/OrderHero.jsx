import { fmtMoney } from '../../adminApi.js';
import { Avatar } from './Avatar.jsx';
import { AREA } from './constants.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';

export function OrderHero({ o }) {
  const tr = useT();
  const qty = o.items.reduce((t, i) => t + i.qty, 0);
  return (
    <div className="od-hero">
      <Avatar name={o.customer.name} cls="od-av" />
      <div className="od-who"><b>{o.customer.name}</b><span>{o.customer.phone} · {tr(AREA[o.area])}</span>
        <div className="od-badges"><i className={'od-pay ' + (o.payStatus === 'Paid' ? 'ok' : 'due')}>{o.payStatus === 'Paid' ? tr('✓ Paid') : tr('● Unpaid')}</i><i>{tr(o.payment)}</i><i>{o.source && o.source !== 'Customer' ? tr('By {who}', { who: tr(o.source) }) + (o.placedBy ? ' · ' + o.placedBy : '') : tr('By customer (website)')}</i>{o.slot && <i>⏱ {o.slot}</i>}</div></div>
      <div className="od-amt"><small>{tr('Order total')}</small><b>{fmtMoney(o.total)}</b><span>{qty === 1 ? tr('{n} item', { n: 1 }) : tr('{n} items', { n: qty })}</span></div>
    </div>
  );
}
