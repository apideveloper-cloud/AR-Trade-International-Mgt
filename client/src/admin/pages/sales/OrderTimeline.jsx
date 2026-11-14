import { useState } from 'react';
import { adm, dateTimeF, STATUS_COLORS } from '../../adminApi.js';

/** Comment box plus the status history. */
export function OrderTimeline({ id, o, setO }) {
  const [cm, setCm] = useState({ text: '', busy: false, err: '' });
  const post = async e => {
    e.preventDefault();
    if (!cm.text.trim()) return;
    setCm(c => ({ ...c, busy: true, err: '' }));
    try { const n = await adm.post(`/orders/${id}/comments`, { text: cm.text.trim() }); setO(n); setCm({ text: '', busy: false, err: '' }); } catch (x) { setCm(c => ({ ...c, busy: false, err: x.message })); }
  };
  return (
    <section className="od-card">
      <h4>Timeline &amp; comments <em>{o.history.length}</em></h4>
      <form className="od-cm" onSubmit={post}>
        <textarea rows={3} value={cm.text} onChange={e => setCm(c => ({ ...c, text: e.target.value }))} placeholder="Add a comment for your team (not shown to the customer)…" aria-label="Comment for your team" maxLength={255} />
        <div><small>{cm.err || `${cm.text.length}/255`}</small><button className="a-btn sm grad" disabled={cm.busy || !cm.text.trim()}>{cm.busy ? 'Posting…' : '💬 Post comment'}</button></div>
      </form>
      <ol className="od-hist">
        {[...o.history].reverse().map((h, i) => (
          <li key={i} className={h.kind === 'comment' ? 'cmt' : ''} style={{ '--c': h.kind === 'comment' ? '#6b7388' : STATUS_COLORS[h.s]?.[1] || '#13306b' }}>
            <div className="od-he"><b>{h.kind === 'comment' ? '💬 Comment' : h.s}</b><span className="mono">{dateTimeF(h.at)}</span></div>
            {h.note && <p>{h.kind === 'comment' ? h.note : '“' + h.note + '”'}</p>}
            {h.by && <small>by {h.by}</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}
