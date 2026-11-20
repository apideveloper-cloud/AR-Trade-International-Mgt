import { Grid } from '../../fieldKit.jsx';
import { Pill, Switch } from '../../ui.jsx';
import './brands.css';

const COLS = 'minmax(140px,1.6fr) 80px 130px 70px minmax(220px,1.8fr)';

export const statusOf = b => (b.hidden ? ['Disabled', 'Hidden'] : b.indexable ? ['Active', 'Indexed'] : ['Pending', 'Thin: noindex']);
const tone = n => (n >= 80 ? 'adbr-good' : n >= 50 ? 'adbr-mid' : 'adbr-low');

/** The list of brands with search and paging (done by Grid in the browser). */
export function BrandsTable({ rows, onEdit, onToggle, busySlug }) {
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
          <button type="button" className="a-btn ghost sm" onClick={() => onEdit(b)}>Edit SEO</button>
          <Switch on={!b.hidden} title={b.hidden ? 'Hidden: click to show' : 'Shown: click to hide'} onChange={() => busySlug !== b.slug && onToggle(b)} />
          <a className="a-btn ghost sm" href={'/brand/' + encodeURIComponent(b.slug)} target="_blank" rel="noreferrer">View ↗</a>
        </span>
      ]
    };
  });
  return <div className="adbr-wrap"><Grid cols={COLS} head={['Brand', 'Products', 'Page status', 'SEO score', 'Actions']} rows={gridRows} empty="No brands yet." /></div>;
}
