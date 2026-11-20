import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { withAlert } from '../../hooks/withAlert.js';
import { confirmBox } from '../../ui.jsx';
import './reviews.css';

const pct = n => Math.round((Number(n) || 0) * (n <= 1 ? 100 : 1)) + ' %';

/** Small numbers strip above the review list. `tick` changes after any change so it reloads. */
export function RvStats({ tick }) {
  const q = useApiData(() => adm.get('/reviews/stats'), [tick]);
  const s = q.data;
  if (!s) return null;
  const by = s.byRating || {}, max = Math.max(1, ...[1, 2, 3, 4, 5].map(k => by[k] || 0));
  return (
    <div className="adrv-mstats">
      <div className="a-card adrv-ms"><span className="adrv-dim">Average rating</span><b>{(Number(s.avgRating) || 0).toFixed(1)} / 5</b><span className="adrv-dim">{s.total} reviews, {s.approved} approved</span></div>
      <div className="a-card adrv-ms">
        <span className="adrv-dim">Ratings</span>
        <div className="adrv-bars">{[5, 4, 3, 2, 1].map(k => <div key={k} className="adrv-bar"><span>{k} ★</span><u><i style={{ width: ((by[k] || 0) / max) * 100 + '%' }} /></u><span>{by[k] || 0}</span></div>)}</div>
      </div>
      <div className="a-card adrv-ms"><span className="adrv-dim">Verified buyers</span><b>{pct(s.verifiedShare)}</b><span className="adrv-dim">of reviews come from real buyers</span></div>
      <div className="a-card adrv-ms"><span className="adrv-dim">Replied to</span><b>{pct(s.repliedShare)}</b><span className="adrv-dim">of reviews have your reply</span></div>
      <div className="a-card adrv-ms"><span className="adrv-dim">Last 30 days</span><b>{s.last30?.received ?? 0} received</b><span className="adrv-dim">{s.last30?.approved ?? 0} approved</span></div>
    </div>
  );
}

export const RvSource = ({ v }) => (v.source === 'request'
  ? <span className="a-pill eg-rv-verified">Verified buyer via request</span>
  : v.source ? <span className="a-pill">Website</span> : null);

export const RvSpamNote = ({ v }) => (v.status === 'Spam' && v.spamReason ? <span className="adrv-small">Marked as spam: {v.spamReason}</span> : null);

/** Shows the owner's reply, or the editor. Saves through PUT /reviews/:id { reply }. */
export function RvReply({ v, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const save = withAlert(async reply => { await adm.put('/reviews/' + v.id, { reply }); setEdit(false); onSaved(); });
  const remove = withAlert(async () => { if (await confirmBox('Remove your reply to this review?', { danger: true, confirmLabel: 'Remove reply' })) { await adm.put('/reviews/' + v.id, { reply: '' }); onSaved(); } });
  const open = () => { setText(v.reply || ''); setEdit(true); };
  if (edit) {
    return (
      <div className="adrv-rbox">
        <textarea className="a-in" maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder="Write a public reply. Customers see it under the review." aria-label="Your reply" />
        <div className="adrv-row"><span className="adrv-dim">{text.length} / 1000</span>
          <button type="button" className="eg-rv-btn ok" disabled={!text.trim()} onClick={() => save(text.trim())}>Save reply</button>
          <button type="button" className="eg-rv-btn del" onClick={() => setEdit(false)}>Cancel</button></div>
      </div>
    );
  }
  if (v.reply) {
    return (
      <div className="adrv-reply"><span><b>Your reply:</b> {v.reply}</span>
        <div className="adrv-row"><button type="button" className="eg-rv-btn del" onClick={open}>Edit reply</button><button type="button" className="eg-rv-btn no" onClick={remove}>Remove reply</button></div></div>
    );
  }
  return <div><button type="button" className="eg-rv-btn del" onClick={open}>Reply</button></div>;
}
