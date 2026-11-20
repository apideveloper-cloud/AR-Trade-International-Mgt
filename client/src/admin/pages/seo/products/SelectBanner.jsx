import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

/** Gmail-style line: the page is selected, offer to select every product that matches the filter. */
export function SelectBanner({ pageCount, total, all, pageSelected, onAll, onClear }) {
  const tr = useT();
  if (all) return <div className="adpt-banner">{tr('All {n} products matching the filter are selected.', { n: total })} <button type="button" onClick={onClear}>{tr('Clear selection')}</button></div>;
  if (!pageSelected || total <= pageCount) return null;
  return <div className="adpt-banner">{tr('{n} products on this page are selected.', { n: pageCount })} <button type="button" onClick={onAll}>{tr('Select all {n} matching the filter', { n: total })}</button></div>;
}
