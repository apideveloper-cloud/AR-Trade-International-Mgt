import { fmtMoney } from '../../../adminApi.js';
import { dayTime, Av, Chip } from '../shared.jsx';
import { isPending, statusTone } from './ReviewModal.jsx';

/** The grid of expense claims or leave requests for one page (`pg` comes from usePaged); a click or Review/View opens the popup through `onOpen(it)`. */
export function ApprovalTable({ active, items, pg, onOpen }) {
  return (
    <div className="fd-tbl" role="table">
      <div className={'fd-th apt ' + active} role="row">
        <span>SL</span><span>Employee</span>
        {active === 'expenses' ? <><span>Title</span><span>Category</span><span>Amount</span><span>Date</span></> : <><span>Type</span><span>Dates</span><span>Days</span><span>Reason</span></>}
        <span>Status</span><span>Decision</span><span>Action</span>
      </div>
      {pg.items.map((it, i) => {
        const pending = isPending(active, it);
        return (
          <div key={it.id} role="row" className={'fd-tr apt click ' + active + (pending ? ' open' : '')} tabIndex={0} title="Click to view the details" onClick={() => onOpen(it)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onOpen(it))}>
            <span className="mono">{pg.start + i + 1}</span>
            <span className="fd-who"><Av name={it.employeeName || it.name} /><span><b>{it.employeeName || it.name}</b></span></span>
            {active === 'expenses'
              ? <><span>{it.title}</span><span>{it.category}</span><span><b>{fmtMoney(it.amount)}</b></span><span>{dayTime(it.date)}</span></>
              : <><span>{it.type}</span><span>{it.dates}</span><span>{it.days}</span><span className="cut" title={it.reason}>{it.reason}</span></>}
            <span><Chip tone={statusTone(pending, it)}>{pending ? 'Waiting' : it.status}</Chip></span>
            <span className="cut" title={(it.decidedBy ? 'By ' + it.decidedBy + '. ' : '') + (it.remarks || '')}>{pending ? '—' : <>{it.decidedBy && <small>{it.decidedBy}</small>}{it.remarks ? ' ' + it.remarks : ''}</>}</span>
            <span><button type="button" className={'a-mini' + (pending ? ' ok' : '')} onClick={e => { e.stopPropagation(); onOpen(it); }}>{pending ? 'Review' : 'View'}</button></span>
          </div>
        );
      })}
      {items && !pg.items.length && items.length > 0 && <div className="a-empty">No row matches your search.</div>}
    </div>
  );
}
