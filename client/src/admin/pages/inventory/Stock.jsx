import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Drawer, Modal, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Chip, Fact, Grid, Notice, fDate, taka } from '../../fieldKit.jsx';
import { useInv, useSaveForm, Foot, ProdThumb } from './shared.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/inventory.js';

/** Correct a product's stock to the quantity really counted. */
function AdjustForm({ product, onClose, onSaved }) {
  const tr = useT();
  const [counted, setCounted] = useState(product.stock); const [note, setNote] = useState('');
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  return (
    <Modal narrow kicker={tr('Stock count')} title={tr('Correct the stock')} onClose={onClose} onSubmit={submit(() => invApi.post('/stock/adjust', { productId: product.id, counted, note }))} footer={<Foot onClose={onClose} busy={busy} label="Save count" />}>
      <div className="iv-form"><Notice err={err && tr(err)} />
        <b>{product.name}</b><small className="fd-sub">{tr('The system shows {n}. Enter the quantity you really counted on the shelf.', { n: product.stock })}</small>
        <label className="a-lbl">{tr('Counted quantity')}<input className="a-input" type="number" min="0" required value={counted} onChange={e => setCounted(e.target.value)} /></label>
        <label className="a-lbl">{tr('Reason')}<input className="a-input" required value={note} onChange={e => setNote(e.target.value)} placeholder={tr('Monthly count, found in another rack…')} /></label>
      </div>
    </Modal>
  );
}
const KIND_TONE = { Purchase: 'ok', Damage: 'bad', Return: 'amber', Adjust: 'blue' };
/** One product: facts, count button and its recorded stock movements. */
function StockDrawer({ p, canEdit, onClose, onChanged }) {
  const tr = useT();
  const m = useInv('/stock/' + p.id + '/moves'); const [adj, setAdj] = useState(false);
  return (
    <Drawer title={p.name} sub={tr('In stock: {n}', { n: p.stock })} onClose={onClose}>
      <div className="fd-facts"><Fact k={tr('Brand')}>{p.brand}</Fact><Fact k={tr('Selling price')}>{taka(p.price)}</Fact><Fact k={tr('Last buying price')}>{p.lastCost ? taka(p.lastCost) : '—'}</Fact><Fact k={tr('In stock')}>{p.stock}</Fact></div>
      {canEdit && <div className="fd-apa"><button type="button" className="a-mini ok" onClick={() => setAdj(true)}>{tr('Count / correct stock')}</button></div>}
      <h4 className="iv-h">{tr('Recorded movements')}</h4>
      <div className="iv-led">
        <div className="iv-lrow head m"><span>{tr('When')}</span><span>{tr('What')}</span><span>{tr('Qty')}</span><span>{tr('Stock after')}</span></div>
        {(m.data?.items || []).map(x => <div key={x.id} className="iv-lrow m"><span>{fDate(x.at)}</span><span><Chip tone={KIND_TONE[x.kind] || 'off'}>{tr(x.kind)}</Chip> <span className="mono">{x.ref}</span><small>{x.note}{x.by ? ' · ' + x.by : ''}</small></span><b className={x.qty < 0 ? 'iv-out' : 'iv-in'}>{x.qty > 0 ? '+' : ''}{x.qty}</b><span>{x.balance}</span></div>)}
        {m.data && !m.data.items.length && <div className="a-empty">{tr('No movements recorded here yet. Purchases, damage, returns and counts made on these pages appear in this list.')}</div>}
      </div>
      {adj && <AdjustForm product={p} onClose={() => setAdj(false)} onSaved={() => { m.reload(); onChanged(); }} />}
    </Drawer>
  );
}
/** Stock page: summary, filters and the stock grid. */
export function InvStock({ staff }) {
  const tr = useT();
  const t = useTable('/stock', { q: '', filter: '', brand: '' }, [], invApi);
  const [open, setOpen] = useState(null);
  const canEdit = can(staff, 'inventory.manage');
  const m = t.data.totals;
  return (
    <>
      <Summary items={[
        [tr('Products'), m?.products ?? '…', tr('{n} units in stock', { n: m?.units?.toLocaleString('en-US') ?? 0 }), 'blue', 'box'],
        [tr('Stock value'), taka(m?.value), tr('at selling price'), 'violet', 'tag'],
        [tr('Low stock'), m?.lowCount ?? '…', tr('{n} or fewer left', { n: t.data.low ?? 5 }), 'amber', 'alert'],
        [tr('Out of stock'), m?.out ?? '…', tr('live products with none left'), 'red', 'alert']
      ]} />
      <ListFilter t={t} noun="product" title="Search stock" search={{ placeholder: 'Product name, brand or SKU' }}
        selects={[{ key: 'filter', label: 'Stock level', all: 'All products', icon: 'status', options: [{ v: 'low', t: 'Low stock' }, { v: 'out', t: 'Out of stock' }, { v: 'hidden', t: 'Hidden from the shop' }] }, { key: 'brand', label: 'Brand', all: 'All brands', icon: 'tag', options: t.data.brands || [] }]} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error && tr(t.error)} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>{tr('Stock')}</h3><small className="fd-sub">{tr('Click a product for its stock history')}</small></div></div>
        <Grid server={t} cols="44px 56px minmax(240px,2fr) 120px 120px 130px 110px" head={['SL', 'Image', 'Product', 'Brand', 'Selling price', 'Last buying price', 'In stock'].map(h => tr(h))} onRow={setOpen} empty={tr('No product matches.')}
          rows={t.data.rows.map((p, i) => ({ key: p.id, item: p, cells: [slNo(t, i), <ProdThumb key="im" src={p.img} name={p.name} />, <span key="n"><b>{p.name}</b>{!p.active && <small className="iv-subline">{tr('hidden from the shop')}</small>}</span>, p.brand, taka(p.price), p.lastCost ? taka(p.lastCost) : '—', <Chip key="s" tone={p.stock <= 0 ? 'bad' : p.stock <= (t.data.low ?? 5) ? 'amber' : 'ok'}>{p.stock}</Chip>] }))} />
      </section>
      {open && <StockDrawer p={t.data.rows.find(x => x.id === open.id) || open} canEdit={canEdit} onClose={() => setOpen(null)} onChanged={t.reload} />}
    </>
  );
}
