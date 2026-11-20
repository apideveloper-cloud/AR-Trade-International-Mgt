import { useState } from 'react';
import { adm, can, fmtMoney, useTable } from '../../adminApi.js';
import { ListFilter } from '../../ListFilter.jsx';
import { Empty, Pager, Summary, Toolbar, ViewToggle, alertBox, useView } from '../../ui.jsx';
import { Editor } from './ProductEditor.jsx';
import { ProductCards } from './ProductCards.jsx';
import { ProductTable } from './ProductTable.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';
import './catalogPage.css';

/** Summary tiles of the product list. */
const ProductSummary = ({ m }) => {
  const tr = useT();
  return (
    <Summary items={[
      [tr('Products'), m.total, tr('{live} live · {hidden} hidden · {cats} categories', { live: m.live, hidden: m.hidden, cats: m.categories }), 'blue', 'box'],
      [tr('Stock value'), fmtMoney(m.stockValue), tr('Live products at selling price'), 'violet', 'money'],
      [tr('Low stock'), m.low, tr('1 to 5 left'), 'amber', 'alert'],
      [tr('Out of stock'), m.outOfStock, tr('Live, priced, none left'), 'red', 'alert'],
      [tr('Quotation only'), m.quote, tr('No price: shown as ask us'), 'blue', 'tag'],
      [tr('No photo'), m.noImage, tr('Live products without an image'), 'red', 'image']
    ]} />
  );
};

/** Products page: summary, filters, table or card view and the product form. */
export function Products({ cats, staff }) {
  const tr = useT();
  const canWrite = can(staff, 'products.manage'); // Master Admin and Admin only; everyone else sees the list read-only
  const t = useTable('/products', { cat: '', stock: '', live: '', seo: '' });
  const [view, setView] = useView('products');
  const [edit, setEdit] = useState(null); // null | 'new' | product
  const patch = async (p, body) => { try { await adm.put('/products/' + p.id, body); t.reload(); } catch (e) { alertBox(tr(e.message)); } };
  const catName = id => cats.find(c => c.id === id)?.title || id;
  const View = view === 'grid' ? ProductCards : ProductTable;
  return (
    <>
      {t.data.summary && <ProductSummary m={t.data.summary} />}
      <ListFilter t={t} noun="product" title="Search products" search={{ placeholder: 'Name, brand, part no. or ID', span: 'c4' }} resetSpan="c1"
        selects={[
          { key: 'cat', label: 'Category', all: 'All categories', icon: 'grid', span: 'c3', options: cats.map(c => ({ v: c.id, t: c.title })) },
          { key: 'stock', label: 'Stock', all: 'Any stock', icon: 'box', span: 'c2', options: [{ v: 'low', t: 'Low stock (5 or fewer)' }] },
          { key: 'live', label: 'Visibility', all: 'Live and hidden', icon: 'status', span: 'c2', options: [{ v: '0', t: 'Hidden only' }] },
          { key: 'seo', label: 'SEO', all: 'All', icon: 'status', span: 'c2', options: [{ v: 'low', t: 'Score under 50' }, { v: 'unscored', t: 'Not scored' }, { v: 'noindex', t: 'Noindex' }] }
        ]} />
      <Toolbar t={t} search={false}>{!canWrite && <span className="ro-note" title={tr('Only an Admin or the Master Admin can change products')}>👁 {tr('View only')}</span>}<ViewToggle view={view} setView={setView} /></Toolbar>
      <View t={t} patch={patch} catName={catName} setEdit={setEdit} canWrite={canWrite} />
      <Empty t={t} /><Pager t={t} />
      {edit && <Editor product={edit} cats={cats} onClose={() => setEdit(null)} onSaved={t.reload} />}
    </>
  );
}
