import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Drawer, Modal, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Chip, Fact, Grid, Notice, fDate, taka } from '../../fieldKit.jsx';
import { useInv, useSaveForm, Foot, ProdThumb } from './shared.jsx';

/** Correct a product's stock to the quantity really counted. */
function AdjustForm({ product, onClose, onSaved }) {
  const [counted, setCounted] = useState(product.stock); const [note, setNote] = useState('');
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  return (
    <Modal narrow kicker="Stock count" title="Correct the stock" onClose={onClose} onSubmit={submit(() => invApi.post('/stock/adjust', { productId: product.id, counted, note }))} footer={<Foot onClose={onClose} busy={busy} label="Save count" />}>
      <div className="iv-form"><Notice err={err} />
        <b>{product.name}</b><small className="fd-sub">The system shows {product.stock}. Enter the quantity you really counted on the shelf.</small>
        <label className="a-lbl">Counted quantity<input className="a-input" type="number" min="0" required value={counted} onChange={e => setCounted(e.target.value)} /></label>
        <label className="a-lbl">Reason<input className="a-input" required value={note} onChange={e => setNote(e.target.value)} placeholder="Monthly count, found in another rack…" /></label>
      </div>
    </Modal>
  );
}
const KIND_TONE = { Purchase: 'ok', Damage: 'bad', Return: 'amber', Adjust: 'blue' };
/** One product: facts, count button and its recorded stock movements. */
function StockDrawer({ p, canEdit, onClose, onChanged }) {
  const m = useInv('/stock/' + p.id + '/moves'); const [adj, setAdj] = useState(false);
  return (
    <Drawer title={p.name} sub={`In stock: ${p.stock}`} onClose={onClose}>
      <div className="fd-facts"><Fact k="Brand">{p.brand}</Fact><Fact k="Selling price">{taka(p.price)}</Fact><Fact k="Last buying price">{p.lastCost ? taka(p.lastCost) : '—'}</Fact><Fact k="In stock">{p.stock}</Fact></div>
      {canEdit && <div className="fd-apa"><button type="button" className="a-mini ok" onClick={() => setAdj(true)}>Count / correct stock</button></div>}
      <h4 className="iv-h">Recorded movements</h4>
      <div className="iv-led">
        <div className="iv-lrow head m"><span>When</span><span>What</span><span>Qty</span><span>Stock after</span></div>
        {(m.data?.items || []).map(x => <div key={x.id} className="iv-lrow m"><span>{fDate(x.at)}</span><span><Chip tone={KIND_TONE[x.kind] || 'off'}>{x.kind}</Chip> <span className="mono">{x.ref}</span><small>{x.note}{x.by ? ' · ' + x.by : ''}</small></span><b className={x.qty < 0 ? 'iv-out' : 'iv-in'}>{x.qty > 0 ? '+' : ''}{x.qty}</b><span>{x.balance}</span></div>)}
        {m.data && !m.data.items.length && <div className="a-empty">No movements recorded here yet. Purchases, damage, returns and counts made on these pages appear in this list.</div>}
      </div>
      {adj && <AdjustForm product={p} onClose={() => setAdj(false)} onSaved={() => { m.reload(); onChanged(); }} />}
    </Drawer>
  );
}
/** Stock page: summary, filters and the stock grid. */
export function InvStock({ staff }) {
  const t = useTable('/stock', { q: '', filter: '', brand: '' }, [], invApi);
  const [open, setOpen] = useState(null);
  const canEdit = can(staff, 'inventory.manage');
  const m = t.data.totals;
  return (
    <>
      <Summary items={[
        ['Products', m?.products ?? '…', `${m?.units?.toLocaleString('en-US') ?? 0} units in stock`, 'blue', 'box'],
        ['Stock value', taka(m?.value), 'at selling price', 'violet', 'tag'],
        ['Low stock', m?.lowCount ?? '…', `${t.data.low ?? 5} or fewer left`, 'amber', 'alert'],
        ['Out of stock', m?.out ?? '…', 'live products with none left', 'red', 'alert']
      ]} />
      <ListFilter t={t} noun="product" title="Search stock" search={{ placeholder: 'Product name, brand or SKU' }}
        selects={[{ key: 'filter', label: 'Stock level', all: 'All products', icon: 'status', options: [{ v: 'low', t: 'Low stock' }, { v: 'out', t: 'Out of stock' }, { v: 'hidden', t: 'Hidden from the shop' }] }, { key: 'brand', label: 'Brand', all: 'All brands', icon: 'tag', options: t.data.brands || [] }]} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Stock</h3><small className="fd-sub">Click a product for its stock history</small></div></div>
        <Grid server={t} cols="44px 56px minmax(240px,2fr) 120px 120px 130px 110px" head={['SL', 'Image', 'Product', 'Brand', 'Selling price', 'Last buying price', 'In stock']} onRow={setOpen} empty="No product matches."
          rows={t.data.rows.map((p, i) => ({ key: p.id, item: p, cells: [slNo(t, i), <ProdThumb key="im" src={p.img} name={p.name} />, <span key="n"><b>{p.name}</b>{!p.active && <small className="iv-subline">hidden from the shop</small>}</span>, p.brand, taka(p.price), p.lastCost ? taka(p.lastCost) : '—', <Chip key="s" tone={p.stock <= 0 ? 'bad' : p.stock <= (t.data.low ?? 5) ? 'amber' : 'ok'}>{p.stock}</Chip>] }))} />
      </section>
      {open && <StockDrawer p={t.data.rows.find(x => x.id === open.id) || open} canEdit={canEdit} onClose={() => setOpen(null)} onChanged={t.reload} />}
    </>
  );
}
