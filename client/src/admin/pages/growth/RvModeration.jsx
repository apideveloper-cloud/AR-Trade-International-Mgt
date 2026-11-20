import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { withAlert } from '../../hooks/withAlert.js';
import { confirmBox } from '../../ui.jsx';
import { useT } from '../../i18n/lang.jsx';
import './reviews.css';

const pct = n => Math.round((Number(n) || 0) * (n <= 1 ? 100 : 1)) + ' %';

/** Small numbers strip above the review list. `tick` changes after any change so it reloads. */
export function RvStats({ tick }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/reviews/stats'), [tick]);
  const s = q.data;
  if (!s) return null;
  const by = s.byRating || {}, max = Math.max(1, ...[1, 2, 3, 4, 5].map(k => by[k] || 0));
  return (
    <div className="adrv-mstats">
      <div className="a-card adrv-ms"><span className="adrv-dim">{tr('Average rating')}</span><b>{(Number(s.avgRating) || 0).toFixed(1)} / 5</b><span className="adrv-dim">{tr('{total} reviews, {approved} approved', { total: s.total, approved: s.approved })}</span></div>
      <div className="a-card adrv-ms">
        <span className="adrv-dim">{tr('Ratings')}</span>
        <div className="adrv-bars">{[5, 4, 3, 2, 1].map(k => <div key={k} className="adrv-bar"><span>{k} ★</span><u><i style={{ width: ((by[k] || 0) / max) * 100 + '%' }} /></u><span>{by[k] || 0}</span></div>)}</div>
      </div>
      <div className="a-card adrv-ms"><span className="adrv-dim">{tr('Verified buyers')}</span><b>{pct(s.verifiedShare)}</b><span className="adrv-dim">{tr('of reviews come from real buyers')}</span></div>
      <div className="a-card adrv-ms"><span className="adrv-dim">{tr('Replied to')}</span><b>{pct(s.repliedShare)}</b><span className="adrv-dim">{tr('of reviews have your reply')}</span></div>
      <div className="a-card adrv-ms"><span className="adrv-dim">{tr('Last 30 days')}</span><b>{tr('{n} received', { n: s.last30?.received ?? 0 })}</b><span className="adrv-dim">{tr('{n} approved', { n: s.last30?.approved ?? 0 })}</span></div>
    </div>
  );
}

export function RvSource({ v }) {
  const tr = useT();
  return v.source === 'request'
    ? <span className="a-pill eg-rv-verified">{tr('Verified buyer via request')}</span>
    : v.source ? <span className="a-pill">{tr('Website')}</span> : null;
}

export function RvSpamNote({ v }) {
  const tr = useT();
  return v.status === 'Spam' && v.spamReason ? <span className="adrv-small">{tr('Marked as spam: {reason}', { reason: tr(v.spamReason) })}</span> : null;
}

/** Shows the owner's reply, or the editor. Saves through PUT /reviews/:id { reply }. */
export function RvReply({ v, onSaved }) {
  const tr = useT();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  const save = withAlert(async reply => { await adm.put('/reviews/' + v.id, { reply }); setEdit(false); onSaved(); });
  const remove = withAlert(async () => { if (await confirmBox(tr('Remove your reply to this review?'), { danger: true, confirmLabel: tr('Remove reply') })) { await adm.put('/reviews/' + v.id, { reply: '' }); onSaved(); } });
  const open = () => { setText(v.reply || ''); setEdit(true); };
  if (edit) {
    return (
      <div className="adrv-rbox">
        <textarea className="a-in" maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder={tr('Write a public reply. Customers see it under the review.')} aria-label={tr('Your reply')} />
        <div className="adrv-row"><span className="adrv-dim">{text.length} / 1000</span>
          <button type="button" className="eg-rv-btn ok" disabled={!text.trim()} onClick={() => save(text.trim())}>{tr('Save reply')}</button>
          <button type="button" className="eg-rv-btn del" onClick={() => setEdit(false)}>{tr('Cancel')}</button></div>
      </div>
    );
  }
  if (v.reply) {
    return (
      <div className="adrv-reply"><span><b>{tr('Your reply:')}</b> {v.reply}</span>
        <div className="adrv-row"><button type="button" className="eg-rv-btn del" onClick={open}>{tr('Edit reply')}</button><button type="button" className="eg-rv-btn no" onClick={remove}>{tr('Remove reply')}</button></div></div>
    );
  }
  return <div><button type="button" className="eg-rv-btn del" onClick={open}>{tr('Reply')}</button></div>;
}
