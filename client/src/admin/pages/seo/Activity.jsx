import { useState } from 'react';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/seo.js';
import { useTable } from '../../adminApi.js';
import { Summary, Toolbar, Pager, Modal, Empty } from '../../ui.jsx';
import SeoItemEditor from '../../seoItem/SeoItemEditor.jsx';
import { useRevert } from '../../seoItem/useHistory.js';
import { EntryRow } from './activity/EntryRow.jsx';
import './activity/activity.css';

const SOURCES = [['', 'All sources'], ['editor', 'Editor'], ['bulk', 'Bulk'], ['csv', 'CSV'], ['settings', 'Settings'], ['revert', 'Revert']];

/** The Activity tab of Admin > SEO: every SEO change, newest first. */
export default function Activity() {
  const tr = useT();
  const t = useTable('/seo/history', { size: 10, source: '' });
  const [edit, setEdit] = useState(null);
  const { revert, busyId } = useRevert(() => t.reload());
  const rows = t.data.rows || [];
  const day = Date.now() - 864e5;
  const last24 = rows.filter(e => new Date(e.at).getTime() >= day).length;
  const nameOf = e => (e.type === 'product' ? <button type="button" className="adac-link" onClick={() => setEdit(e)}>{e.name || '#' + e.entityId}</button> : (e.name || e.type));
  return (
    <div>
      <Summary items={[[tr('Changes'), t.data.total, tr('all time'), 'blue', 'clock'], [tr('Last 24 h'), last24, tr('on this page'), 'green', 'check'], [tr('Reverted'), rows.filter(e => e.reverted).length, tr('on this page'), 'amber', 'repeat'], [tr('Bulk changes'), rows.filter(e => e.action === 'bulk').length, tr('on this page'), 'violet', 'box']]} />
      <div className="adac-filter">
        <input className="a-input" value={t.params.q} placeholder={tr('Search item, person or summary')} onChange={e => t.set({ q: e.target.value })} />
        <select value={t.params.source} onChange={e => t.set({ source: e.target.value })}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select>
      </div>
      <Toolbar t={t} search={false} />
      {t.error && <div className="a-msg err">{t.error}</div>}
      <div className="adac-list">{rows.map(e => <EntryRow key={e.id} e={e} name={nameOf(e)} onRevert={revert} busy={busyId === e.id} />)}</div>
      <Empty t={t} />
      <Pager t={t} />
      {edit && (
        <Modal kicker={tr('Product SEO')} title={edit.name || '#' + edit.entityId} onClose={() => { setEdit(null); t.reload(); }} onSubmit={ev => ev.preventDefault()}>
          <div className="adac-body"><SeoItemEditor type="product" id={edit.entityId} mode="full" onChanged={() => t.reload()} /></div>
        </Modal>
      )}
    </div>
  );
}
