import { adm, dateTimeF, useTable } from '../../adminApi.js';
import { Empty, Pager, Pill, Toolbar, ViewToggle, confirmBox, useView } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { withAlert } from '../../hooks/withAlert.js';
import './engage.css';

export function Reviews() {
  const t = useTable('/reviews', { status: '', from: '', to: '' });
  const [view, setView] = useView('reviews');
  const set = withAlert(async (id, status) => { await adm.put('/reviews/' + id, { status }); t.reload(); });
  const del = withAlert(async id => { if (await confirmBox('Delete this review permanently?', { danger: true, confirmLabel: 'Delete' })) { await adm.del('/reviews/' + id); t.reload(); } });
  return (
    <>
      {t.data.pending > 0 && <div className="a-msg eg-rv-alert">{t.data.pending} review{t.data.pending > 1 ? 's' : ''} waiting for your approval. Reviews appear on the product page only after you approve them.</div>}
      <ListFilter t={t} noun="review" title="Search reviews" search={{ placeholder: 'Reviewer, product or text' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['Pending', 'Approved', 'Rejected'] }]} range={{ label: 'Posted' }} />
      <Toolbar t={t} search={false}><ViewToggle view={view} setView={setView} /></Toolbar>
      <div className={'vw eg-list ' + view} style={{ opacity: t.loading ? .6 : 1 }}>
        {t.data.rows.map(v => (
          <div key={v.id} className="a-card eg-row-card eg-top">
            <div className="eg-rv-main">
              <div className="eg-rv-head">
                <span className="eg-rv-stars">{'★'.repeat(v.rating)}<span>{'★'.repeat(5 - v.rating)}</span></span>
                <b className="eg-title">{v.title || 'Review'}</b>
                <Pill s={v.status} />
                {v.verified && <span className="a-pill eg-rv-verified">✓ Verified purchase</span>}
              </div>
              <span className="eg-rv-body">{v.body}</span>
              <span className="eg-rv-meta">{v.name} on <b>{v.product}</b> · {dateTimeF(v.created)}{v.reviewed ? ` · reviewed ${dateTimeF(v.reviewed)}` : ''}</span>
            </div>
            <div className="eg-rv-acts">
              {v.status !== 'Approved' && <button className="eg-rv-btn ok" onClick={() => set(v.id, 'Approved')}>Approve</button>}
              {v.status !== 'Rejected' && <button className="eg-rv-btn no" onClick={() => set(v.id, 'Rejected')}>Reject</button>}
              <button className="eg-rv-btn del" onClick={() => del(v.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
