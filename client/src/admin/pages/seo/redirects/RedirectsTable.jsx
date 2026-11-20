import { Pill } from '../../../ui.jsx';
import { fDate } from '../../../fieldKit.jsx';
import { liveUrl } from './redirectModel.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

const HEAD = ['Source', 'Target', 'Code', 'Hits', 'Last hit', 'Flags', ''];
const DOT = { true: ['adrd-ok', 'The target page works'], false: ['adrd-bad', 'The target page is missing or broken'], null: ['adrd-na', 'The target was not checked (outside address)'] };

/** Redirect list: a table on wide screens, stacked cards at phone width (CSS only). */
export function RedirectsTable({ rows, loading, onEdit, onDelete }) {
  const tr = useT();
  return (
    <div className="adrd-wrap">
      <div className="fd-tbl adrd-tbl" role="table">
        <div className="fd-th adrd-r adrd-h" role="row">{HEAD.map((h, i) => <span key={i}>{tr(h)}</span>)}</div>
        {rows.map(r => {
          const [dc, dt] = DOT[String(r.targetOk)] || DOT.null;
          return (
            <div key={r.id} role="row" className="fd-tr adrd-r">
              <span className="adrd-clip"><a href={liveUrl(r.source)} target="_blank" rel="noreferrer" title={r.source}>{r.source}</a></span>
              <span className="adrd-clip adrd-tg" data-l={tr('Target')} title={r.target}><i className={'adrd-dot ' + dc} title={tr(dt)} /><span>{r.target}</span></span>
              <span data-l={tr('Code')}><Pill s="Active" label={String(r.code)} /></span>
              <span data-l={tr('Hits')}>{(r.hits || 0).toLocaleString('en-US')}</span>
              <span data-l={tr('Last hit')}>{r.lastHit ? fDate(r.lastHit) : '–'}</span>
              <span className="adrd-flags" data-l={tr('Flags')}>
                {r.auto && <Pill s="Pending" label="Auto" />}
                {r.loop && <b className="adrd-badge adrd-red">{tr('loop')}</b>}
                {!r.loop && r.hops > 1 && <b className="adrd-badge adrd-amber" title={tr('Ends at {t}', { t: r.finalTarget || '?' })}>{tr('chain')} ({r.hops})</b>}
                {!r.auto && !r.loop && !(r.hops > 1) && '–'}
              </span>
              <span className="adrd-act">
                <button type="button" className="a-btn ghost sm" onClick={() => onEdit(r)}>{tr('Edit')}</button>
                <button type="button" className="a-btn ghost sm adrd-del" onClick={() => onDelete(r)}>{tr('Delete')}</button>
              </span>
            </div>
          );
        })}
        {!rows.length && <div className="a-empty">{loading ? tr('Loading…') : tr('No redirects match these filters.')}</div>}
      </div>
    </div>
  );
}
