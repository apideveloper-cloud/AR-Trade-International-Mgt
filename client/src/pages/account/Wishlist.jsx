import ProductCard from '../../components/ProductCard.jsx';
import { useStore } from '../../store.jsx';
import { Empty, H2 } from './shared.jsx';

export default function Wishlist() {
  const { wish, find } = useStore();
  const items = wish.map(find).filter(Boolean);
  return (
    <>
      <H2>Wishlist</H2>
      <div className="ac-s68">{items.map(p => <ProductCard key={p.id} p={p} />)}</div>
      {!items.length && <Empty>Tap ♡ on any product to save it here.</Empty>}
    </>
  );
}
