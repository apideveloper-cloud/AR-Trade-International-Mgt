import { adm, dateTimeF, useTable } from '../../adminApi.js';
import { Empty, Pager, Pill, Toolbar, ViewToggle, confirmBox, useView } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { withAlert } from '../../hooks/withAlert.js';

export function Reviews() {
  const t = useTable('/reviews', { status: '', from: '', to: '' });
  const [view, setView] = useView('reviews');
  const set = withAlert(async (id, status) => { await adm.put('/reviews/' + id, { status }); t.reload(); });
  const del = withAlert(async id => { if (await confirmBox('Delete this review permanently?', { danger: true, confirmLabel: 'Delete' })) { await adm.del('/reviews/' + id); t.reload(); } });
  const btn = (bg, fg) => ({ border: 0, borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, background: bg, color: fg, cursor: 'pointer' });
  return (
    <>
      {t.data.pending > 0 && <div className="a-msg" style={{ background: 'oklch(0.96 0.04 85)', color: 'oklch(0.4 0.12 70)' }}>{t.data.pending} review{t.data.pending > 1 ? 's' : ''} waiting for your approval. Reviews appear on the product page only after you approve them.</div>}
      <ListFilter t={t} noun="review" title="Search reviews" search={{ placeholder: 'Reviewer, product or text' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['Pending', 'Approved', 'Rejected'] }]} range={{ label: 'Posted' }} />
      <Toolbar t={t} search={false}><ViewToggle view={view} setView={setView} /></Toolbar>
      <div className={'vw ' + view} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: t.loading ? .6 : 1 }}>
        {t.data.rows.map(v => (
          <div key={v.id} className="a-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'start', padding: '16px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: 'oklch(0.72 0.17 70)', letterSpacing: 2, fontSize: 15 }}>{'★'.repeat(v.rating)}<span style={{ color: '#d5d8e0' }}>{'★'.repeat(5 - v.rating)}</span></span>
                <b style={{ fontSize: 14 }}>{v.title || 'Review'}</b>
                <Pill s={v.status} />
                {v.verified && <span className="a-pill" style={{ background: 'oklch(0.95 0.05 150)', color: 'oklch(0.4 0.12 150)' }}>✓ Verified purchase</span>}
              </div>
              <span style={{ lineHeight: 1.55 }}>{v.body}</span>
              <span style={{ color: '#5d6270', fontSize: 12.5 }}>{v.name} on <b>{v.product}</b> · {dateTimeF(v.created)}{v.reviewed ? ` · reviewed ${dateTimeF(v.reviewed)}` : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {v.status !== 'Approved' && <button style={btn('oklch(0.55 0.15 150)', '#fff')} onClick={() => set(v.id, 'Approved')}>Approve</button>}
              {v.status !== 'Rejected' && <button style={btn('#fff', 'oklch(0.5 0.18 25)')} onClick={() => set(v.id, 'Rejected')}>Reject</button>}
              <button style={btn('#f1f3f7', '#5d6270')} onClick={() => del(v.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
