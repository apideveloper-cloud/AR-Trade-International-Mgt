import { Pill } from '../../../ui.jsx';
import { fDateTime } from '../../../fieldKit.jsx';
import { liveUrl } from './redirectModel.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

const HEAD = ['Path', 'Hits', 'Referrer', 'First seen', 'Last seen', ''];

/** 404 list: a table on wide screens, stacked cards at phone width (CSS only). */
export function NotFoundTable({ rows, loading, busyId, onRedirect, onIgnore, onDelete }) {
  const tr = useT();
  return (
    <div className="adrd-wrap">
      <div className="fd-tbl adrd-tbl adrd-nf" role="table">
        <div className="fd-th adrd-r adrd-h" role="row">{HEAD.map((h, i) => <span key={i}>{tr(h)}</span>)}</div>
        {rows.map(r => (
          <div key={r.id} role="row" className="fd-tr adrd-r">
            <span className="adrd-clip"><a href={liveUrl(r.path)} target="_blank" rel="noreferrer" title={r.path}>{r.path}</a>{r.ignored && <> <Pill s="Disabled" label="Ignored" /></>}{r.hasRedirect && <> <Pill s="Active" label="Has redirect" /></>}</span>
            <span data-l={tr('Hits')}>{(r.hits || 0).toLocaleString('en-US')}</span>
            <span className="adrd-clip" data-l={tr('Referrer')} title={r.referrer || ''}>{r.referrer || '–'}</span>
            <span data-l={tr('First seen')}>{fDateTime(r.firstSeen)}</span>
            <span data-l={tr('Last seen')}>{fDateTime(r.lastSeen)}</span>
            <span className="adrd-act">
              <button type="button" className="a-btn ghost sm" disabled={busyId === r.id} onClick={() => onRedirect(r)}>{tr('Create redirect')}</button>
              <button type="button" className="a-btn ghost sm" disabled={busyId === r.id} onClick={() => onIgnore(r)}>{r.ignored ? tr('Unignore') : tr('Ignore')}</button>
              <button type="button" className="a-btn ghost sm adrd-del" disabled={busyId === r.id} onClick={() => onDelete(r)}>{tr('Delete')}</button>
            </span>
          </div>
        ))}
        {!rows.length && <div className="a-empty">{loading ? tr('Loading…') : tr('No 404 pages match these filters. Nice.')}</div>}
      </div>
    </div>
  );
}
