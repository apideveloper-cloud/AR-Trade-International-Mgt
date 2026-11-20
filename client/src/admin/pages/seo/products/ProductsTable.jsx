import { Pill } from '../../../ui.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

const tone = n => (n == null ? '' : n >= 80 ? ' adpt-good' : n >= 50 ? ' adpt-mid' : ' adpt-low');
const INDEX = { indexed: ['Active', 'Indexed'], noindex: ['Pending', 'Noindex'], hidden: ['Disabled', 'Hidden'] };
const HEAD = ['', '', 'Product', 'Category', 'Score', 'Meta title', 'Meta description', 'Index', 'Issues', 'Alt missing', ''];

/** The product list: a table on wide screens, stacked cards at phone width (CSS only). */
export function ProductsTable({ rows, loading, sel, onToggle, onPage, onEdit }) {
  const tr = useT();
  const allOn = rows.length > 0 && rows.every(r => sel.has(r.id));
  return (
    <div className="adpt-wrap">
      <div className="fd-tbl adpt-tbl" role="table">
        <div className="fd-th adpt-r adpt-h" role="row">
          {HEAD.map((h, i) => (i === 0 ? <span key={i}><input type="checkbox" checked={allOn} onChange={onPage} aria-label={tr('Select this page')} /></span> : <span key={i}>{tr(h)}</span>))}
        </div>
        {rows.map(r => {
          const [s, label] = INDEX[r.indexStatus] || INDEX.indexed;
          return (
            <div key={r.id} role="row" className={'fd-tr adpt-r' + (sel.has(r.id) ? ' adpt-on' : '')}>
              <span className="adpt-c-chk"><input type="checkbox" checked={sel.has(r.id)} onChange={() => onToggle(r.id)} aria-label={tr('Select {name}', { name: r.name })} /></span>
              <span className="adpt-c-img">{r.thumb ? <img className="adpt-thumb" src={r.thumb} alt="" loading="lazy" /> : <i className="adpt-thumb adpt-none" />}</span>
              <span className="adpt-name"><b>{r.name}</b><small>{[r.sku, r.brand].filter(Boolean).join(' · ')}</small></span>
              <span data-l={tr('Category')}>{r.catTitle || r.cat || '–'}</span>
              <span data-l={tr('Score')}><span className={'adpt-score' + tone(r.score)}>{r.score == null ? '–' : r.score}</span></span>
              <span data-l={tr('Meta title')}><Pill s={r.titleSet ? 'Active' : 'Pending'} label={r.titleSet ? 'Yes' : 'Auto'} /></span>
              <span data-l={tr('Meta description')}><Pill s={r.descSet ? 'Active' : 'Pending'} label={r.descSet ? 'Yes' : 'Auto'} /></span>
              <span data-l={tr('Index')}><Pill s={s} label={label} /></span>
              <span data-l={tr('Issues')}>{r.issues || 0}</span>
              <span data-l={tr('Alt missing')}>{r.altMissing || 0}</span>
              <span className="adpt-c-act"><button type="button" className="a-btn ghost sm" onClick={() => onEdit(r)}>{tr('Edit')}</button></span>
            </div>
          );
        })}
        {!rows.length && <div className="a-empty">{loading ? tr('Loading…') : tr('No products match these filters.')}</div>}
      </div>
    </div>
  );
}
