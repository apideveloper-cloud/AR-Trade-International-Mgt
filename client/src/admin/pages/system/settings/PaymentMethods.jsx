import { PAY } from '../../../../data.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/system.js';

/** Grid of payment-method tickboxes; `payments[k] !== false` means active. */
export function PaymentMethods({ payments, onToggle }) {
  const tr = useT();
  return (
    <>
      <div className="card-hd"><span style={{ fontSize: 13, fontWeight: 800 }}>{tr('Payment methods')}</span><span className="muted" style={{ fontSize: 12 }}>{tr('Tick the ones customers can choose at checkout')}</span></div>
      <div className="pm-grid">
        {PAY.map(([k, name, note, [txt, size, bg, img]]) => {
          const on = payments?.[k] !== false;
          return (
            <label key={k} className={'pm' + (on ? ' on' : '')}>
              <input type="checkbox" checked={on} onChange={e => onToggle(k, e.target.checked)} />
              <span className="pm-logo" style={img ? undefined : { background: bg, color: '#fff', fontSize: size }}>{img ? <img src={img} alt="" /> : txt}</span>
              <span className="pm-t"><b>{tr(name)}</b><small>{tr(note)}</small></span>
              <span className="pm-st">{on ? tr('Active') : tr('Inactive')}</span>
            </label>
          );
        })}
      </div>
    </>
  );
}
