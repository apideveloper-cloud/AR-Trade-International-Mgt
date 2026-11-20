import { Pill } from '../../../ui.jsx';
import { fDateTime } from '../../../fieldKit.jsx';
import { liveUrl } from './redirectModel.js';

const HEAD = ['Path', 'Hits', 'Referrer', 'First seen', 'Last seen', ''];

/** 404 list: a table on wide screens, stacked cards at phone width (CSS only). */
export function NotFoundTable({ rows, loading, busyId, onRedirect, onIgnore, onDelete }) {
  return (
    <div className="adrd-wrap">
      <div className="fd-tbl adrd-tbl adrd-nf" role="table">
        <div className="fd-th adrd-r adrd-h" role="row">{HEAD.map((h, i) => <span key={i}>{h}</span>)}</div>
        {rows.map(r => (
          <div key={r.id} role="row" className="fd-tr adrd-r">
            <span className="adrd-clip"><a href={liveUrl(r.path)} target="_blank" rel="noreferrer" title={r.path}>{r.path}</a>{r.ignored && <> <Pill s="Disabled" label="Ignored" /></>}{r.hasRedirect && <> <Pill s="Active" label="Has redirect" /></>}</span>
            <span data-l="Hits">{(r.hits || 0).toLocaleString('en-US')}</span>
            <span className="adrd-clip" data-l="Referrer" title={r.referrer || ''}>{r.referrer || '–'}</span>
            <span data-l="First seen">{fDateTime(r.firstSeen)}</span>
            <span data-l="Last seen">{fDateTime(r.lastSeen)}</span>
            <span className="adrd-act">
              <button type="button" className="a-btn ghost sm" disabled={busyId === r.id} onClick={() => onRedirect(r)}>Create redirect</button>
              <button type="button" className="a-btn ghost sm" disabled={busyId === r.id} onClick={() => onIgnore(r)}>{r.ignored ? 'Unignore' : 'Ignore'}</button>
              <button type="button" className="a-btn ghost sm adrd-del" disabled={busyId === r.id} onClick={() => onDelete(r)}>Delete</button>
            </span>
          </div>
        ))}
        {!rows.length && <div className="a-empty">{loading ? 'Loading…' : 'No 404 pages match these filters. Nice.'}</div>}
      </div>
    </div>
  );
}
