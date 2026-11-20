import { useEffect, useRef, useState } from 'react';
import { adm, useTable } from '../../adminApi.js';
import { Summary, Modal, Toolbar, Pager, alertBox } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { useBusy } from '../../hooks/useBusy.js';
import SeoItemEditor from '../../seoItem/SeoItemEditor.jsx';
import { PRODUCT_FILTERS, PRODUCT_SORTS, postJson, exportSeoCsv } from './seoModel.js';
import { ProductsTable } from './products/ProductsTable.jsx';
import { BulkBar } from './products/BulkBar.jsx';
import { SelectBanner } from './products/SelectBanner.jsx';
import { ImportModal } from './products/ImportModal.jsx';
import { useBulk } from './products/useBulk.jsx';
import './products/products.css';

// [title, count key, sub text, tone, icon, filter it sets]
const TILES = [
  ['No custom meta title', 'missingTitle', 'the template writes it', 'amber', 'alert', 'missing_title'],
  ['No custom meta description', 'missingDesc', 'the template writes it', 'amber', 'alert', 'missing_desc'],
  ['Score under 50', 'lowScore', 'needs work', 'red', 'alert', 'low_score'],
  ['Missing GTIN', 'missingGtin', 'no barcode number', 'violet', 'tag', 'missing_gtin'],
  ['Images without alt', 'altMissing', 'products', 'blue', 'image', 'alt_missing'],
  ['Noindex', 'noindex', 'hidden from Google', 'red', 'box', 'noindex'],
  ['Not scored yet', 'unscored', 'recalculate to score', 'blue', 'clock', 'unscored']
];

/** The Products tab of Admin > SEO: list with SEO columns, filters, bulk actions and CSV export / import. */
export function ProductsTab({ initialFilter = 'all' }) {
  const t = useTable('/seo/products', { cat: '', filter: initialFilter, sort: 'id', dir: 'desc' });
  const [cats, setCats] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [all, setAll] = useState(false);
  const [edit, setEdit] = useState(null);
  const [pre, setPre] = useState(null);
  const [busy, run] = useBusy();
  const file = useRef(null);
  const clear = () => { setSel(new Set()); setAll(false); };
  const bulk = useBulk(() => { clear(); t.reload(); });
  const { params, data } = t;
  const rows = data.rows || [];
  useEffect(() => { adm.get('/categories').then(r => setCats(r.map(c => ({ v: c.id, t: c.title })))).catch(() => {}); }, []);
  useEffect(clear, [params.q, params.cat, params.filter]);

  const toggle = id => { setAll(false); setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const pageOn = rows.length > 0 && rows.every(r => sel.has(r.id));
  const togglePage = () => { setAll(false); setSel(s => { const n = new Set(s); rows.forEach(r => (pageOn ? n.delete(r.id) : n.add(r.id))); return n; }); };
  const scope = { filter: params.filter || 'all', q: params.q || '', cat: params.cat || '' };
  const count = all ? data.total : sel.size;
  const act = (action, label) => bulk.start(action, label, all ? { scope } : { ids: [...sel] });
  const doExport = () => run(async () => { try { await exportSeoCsv(scope); } catch (e) { alertBox(e.message); } });
  const pick = e => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    run(async () => {
      const csv = await f.text();
      const r = await postJson('/seo/import/preview', { csv });
      if (r.ok) setPre({ csv, data: r.data }); else alertBox(r.error);
    });
  };
  const tileClick = e => {
    const k = e.target.closest('.kpi');
    if (k) t.set({ filter: TILES[[...k.parentNode.children].indexOf(k)][5] });
  };

  return (
    <div className="adpt">
      {data.summary && <div className="adpt-sum" onClick={tileClick}><Summary items={TILES.map(([a, k, c, d, e]) => [a, data.summary[k] ?? 0, c, d, e])} /></div>}
      <ListFilter t={t} noun="product" title="Search products" search={{ placeholder: 'Name, SKU or brand', span: 'c4' }} resetSpan="c1"
        selects={[
          { key: 'cat', label: 'Category', all: 'All categories', icon: 'grid', span: 'c3', options: cats },
          { key: 'filter', label: 'Show', all: PRODUCT_FILTERS[0][1], icon: 'status', span: 'c3', options: PRODUCT_FILTERS.slice(1).map(([v, l]) => ({ v, t: l })) },
          { key: 'sort', label: 'Sort by', all: PRODUCT_SORTS[0][1], icon: 'tag', span: 'c2', options: PRODUCT_SORTS.slice(1).map(([v, l]) => ({ v, t: l })) },
          { key: 'dir', label: 'Direction', all: 'Descending', icon: 'tag', span: 'c2', options: [{ v: 'asc', t: 'Ascending' }] }
        ]} />
      <Toolbar t={t} search={false}>
        <button type="button" className="a-btn ghost sm" disabled={busy} onClick={doExport}>Export CSV</button>
        <button type="button" className="a-btn ghost sm" disabled={busy} onClick={() => file.current?.click()}>Import CSV</button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={pick} />
      </Toolbar>
      <BulkBar count={count} bulk={bulk} onAction={act} onAll={() => bulk.start('recalculate', 'Recalculate ALL scores', { scope: { filter: 'all', q: '', cat: '' } })} />
      <SelectBanner pageCount={rows.length} total={data.total} all={all} pageSelected={pageOn} onAll={() => setAll(true)} onClear={clear} />
      {t.error && <div className="a-empty">{t.error}</div>}
      <ProductsTable rows={rows} loading={t.loading} sel={all ? new Set(rows.map(r => r.id)) : sel} onToggle={toggle} onPage={togglePage} onEdit={setEdit} />
      <Pager t={t} />
      {edit && (
        <Modal kicker="Product SEO" title={edit.name} onClose={() => { setEdit(null); t.reload(); }} onSubmit={e => e.preventDefault()}>
          <div className="adpt-body"><SeoItemEditor type="product" id={edit.id} mode="full" onChanged={() => t.reload()} /></div>
        </Modal>
      )}
      {pre && <ImportModal pre={pre} onClose={() => setPre(null)} onDone={() => t.reload()} />}
    </div>
  );
}
