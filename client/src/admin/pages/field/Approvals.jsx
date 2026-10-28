import { useCallback, useEffect, useState } from 'react';
import { fld, fmtMoney, viewFieldFile } from '../../adminApi.js';
import { Modal, Summary } from '../../ui.jsx';
import { Facts, Notice, usePaged } from '../../fieldKit.jsx';
import { dayTime, Av, Chip } from './shared.jsx';
import '../../field.css';

export function FieldApprovals({ staff }) {
  const [sum, setSum] = useState(null);
  const [tab, setTab] = useState('expenses');
  const [exp, setExp] = useState(null);
  const [lv, setLv] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [rv, setRv] = useState(null); // the claim / leave request open in the review popup: { kind, it, text }
  const load = useCallback(async () => {
    try {
      const s = await fld.get('/approvals/summary');
      setSum(s);
      if (s.kinds.includes('expenses')) setExp((await fld.get('/approvals/expenses')).items);
      if (s.kinds.includes('leave')) setLv((await fld.get('/leave/pending')).items);
      setErr('');
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const [aq, setAq] = useState('');
  const listNow = (!sum ? [] : ((sum.kinds.includes(tab) ? tab : sum.kinds.includes('expenses') ? 'expenses' : 'leave') === 'leave' ? lv : exp) || []).filter(it => !aq.trim() || JSON.stringify(it).toLowerCase().includes(aq.trim().toLowerCase()));
  const pgA = usePaged(listNow);
  const decide = async (kind, id, status, remarks = '') => {
    setBusy(kind + id); setErr('');
    try { await fld.put(`/${kind === 'expenses' ? 'expenses' : 'leave'}/${id}/decision`, { status, remarks }); setRv(null); await load(); } catch (e) { setErr(e.message); setRv(r => r && { ...r, err: e.message }); }
    setBusy('');
  };
  if (err && !sum) return <Notice err={err} />;
  if (!sum) return <span className="spin" />;
  const kinds = sum.kinds.filter(k => k === 'expenses' || k === 'leave');
  if (!kinds.length) return <div className="a-empty">Your role does not approve expenses or leave.</div>;
  const active = kinds.includes(tab) ? tab : kinds[0];
  const items = active === 'expenses' ? exp : lv;
  const other = [['purchase', 'purchase orders'], ['orders', 'sales orders']].filter(([k]) => sum.kinds.includes(k) && sum.counts[k] > 0);
  return (
    <>
      <Summary items={[
        ['Expenses waiting', sum.counts.expenses, 'claims to decide', 'amber', 'money'],
        ['Leave waiting', sum.counts.leave, 'requests to decide', 'violet', 'clock'],
        ['Purchase orders', sum.counts.purchase, 'in the mobile app', 'blue', 'cart'],
        ['Sales orders', sum.counts.orders, 'in the mobile app', 'green', 'box']
      ]} />
      <Notice err={err} />
      <section className="a-card">
        <div className="fd-tabs">{kinds.map(k => <button key={k} type="button" className={active === k ? 'on' : ''} onClick={() => setTab(k)}>{k === 'expenses' ? 'Expense claims' : 'Leave requests'}{sum.counts[k] > 0 && <em>{sum.counts[k]}</em>}</button>)}</div>
        {!items && <span className="spin" />}
        {items && !items.length && <div className="a-empty">Nothing here yet.</div>}
        <input className="a-input fd-q" type="search" placeholder="Search by name, title or reason…" value={aq} onChange={e => setAq(e.target.value)} aria-label="Search approvals" />
        <div className="fd-tbl" role="table">
          <div className={'fd-th apt ' + active} role="row">
            <span>SL</span><span>Employee</span>
            {active === 'expenses' ? <><span>Title</span><span>Category</span><span>Amount</span><span>Date</span></> : <><span>Type</span><span>Dates</span><span>Days</span><span>Reason</span></>}
            <span>Status</span><span>Decision</span><span>Action</span>
          </div>
          {pgA.items.map((it, i) => {
            const pending = active === 'expenses' ? it.status === 'pending' : it.status === 'open';
            const tone = pending ? 'amber' : it.status === 'approved' ? 'ok' : it.status === 'rejected' ? 'bad' : 'off';
            const open = e => { e.stopPropagation(); setRv({ kind: active, it, text: '' }); };
            return (
              <div key={it.id} role="row" className={'fd-tr apt click ' + active + (pending ? ' open' : '')} tabIndex={0} title="Click to view the details" onClick={() => setRv({ kind: active, it, text: '' })} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), setRv({ kind: active, it, text: '' }))}>
                <span className="mono">{pgA.start + i + 1}</span>
                <span className="fd-who"><Av name={it.employeeName || it.name} /><span><b>{it.employeeName || it.name}</b></span></span>
                {active === 'expenses'
                  ? <><span>{it.title}</span><span>{it.category}</span><span><b>{fmtMoney(it.amount)}</b></span><span>{dayTime(it.date)}</span></>
                  : <><span>{it.type}</span><span>{it.dates}</span><span>{it.days}</span><span className="cut" title={it.reason}>{it.reason}</span></>}
                <span><Chip tone={tone}>{pending ? 'Waiting' : it.status}</Chip></span>
                <span className="cut" title={(it.decidedBy ? 'By ' + it.decidedBy + '. ' : '') + (it.remarks || '')}>{pending ? '—' : <>{it.decidedBy && <small>{it.decidedBy}</small>}{it.remarks ? ' ' + it.remarks : ''}</>}</span>
                <span><button type="button" className={'a-mini' + (pending ? ' ok' : '')} onClick={open}>{pending ? 'Review' : 'View'}</button></span>
              </div>
            );
          })}
          {items && !pgA.items.length && items.length > 0 && <div className="a-empty">No row matches your search.</div>}
        </div>
        {pgA.bar}
        {other.length > 0 && <small className="fd-sub">Also waiting: {other.map(([k, l]) => `${sum.counts[k]} ${l}`).join(', ')}. Those are decided in the mobile app.</small>}
        {staff && <small className="fd-sub">You cannot decide your own claims or leave.</small>}
      </section>
      {rv && (() => {
        const { kind, it } = rv;
        const exp = kind === 'expenses';
        const pending = exp ? it.status === 'pending' : it.status === 'open';
        const tone = pending ? 'amber' : it.status === 'approved' ? 'ok' : it.status === 'rejected' ? 'bad' : 'off';
        const who = it.employeeName || it.name;
        const working = busy === kind + it.id;
        return (
          <Modal kicker={exp ? 'Expense claim' : 'Leave request'} title={who} narrow cls="ap-modal" onClose={() => !working && setRv(null)}
            footer={pending
              ? <><button type="button" className="a-btn ap-rej" disabled={!!busy || !rv.text.trim()} title={rv.text.trim() ? 'Reject with these remarks' : 'Write the remarks first: the person will see why'} onClick={() => decide(kind, it.id, 'rejected', rv.text.trim())}>{working ? '…' : 'Reject'}</button><button type="button" className="a-btn ap-ok" disabled={!!busy} onClick={() => decide(kind, it.id, 'approved', rv.text.trim())}>{working ? '…' : 'Approve'}</button></>
              : <button type="button" className="a-btn" onClick={() => setRv(null)}>Close</button>}>
            <div className="att-hd"><Av name={who} /><div><b>{who}</b><small>{exp ? 'Submitted ' + dayTime(it.date) : 'Requested leave'}</small></div><Chip tone={tone}>{pending ? 'Waiting' : it.status}</Chip></div>
            {exp ? (
              <Facts items={[['Amount', fmtMoney(it.amount)], ['Category', it.category], ['What for', it.title, true], it.voucher && ['Voucher', <button key="v" type="button" className="fd-lnk" onClick={() => viewFieldFile(it.voucher).catch(e => setRv(r => ({ ...r, err: e.message })))}>View voucher</button>, true]]} />
            ) : (
              <Facts items={[['Type', it.type], ['Days', it.days], ['Dates', it.dates, true], ['Reason', it.reason || '—', true]]} />
            )}
            {pending ? (
              <label className="ap-rm">Remarks <em>(required to reject, optional to approve)</em>
                <textarea className="a-input" rows={3} placeholder="Write the remarks. The person will see them in the mobile app." value={rv.text} onChange={e => setRv({ ...rv, text: e.target.value })} autoFocus />
              </label>
            ) : (it.decidedBy || it.remarks) && <div className="fd-apd">{it.decidedBy && <>Decided by {it.decidedBy}. </>}{it.remarks}</div>}
            {rv.err && <p className="bk-bad" style={{ color: '#b3261e', margin: 0, fontSize: 13 }}>{rv.err}</p>}
          </Modal>
        );
      })()}
    </>
  );
}
