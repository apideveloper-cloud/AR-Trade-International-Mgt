import { slNo } from '../../adminApi.js';
import { scoreTone } from '../seo/dashboard/dashModel.js';
import { FlagChips, LiveSwitch, NumCell } from './ProductControls.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';
import './seoColumn.css';

/** Table view of the product list with inline price editing. */
export function ProductTable({ t, patch, catName, setEdit, canWrite }) {
  const tr = useT();
  return (
    <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
      <div className="prod-wrap adpl-wrap">
        <div className="head prod-cols adpl-cols"><span>{tr('SL')}</span><span /><span>{tr('Product')}</span><span>{tr('Category')}</span><span>{tr('Price')}</span><span>{tr('Regular')}</span><span>{tr('Stock')}</span><span>{tr('Flags')}</span><span>{tr('Live')}</span><span title={tr('SEO score')}>SEO</span></div>
        {t.data.rows.map((p, i) => (
          <div key={p.id} className="row prod-cols adpl-cols" style={{ opacity: p.active ? 1 : .55 }}>
            <span className="sl">{slNo(t, i)}</span>
            <div className="a-thumb" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }} />
            <button className="prod-name" disabled={!canWrite} onClick={() => setEdit(p)}><b>{p.name}</b><span className="prod-sub">{p.brand} · #{p.id} · {tr('Edit')}</span></button>
            <span className="prod-cat">{catName(p.cat)}</span>
            <NumCell p={p} k="price" canWrite={canWrite} patch={patch} />
            <NumCell p={p} k="old" canWrite={canWrite} patch={patch} />
            <NumCell p={p} k="stock" canWrite={false} patch={patch} plainClass={'ro-val' + (p.price && p.stock <= 5 ? ' prod-low' : '')} />
            <FlagChips p={p} canWrite={canWrite} patch={patch} />
            <LiveSwitch p={p} canWrite={canWrite} patch={patch} />
            <span><span className={'adpl-badge is-' + scoreTone(p.seoScore)} title={tr('SEO score')}>{p.seoScore == null ? '–' : p.seoScore}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
