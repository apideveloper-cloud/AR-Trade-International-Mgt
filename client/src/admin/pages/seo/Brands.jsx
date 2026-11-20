import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Summary, Modal, alertBox } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import SeoItemEditor from '../../seoItem/SeoItemEditor.jsx';
import { BrandsTable } from './BrandsTable.jsx';
import './brands.css';

/** The Brands tab of Admin > SEO. */
export function Brands() {
  const q = useApiData(() => adm.get('/seo/brands'));
  const [edit, setEdit] = useState(null);
  const [busySlug, setBusySlug] = useState('');
  const rows = q.data?.rows || [];
  const hidden = rows.filter(b => b.hidden).length;
  const thin = rows.filter(b => !b.hidden && !b.indexable).length;
  const indexed = rows.filter(b => !b.hidden && b.indexable).length;

  const toggle = async b => {
    setBusySlug(b.slug);
    try {
      await adm.put('/seo/brands/' + encodeURIComponent(b.slug), { hidden: !b.hidden });
      q.setData(d => ({ ...d, rows: d.rows.map(r => (r.slug === b.slug ? { ...r, hidden: !b.hidden } : r)) }));
    } catch (e) { alertBox(e.message); }
    setBusySlug('');
  };

  return (
    <div>
      <p className="adbr-intro">Brand names come from the Brand field of each product. A brand with fewer than 3 products is marked noindex and left out of the sitemap. Hidden brands have no public page.</p>
      <Summary items={[['Brands', rows.length, 'all', 'blue', 'tag'], ['Indexed', indexed, '3 or more products', 'green', 'check'], ['Thin', thin, 'noindex', 'amber', 'alert'], ['Hidden', hidden, 'no public page', 'red', 'box']]} />
      {q.error && <div className="a-empty">{q.error}</div>}
      {q.loading && !q.data && <span className="spin" />}
      {q.data && <BrandsTable rows={rows} busySlug={busySlug} onEdit={setEdit} onToggle={toggle} />}
      {edit && (
        <Modal kicker="Brand SEO" title={edit.name} onClose={() => { setEdit(null); q.reload(); }} onSubmit={e => e.preventDefault()}>
          <div className="adbr-body"><SeoItemEditor type="brand" id={edit.slug} mode="full" onChanged={() => q.reload()} /></div>
        </Modal>
      )}
    </div>
  );
}
