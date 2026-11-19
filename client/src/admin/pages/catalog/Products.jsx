import { useState } from 'react';
import { adm, can, fmtMoney, useTable } from '../../adminApi.js';
import { ListFilter } from '../../ListFilter.jsx';
import { Empty, Pager, Summary, Toolbar, ViewToggle, alertBox, useView } from '../../ui.jsx';
import { Editor } from './ProductEditor.jsx';
import { ProductCards } from './ProductCards.jsx';
import { ProductTable } from './ProductTable.jsx';
import './catalogPage.css';

/** Summary tiles of the product list. */
const ProductSummary = ({ m }) => (
  <Summary items={[
    ['Products', m.total, m.live + ' live · ' + m.hidden + ' hidden · ' + m.categories + ' categories', 'blue', 'box'],
    ['Stock value', fmtMoney(m.stockValue), 'Live products at selling price', 'violet', 'money'],
    ['Low stock', m.low, '1 to 5 left', 'amber', 'alert'],
    ['Out of stock', m.outOfStock, 'Live, priced, none left', 'red', 'alert'],
    ['Quotation only', m.quote, 'No price: shown as ask us', 'blue', 'tag'],
    ['No photo', m.noImage, 'Live products without an image', 'red', 'image']
  ]} />
);

/** Products page: summary, filters, table or card view and the product form. */
export function Products({ cats, staff }) {
  const canWrite = can(staff, 'products.manage'); // Master Admin and Admin only; everyone else sees the list read-only
  const t = useTable('/products', { cat: '', stock: '', live: '' });
  const [view, setView] = useView('products');
  const [edit, setEdit] = useState(null); // null | 'new' | product
  const patch = async (p, body) => { try { await adm.put('/products/' + p.id, body); t.reload(); } catch (e) { alertBox(e.message); } };
  const catName = id => cats.find(c => c.id === id)?.title || id;
  const View = view === 'grid' ? ProductCards : ProductTable;
  return (
    <>
      {t.data.summary && <ProductSummary m={t.data.summary} />}
      <ListFilter t={t} noun="product" title="Search products" search={{ placeholder: 'Name, brand, part no. or ID', span: 'c4' }} resetSpan="c1"
        selects={[
          { key: 'cat', label: 'Category', all: 'All categories', icon: 'grid', span: 'c3', options: cats.map(c => ({ v: c.id, t: c.title })) },
          { key: 'stock', label: 'Stock', all: 'Any stock', icon: 'box', span: 'c2', options: [{ v: 'low', t: 'Low stock (5 or fewer)' }] },
          { key: 'live', label: 'Visibility', all: 'Live and hidden', icon: 'status', span: 'c2', options: [{ v: '0', t: 'Hidden only' }] }
        ]} />
      <Toolbar t={t} search={false}>{!canWrite && <span className="ro-note" title="Only an Admin or the Master Admin can change products">👁 View only</span>}<ViewToggle view={view} setView={setView} /></Toolbar>
      <View t={t} patch={patch} catName={catName} setEdit={setEdit} canWrite={canWrite} />
      <Empty t={t} /><Pager t={t} />
      {edit && <Editor product={edit} cats={cats} onClose={() => setEdit(null)} onSaved={t.reload} />}
    </>
  );
}
