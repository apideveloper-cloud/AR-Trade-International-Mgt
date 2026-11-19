import { useCallback, useEffect, useState } from 'react';
import { fld } from '../../adminApi.js';
import { Summary } from '../../ui.jsx';
import { Notice, usePaged } from '../../fieldKit.jsx';
import { ApprovalTable } from './approvals/ApprovalTable.jsx';
import { ReviewModal } from './approvals/ReviewModal.jsx';
import './approvals/approvals.css';
import '../../field.css';

/** Expense claims and leave requests waiting for the signed-in approver. */
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
        <ApprovalTable active={active} items={items} pg={pgA} onOpen={it => setRv({ kind: active, it, text: '' })} />
        {pgA.bar}
        {other.length > 0 && <small className="fd-sub">Also waiting: {other.map(([k, l]) => `${sum.counts[k]} ${l}`).join(', ')}. Those are decided in the mobile app.</small>}
        {staff && <small className="fd-sub">You cannot decide your own claims or leave.</small>}
      </section>
      {rv && <ReviewModal rv={rv} setRv={setRv} busy={busy} decide={decide} />}
    </>
  );
}
