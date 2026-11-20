import { Grid } from '../../fieldKit.jsx';
import { Pill, Switch } from '../../ui.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/seo.js';
import './brands.css';

const COLS = 'minmax(140px,1.6fr) 80px 130px 70px minmax(220px,1.8fr)';

export const statusOf = b => (b.hidden ? ['Disabled', 'Hidden'] : b.indexable ? ['Active', 'Indexed'] : ['Pending', 'Thin: noindex']);
const tone = n => (n >= 80 ? 'adbr-good' : n >= 50 ? 'adbr-mid' : 'adbr-low');

/** The list of brands with search and paging (done by Grid in the browser). */
export function BrandsTable({ rows, onEdit, onToggle, busySlug }) {
  const tr = useT();
  const gridRows = rows.map(b => {
    const [s, label] = statusOf(b);
    return {
      key: b.slug,
      cells: [
        <span className="adbr-name"><b>{b.name}</b><small>/brand/{b.slug}</small></span>,
        b.products,
        <Pill s={s} label={label} />,
        <span className={'adbr-score ' + (b.score == null ? '' : tone(b.score))}>{b.score == null ? '–' : b.score}</span>,
        <span className="adbr-acts">
          <button type="button" className="a-btn ghost sm" onClick={() => onEdit(b)}>{tr('Edit SEO')}</button>
          <Switch on={!b.hidden} title={b.hidden ? tr('Hidden: click to show') : tr('Shown: click to hide')} onChange={() => busySlug !== b.slug && onToggle(b)} />
          <a className="a-btn ghost sm" href={'/brand/' + encodeURIComponent(b.slug)} target="_blank" rel="noreferrer">{tr('View')} ↗</a>
        </span>
      ]
    };
  });
  return <div className="adbr-wrap"><Grid cols={COLS} head={[tr('Brand'), tr('Products'), tr('Page status'), tr('SEO score'), tr('Actions')]} rows={gridRows} empty={tr('No brands yet.')} /></div>;
}
