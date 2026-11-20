import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store.jsx';
import { brandSlug } from '../../brandSlug.js';

/** Brand logo marquee; the list is rendered twice for a seamless loop. Each logo opens its /brand/<slug> page (or the shop search when the brand has no listed products). */
export default function Brands() {
  const { content, products } = useStore();
  const list = content.brands.filter(b => b.n);
  const have = useMemo(() => new Set(products.map(p => brandSlug(p.brand))), [products]);
  const href = n => (have.has(brandSlug(n)) ? '/brand/' + brandSlug(n) : '/shop/all?q=' + encodeURIComponent(n));
  const logos = suffix => list.map(b => <Link key={b.n + suffix} to={href(b.n)} title={b.n} className="brand-logo"><img src={b.src} alt={b.n} width="112" height="39" loading="lazy" decoding="async" /></Link>);
  return <section className="sec hm-pt-28"><div className="brand-marq"><div>{logos('')}{logos('2')}</div></div></section>;
}
