import { Navigate, useSearchParams } from 'react-router-dom';

/** Order tracking is private: it lives in the customer's account. Signed-in customers land on their order; others are sent to sign in first. */
export default function Track() {
  const [sp] = useSearchParams();
  const id = (sp.get('id') || '').trim();
  return <Navigate to={id ? '/account/orders/' + encodeURIComponent(id) : '/account/orders'} replace />;
}
