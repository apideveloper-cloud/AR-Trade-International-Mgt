import ProductCard from '../../components/ProductCard.jsx';
import './product-extra.css';

/** Up to four other products of the same category. */
export default function RelatedProducts({ p, products }) {
  return (
    <div className="pfx-related">
      <h2>Related products</h2>
      <div className="rel-grid">{products.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4).map(x => <ProductCard key={x.id} p={x} />)}</div>
    </div>
  );
}
