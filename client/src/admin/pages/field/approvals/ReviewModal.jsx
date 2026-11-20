import { fmtMoney, viewFieldFile } from '../../../adminApi.js';
import { Modal } from '../../../ui.jsx';
import { Facts } from '../../../fieldKit.jsx';
import { dayTime, Av, Chip } from '../shared.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/field.js';

/** A claim waits for a decision while it is "pending" (expenses) or "open" (leave). */
export const isPending = (kind, it) => (kind === 'expenses' ? it.status === 'pending' : it.status === 'open');
/** Chip tone for a claim / leave request. */
export const statusTone = (pending, it) => (pending ? 'amber' : it.status === 'approved' ? 'ok' : it.status === 'rejected' ? 'bad' : 'off');

/** Review popup for one expense claim or leave request. `rv` is { kind, it, text, err }; `setRv` edits it; `decide(kind, id, status, remarks)` saves. */
export function ReviewModal({ rv, setRv, busy, decide }) {
  const tr = useT();
  const { kind, it } = rv;
  const exp = kind === 'expenses';
  const pending = isPending(kind, it);
  const who = it.employeeName || it.name;
  const working = busy === kind + it.id;
  return (
    <Modal kicker={exp ? tr('Expense claim') : tr('Leave request')} title={who} narrow cls="ap-modal" onClose={() => !working && setRv(null)}
      footer={pending
        ? <><button type="button" className="a-btn ap-rej" disabled={!!busy || !rv.text.trim()} title={rv.text.trim() ? tr('Reject with these remarks') : tr('Write the remarks first: the person will see why')} onClick={() => decide(kind, it.id, 'rejected', rv.text.trim())}>{working ? '…' : tr('Reject')}</button><button type="button" className="a-btn ap-ok" disabled={!!busy} onClick={() => decide(kind, it.id, 'approved', rv.text.trim())}>{working ? '…' : tr('Approve')}</button></>
        : <button type="button" className="a-btn" onClick={() => setRv(null)}>{tr('Close')}</button>}>
      <div className="att-hd"><Av name={who} /><div><b>{who}</b><small>{exp ? tr('Submitted {date}', { date: dayTime(it.date) }) : tr('Requested leave')}</small></div><Chip tone={statusTone(pending, it)}>{pending ? tr('Waiting') : tr(it.status)}</Chip></div>
      {exp ? (
        <Facts items={[[tr('Amount'), fmtMoney(it.amount)], [tr('Category'), tr(it.category)], [tr('What for'), it.title, true], it.voucher && [tr('Voucher'), <button key="v" type="button" className="fd-lnk" onClick={() => viewFieldFile(it.voucher).catch(e => setRv(r => ({ ...r, err: e.message })))}>{tr('View voucher')}</button>, true]]} />
      ) : (
        <Facts items={[[tr('Type'), tr(it.type)], [tr('Days'), it.days], [tr('Dates'), it.dates, true], [tr('Reason'), it.reason || '—', true]]} />
      )}
      {pending ? (
        <label className="ap-rm">{tr('Remarks')} <em>({tr('required to reject, optional to approve')})</em>
          <textarea className="a-input" rows={3} placeholder={tr('Write the remarks. The person will see them in the mobile app.')} value={rv.text} onChange={e => setRv({ ...rv, text: e.target.value })} autoFocus />
        </label>
      ) : (it.decidedBy || it.remarks) && <div className="fd-apd">{it.decidedBy && <>{tr('Decided by {name}.', { name: it.decidedBy })} </>}{it.remarks}</div>}
      {rv.err && <p className="bk-bad ap-err">{tr(rv.err)}</p>}
    </Modal>
  );
}
