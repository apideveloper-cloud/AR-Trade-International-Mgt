import { fmtMoney } from '../../../adminApi.js';
import { dayTime, Av, Chip } from '../shared.jsx';
import { isPending, statusTone } from './ReviewModal.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/field.js';

/** The grid of expense claims or leave requests for one page (`pg` comes from usePaged); a click or Review/View opens the popup through `onOpen(it)`. */
export function ApprovalTable({ active, items, pg, onOpen }) {
  const tr = useT();
  return (
    <div className="fd-tbl" role="table">
      <div className={'fd-th apt ' + active} role="row">
        <span>{tr('SL')}</span><span>{tr('Employee')}</span>
        {active === 'expenses' ? <><span>{tr('Title')}</span><span>{tr('Category')}</span><span>{tr('Amount')}</span><span>{tr('Date')}</span></> : <><span>{tr('Type')}</span><span>{tr('Dates')}</span><span>{tr('Days')}</span><span>{tr('Reason')}</span></>}
        <span>{tr('Status')}</span><span>{tr('Decision')}</span><span>{tr('Action')}</span>
      </div>
      {pg.items.map((it, i) => {
        const pending = isPending(active, it);
        return (
          <div key={it.id} role="row" className={'fd-tr apt click ' + active + (pending ? ' open' : '')} tabIndex={0} title={tr('Click to view the details')} onClick={() => onOpen(it)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onOpen(it))}>
            <span className="mono">{pg.start + i + 1}</span>
            <span className="fd-who"><Av name={it.employeeName || it.name} /><span><b>{it.employeeName || it.name}</b></span></span>
            {active === 'expenses'
              ? <><span>{it.title}</span><span>{tr(it.category)}</span><span><b>{fmtMoney(it.amount)}</b></span><span>{dayTime(it.date)}</span></>
              : <><span>{tr(it.type)}</span><span>{it.dates}</span><span>{it.days}</span><span className="cut" title={it.reason}>{it.reason}</span></>}
            <span><Chip tone={statusTone(pending, it)}>{pending ? tr('Waiting') : tr(it.status)}</Chip></span>
            <span className="cut" title={(it.decidedBy ? tr('By {name}.', { name: it.decidedBy }) + ' ' : '') + (it.remarks || '')}>{pending ? '—' : <>{it.decidedBy && <small>{it.decidedBy}</small>}{it.remarks ? ' ' + it.remarks : ''}</>}</span>
            <span><button type="button" className={'a-mini' + (pending ? ' ok' : '')} onClick={e => { e.stopPropagation(); onOpen(it); }}>{pending ? tr('Review') : tr('View')}</button></span>
          </div>
        );
      })}
      {items && !pg.items.length && items.length > 0 && <div className="a-empty">{tr('No row matches your search.')}</div>}
    </div>
  );
}
