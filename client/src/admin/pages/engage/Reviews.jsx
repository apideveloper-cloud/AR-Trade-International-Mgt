import { useState } from 'react';
import { adm, dateTimeF, useTable } from '../../adminApi.js';
import { Empty, Pager, Pill, Toolbar, ViewToggle, confirmBox, useView } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { withAlert } from '../../hooks/withAlert.js';
import { useT } from '../../i18n/lang.jsx';
import { RvReply, RvSource, RvSpamNote, RvStats } from '../growth/RvModeration.jsx';
import '../../i18n/dict/growthB.js';
import './engage.css';

export function Reviews() {
  const tr = useT();
  const t = useTable('/reviews', { status: '', from: '', to: '' });
  const [view, setView] = useView('reviews');
  const [tick, setTick] = useState(0);
  const changed = () => { t.reload(); setTick(x => x + 1); };
  const set = withAlert(async (id, status) => { await adm.put('/reviews/' + id, { status }); changed(); });
  const del = withAlert(async id => { if (await confirmBox(tr('Delete this review permanently?'), { danger: true, confirmLabel: tr('Delete') })) { await adm.del('/reviews/' + id); changed(); } });
  return (
    <>
      <RvStats tick={tick} />
      {t.data.pending > 0 && <div className="a-msg eg-rv-alert">{t.data.pending > 1 ? tr('{n} reviews waiting for your approval. Reviews appear on the product page only after you approve them.', { n: t.data.pending }) : tr('1 review waiting for your approval. Reviews appear on the product page only after you approve it.')}</div>}
      <ListFilter t={t} noun="review" title={tr('Search reviews')} search={{ placeholder: tr('Reviewer, product or text') }} selects={[{ key: 'status', label: tr('Status'), all: tr('All statuses'), icon: 'status', options: ['Pending', 'Approved', 'Rejected', 'Spam'] }]} range={{ label: tr('Posted') }} />
      {t.data.counts && <div className="adrv-dim">{tr('Pending {pending} · Approved {approved} · Rejected {rejected} · Spam {spam}', t.data.counts)}</div>}
      <Toolbar t={t} search={false}><ViewToggle view={view} setView={setView} /></Toolbar>
      <div className={'vw eg-list ' + view} style={{ opacity: t.loading ? .6 : 1 }}>
        {t.data.rows.map(v => (
          <div key={v.id} className="a-card eg-row-card eg-top">
            <div className="eg-rv-main">
              <div className="eg-rv-head">
                <span className="eg-rv-stars">{'★'.repeat(v.rating)}<span>{'★'.repeat(5 - v.rating)}</span></span>
                <b className="eg-title">{v.title || tr('Review')}</b>
                <Pill s={v.status} />
                <RvSource v={v} />
                {v.verified && <span className="a-pill eg-rv-verified">✓ {tr('Verified purchase')}</span>}
              </div>
              <span className="eg-rv-body">{v.body}</span>
              <RvSpamNote v={v} />
              <RvReply v={v} onSaved={changed} />
              <span className="eg-rv-meta">{tr('{name} on {product}', { name: v.name, product: '\u0000' }).split('\u0000').map((p, i) => (i ? [<b key="p">{v.product}</b>, p] : p))} · {dateTimeF(v.created)}{v.reviewed ? ' · ' + tr('reviewed {date}', { date: dateTimeF(v.reviewed) }) : ''}</span>
            </div>
            <div className="eg-rv-acts">
              {v.status !== 'Approved' && <button className="eg-rv-btn ok" onClick={() => set(v.id, 'Approved')}>{tr('Approve')}</button>}
              {v.status !== 'Rejected' && <button className="eg-rv-btn no" onClick={() => set(v.id, 'Rejected')}>{tr('Reject')}</button>}
              {v.status !== 'Spam' && <button className="eg-rv-btn no" onClick={() => set(v.id, 'Spam')}>{tr('Mark as spam')}</button>}
              <button className="eg-rv-btn del" onClick={() => del(v.id)}>{tr('Delete')}</button>
            </div>
          </div>
        ))}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
