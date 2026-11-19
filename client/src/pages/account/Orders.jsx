import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt, fmtDate } from '../../api.js';
import { Badge, Empty, H2, Loading, Thumb, isOpen, summary, useBuyAgain } from './shared.jsx';

export default function Orders({ orders }) {
  const buyAgain = useBuyAgain();
  const [f, setF] = useState('All');
  const list = (orders || []).filter(o => f === 'All' || (f === 'Active' ? isOpen(o) : o.status === f));
  return (
    <>
      <H2 right={<div className="ac-seg">{['All', 'Active', 'Delivered', 'Cancelled'].map(x => <button key={x} className={f === x ? 'on' : ''} onClick={() => setF(x)}>{x}</button>)}</div>}>Orders</H2>
      <div className="ac-card ac-orders-card">
        <div className="ac-orders-table">
          <div className="ac-thead ac-orders-cols"><span>Order</span><span>Items</span><span>Date</span><span>Status</span><span className="ac-cell-right">Total</span><span /></div>
          {orders === null && <Loading />}
          {list.map(o => (
            <div key={o.id} className="ac-trow ac-orders-cols">
              <Link to={'/account/orders/' + o.id} className="ac-s41">{o.id}</Link>
              <div className="ac-order-items"><Thumb src={o.items[0]?.img} /><span className="ac-order-summary">{summary(o)}</span></div>
              <span className="ac-order-date">{fmtDate(o.date)}</span><Badge s={o.status} /><b className="ac-cell-right">{fmt(o.total)}</b>
              <div className="ac-order-actions"><Link to={'/account/orders/' + o.id} className="ac-btn ghost sm">Details</Link><button className="ac-btn ghost sm" onClick={() => buyAgain(o.items)}>Buy again</button></div>
            </div>
          ))}
        </div>
      </div>
      {orders && !list.length && <Empty>No orders in this view.</Empty>}
    </>
  );
}
