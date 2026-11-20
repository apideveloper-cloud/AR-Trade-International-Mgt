/** Gmail-style line: the page is selected, offer to select every product that matches the filter. */
export function SelectBanner({ pageCount, total, all, pageSelected, onAll, onClear }) {
  if (all) return <div className="adpt-banner">All {total} products matching the filter are selected. <button type="button" onClick={onClear}>Clear selection</button></div>;
  if (!pageSelected || total <= pageCount) return null;
  return <div className="adpt-banner">{pageCount} products on this page are selected. <button type="button" onClick={onAll}>Select all {total} matching the filter</button></div>;
}
