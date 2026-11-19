import { Link } from 'react-router-dom';

/** Numbered page links (real hrefs for SEO); `where` is 'top' or 'bottom'. */
export default function Pager({ where, page, pageCount, pageHref }) {
  if (pageCount <= 1) return null;
  const pageNums = [];
  for (let n = 1; n <= pageCount; n++) if (n === 1 || n === pageCount || Math.abs(n - page) <= 2) pageNums.push(n);
  return (
    <nav className={'shop-pg ' + where} aria-label={where === 'top' ? 'Pagination (top)' : 'Pagination'}>
      {page > 1 && page <= pageCount && <Link className="shop-pg-a shop-pg-nav" rel="prev" to={pageHref(page - 1)}>‹ Previous</Link>}
      {pageNums.map((n, i) => (
        <span key={n} className="shop-pg-item">
          {i > 0 && n - pageNums[i - 1] > 1 && <span className="shop-pg-gap" aria-hidden="true">…</span>}
          <Link className={'shop-pg-a' + (n === page ? ' on' : '')} to={pageHref(n)} aria-current={n === page ? 'page' : undefined} aria-label={'Page ' + n}>{n}</Link>
        </span>
      ))}
      {page < pageCount && <Link className="shop-pg-a shop-pg-nav" rel="next" to={pageHref(page + 1)}>Next ›</Link>}
    </nav>
  );
}
