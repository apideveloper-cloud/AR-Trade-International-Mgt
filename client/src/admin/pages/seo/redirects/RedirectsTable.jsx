import { Pill } from '../../../ui.jsx';
import { fDate } from '../../../fieldKit.jsx';
import { liveUrl } from './redirectModel.js';

const HEAD = ['Source', 'Target', 'Code', 'Hits', 'Last hit', 'Flags', ''];
const DOT = { true: ['adrd-ok', 'The target page works'], false: ['adrd-bad', 'The target page is missing or broken'], null: ['adrd-na', 'The target was not checked (outside address)'] };

/** Redirect list: a table on wide screens, stacked cards at phone width (CSS only). */
export function RedirectsTable({ rows, loading, onEdit, onDelete }) {
  return (
    <div className="adrd-wrap">
      <div className="fd-tbl adrd-tbl" role="table">
        <div className="fd-th adrd-r adrd-h" role="row">{HEAD.map((h, i) => <span key={i}>{h}</span>)}</div>
        {rows.map(r => {
          const [dc, dt] = DOT[String(r.targetOk)] || DOT.null;
          return (
            <div key={r.id} role="row" className="fd-tr adrd-r">
              <span className="adrd-clip"><a href={liveUrl(r.source)} target="_blank" rel="noreferrer" title={r.source}>{r.source}</a></span>
              <span className="adrd-clip adrd-tg" data-l="Target" title={r.target}><i className={'adrd-dot ' + dc} title={dt} /><span>{r.target}</span></span>
              <span data-l="Code"><Pill s="Active" label={String(r.code)} /></span>
              <span data-l="Hits">{(r.hits || 0).toLocaleString('en-US')}</span>
              <span data-l="Last hit">{r.lastHit ? fDate(r.lastHit) : '–'}</span>
              <span className="adrd-flags" data-l="Flags">
                {r.auto && <Pill s="Pending" label="Auto" />}
                {r.loop && <b className="adrd-badge adrd-red">loop</b>}
                {!r.loop && r.hops > 1 && <b className="adrd-badge adrd-amber" title={'Ends at ' + (r.finalTarget || '?')}>chain ({r.hops})</b>}
                {!r.auto && !r.loop && !(r.hops > 1) && '–'}
              </span>
              <span className="adrd-act">
                <button type="button" className="a-btn ghost sm" onClick={() => onEdit(r)}>Edit</button>
                <button type="button" className="a-btn ghost sm adrd-del" onClick={() => onDelete(r)}>Delete</button>
              </span>
            </div>
          );
        })}
        {!rows.length && <div className="a-empty">{loading ? 'Loading…' : 'No redirects match these filters.'}</div>}
      </div>
    </div>
  );
}
