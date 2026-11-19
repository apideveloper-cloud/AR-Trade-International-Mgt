import './shop.css';

/** Placeholder product card shown while the grid is loading. */
export function SkeletonCard() {
  return (
    <article className="pcard shpx-sk-card">
      <div className="shimmer shpx-sk-img" />
      <div className="shpx-sk-lines"><div className="shimmer shpx-sk-l1" /><div className="shimmer shpx-sk-l2" /><div className="shimmer shpx-sk-l3" /></div>
      <div className="shpx-sk-foot"><div className="shimmer shpx-sk-price" /><div className="shimmer shpx-sk-btn" /></div>
    </article>
  );
}

/** Placeholder row shown while the list view is loading. */
export function SkeletonRow() {
  return (
    <div className="lrow"><div className="shimmer shpx-skr-img" /><div className="shimmer shpx-skr-mid" /><div className="shimmer shpx-skr-btn" /></div>
  );
}
