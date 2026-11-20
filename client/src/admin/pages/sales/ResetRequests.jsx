import { dateF } from '../../adminApi.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';
import './salesInline.css';

/** Card listing customers who asked for a password reset, with create-link and dismiss actions. */
export function ResetRequests({ reqs, onCreate, onDismiss }) {
  const tr = useT();
  return (
    <div className="a-card sinl-reqcard">
      <h3>🔑 {tr('Password reset requests ({n})', { n: reqs.length })}</h3>
      {reqs.map(r => (
        <div key={r.id} className="sinl-reqrow">
          <span className="sinl-reqwho"><b>{r.name}</b> · {r.phone} · {r.email}<br /><small className="sinl-asked">{tr('asked {date}', { date: dateF(r.created) })}</small></span>
          <button className="a-btn sm" onClick={() => onCreate({ userId: r.userId, name: r.name, phone: r.phone })}>{tr('Create reset link')}</button>
          <button className="a-btn ghost sm" onClick={() => onDismiss(r.id)}>{tr('Dismiss')}</button>
        </div>
      ))}
    </div>
  );
}
