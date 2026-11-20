import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { confirmBox } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { send } from './pricesApi.js';
import { Section } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import { when } from './growthModel.js';
import { RV_STATUS, RV_STATUS_TEXT, RvMsg, rvMsg } from './rvApi.jsx';

/** The list of review requests, 15 per page, with the actions for each. */
export default function RvRequests({ tick, onChanged }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [m, setM] = useState(null);
  const [n, setN] = useState(0);
  const q = useApiData(() => adm.get('/growth/review-requests?status=' + status + '&page=' + page + '&limit=15'), [status, page, tick, n]);
  const d = q.data;
  const act = async (r, path, okText, ask) => {
    if (ask && !(await confirmBox(ask, { danger: true, confirmLabel: 'Cancel request' }))) return;
    const res = await send(`/growth/review-requests/${r.id}/${path}`, {});
    setM(rvMsg(res, okText));
    setN(x => x + 1); onChanged?.();
  };
  return (
    <Section id="adrv-list" title="Requests" what="Every review request we have made or will make. WhatsApp requests are sent by you: open WhatsApp, press Send, then come back and press Mark as sent.">
      <div className="adrv-row">
        <label>Show <select className="a-in" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{RV_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <RvMsg m={q.error ? { ok: false, text: q.error } : m} />
      <div className="adrv-scroll">
        <table className="adrv-tbl">
          <thead><tr><th>Order</th><th>Customer</th><th>Sent by</th><th>Status</th><th>Dates</th><th /></tr></thead>
          <tbody>
            {(d?.rows || []).map(r => {
              const wa = r.channel === 'whatsapp';
              return (
                <tr key={r.id}>
                  <td>{r.orderRef || '#' + r.orderId}</td>
                  <td className="adrv-wrap"><b>{r.name || 'Customer'}</b><div className="adrv-dim">{wa ? r.phone : r.email}</div></td>
                  <td><span className="adrv-badge">{wa ? '💬 WhatsApp' : '✉ E-mail'}</span></td>
                  <td><b>{RV_STATUS_TEXT[r.status] || r.status}</b>{r.status === 'failed' && r.lastError && <div className="adrv-msg-bad">{r.lastError}</div>}</td>
                  <td className="adrv-dim">{r.sentAt ? 'Sent ' + when(r.sentAt) : 'Due ' + when(r.sendAt)}{r.openedAt && <div>Opened {when(r.openedAt)}</div>}{r.reviewedAt && <div>Reviewed {when(r.reviewedAt)}</div>}{r.reminderAt && <div>Reminded {when(r.reminderAt)}</div>}</td>
                  <td><div className="adrv-acts">
                    {wa && r.whatsappUrl && ['queued', 'failed', 'sent'].includes(r.status) && <a className="a-btn ghost sm" href={r.whatsappUrl} target="_blank" rel="noreferrer">Open WhatsApp</a>}
                    {wa && r.status === 'queued' && <button type="button" className="a-btn sm" onClick={() => act(r, 'mark-sent', 'Marked as sent.')}>Mark as sent</button>}
                    {!wa && ['sent', 'opened', 'failed', 'queued'].includes(r.status) && <button type="button" className="a-btn ghost sm" onClick={() => act(r, 'resend', 'The e-mail will be sent again shortly.')}>Resend</button>}
                    {['queued', 'failed'].includes(r.status) && <button type="button" className="a-btn ghost sm" onClick={() => act(r, 'cancel', 'Request cancelled.', 'Cancel this review request? The customer will not be asked.')}>Cancel</button>}
                  </div></td>
                </tr>
              );
            })}
            {!q.loading && !q.error && !(d?.rows || []).length && <tr><td colSpan={6} className="adrv-dim">No requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
    </Section>
  );
}
