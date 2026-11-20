import { useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import ProductCard from '../../components/ProductCard.jsx';
import { useStore } from '../../store.jsx';
import { brandSlug } from '../../brandSlug.js';
import { PG } from '../shop/constants.js';
import Pager from '../shop/Pager.jsx';
import '../shop/shop.css';
import './brand.css';
import { NotFound } from '../info/NotFound.jsx';

/** Crawlable brand page (/brand/:slug): all products of one brand, 24 per page with ?page=N, same pager as the Shop. */
export default function BrandPage() {
  const { slug = '' } = useParams();
  const { pathname } = useLocation();
  const [sp] = useSearchParams();
  const { products } = useStore();
  const page = Math.max(1, parseInt(sp.get('page'), 10) || 1);
  const offset = (page - 1) * PG;

  const items = useMemo(() => products.filter(p => brandSlug(p.brand) === slug).sort((a, b) => b.popular - a.popular), [products, slug]);
  const name = items.length ? items[0].brand : '';

  // scroll to the top when only the page number changed
  const prev = useRef({ page, slug });
  useEffect(() => {
    if (prev.current.page !== page && prev.current.slug === slug) window.scrollTo(0, 0);
    prev.current = { page, slug };
  }, [page, slug]);

  if (!slug || !items.length) return <NotFound />;
  if (page > 1 && offset >= items.length) return <Navigate replace to={pathname} />;

  const shown = items.slice(offset, offset + PG);
  const pageCount = Math.ceil(items.length / PG);
  const pageHref = n => (n > 1 ? pathname + '?page=' + n : pathname);
  const pagerProps = { page, pageCount, pageHref };

  return (
    <section className="page shpx-page brdp-page">
      <div className="crumbs"><Link to="/">Home</Link><span>/</span><span>{name}</span></div>
      <div className="shop-top">
        <div className="shpx-head"><h1 className="h1">{name}</h1><span className="shpx-count">{items.length} {items.length === 1 ? 'product' : 'products'}</span></div>
      </div>
      <div className="shop-body">
        <div className="shop-main">
          <Pager where="top" {...pagerProps} />
          <div className="p-grid">
            {shown.map((p, n) => <div key={p.id}><ProductCard p={p} priority={n < 4} /></div>)}
          </div>
          <div className="loadmore">
            <span className="shpx-showing">Showing {offset + 1}–{offset + shown.length} of {items.length}</span>
          </div>
          <Pager where="bottom" {...pagerProps} />
        </div>
      </div>
    </section>
  );
}
