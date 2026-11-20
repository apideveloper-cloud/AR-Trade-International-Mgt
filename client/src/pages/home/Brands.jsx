import { Link } from 'react-router-dom';
import { useStore } from '../../store.jsx';

/** Brand logo marquee; the list is rendered twice for a seamless loop. */
export default function Brands() {
  const { content } = useStore();
  const list = content.brands.filter(b => b.n);
  const logos = suffix => list.map(b => <Link key={b.n + suffix} to={'/shop/all?q=' + encodeURIComponent(b.n)} title={b.n} className="brand-logo"><img src={b.src} alt={b.n} width="112" height="39" loading="lazy" decoding="async" /></Link>);
  return <section className="sec hm-pt-28"><div className="brand-marq"><div>{logos('')}{logos('2')}</div></div></section>;
}
