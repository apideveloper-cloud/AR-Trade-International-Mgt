import { ListEditor } from './ListEditor.jsx';
import { SLIDE_FIELDS } from './contentConfig.js';
import { lbl } from './shared.js';

const slideName = s => (s.type === 'image' ? (s.alt || 'banner') : (s.title || 'text slide'));

/** Home slider tab: order preview strip, seconds per slide and the slide list. */
export function SlidesPanel({ data, set, saveBar }) {
  return <>
    <div className="cx-strip" aria-label="Slide order preview">
      {data.slides.map((s, i) => <div key={i} className={'cx-th' + (s.on === false ? ' off' : '')} title={slideName(s)} style={{ backgroundImage: `url('${s.type === 'image' ? s.img : s.pic}')` }}><em>{i + 1}</em></div>)}
      <label style={{ ...lbl, maxWidth: 200, marginLeft: 'auto' }}>Seconds per slide<input className="a-input" type="number" min="2" max="30" step="0.5" value={data.slideSecs ?? 5.5} onChange={e => set('slideSecs', e.target.value)} /></label>
    </div>
    <ListEditor items={data.slides} setItems={fn => set('slides', fn)} fields={SLIDE_FIELDS} max={12} title={(s, i) => `Slide ${i + 1} · ${slideName(s)}`} blank={() => ({ on: true, type: 'image', img: '', alt: '', href: '#/shop/all' })} />
    {saveBar(['slides', 'slideSecs'])}
  </>;
}

/** Brand logos tab. */
export function BrandsPanel({ data, set, saveBar }) {
  return <>
    <ListEditor tiles items={data.brands} setItems={fn => set('brands', fn)} max={40} title={b => b.n || 'New brand'} blank={{ n: '', src: '' }}
      fields={[{ k: 'n', label: 'Brand name' }, { k: 'src', type: 'image', label: 'Logo', folder: 'brands' }]} />
    {saveBar(['brands'])}
  </>;
}

/** Client logos tab (stored as a plain list of image links, edited as {src} items). */
export function ClientsPanel({ data, set, saveBar }) {
  const wrap = a => a.map(c => ({ src: c }));
  return <>
    <ListEditor tiles items={wrap(data.clients || [])} setItems={fn => set('clients', a => fn(wrap(a)).map(x => x.src))} max={80} title={(c, i) => `Client logo ${i + 1}`} blank={{ src: '' }}
      fields={[{ k: 'src', type: 'image', label: 'Logo', folder: 'clients' }]} />
    {saveBar(['clients'])}
  </>;
}

/** Home highlights (perks) tab. */
export function PerksPanel({ data, set, saveBar }) {
  return <>
    <ListEditor items={data.perks} setItems={fn => set('perks', fn)} max={8} title={p => p.t || 'Highlight'} blank={{ ic: '✓', t: '', d: '' }}
      fields={[{ k: 'ic', label: 'Icon (a symbol)' }, { k: 't', label: 'Title' }, { k: 'd', label: 'Description', wide: true }]} />
    {saveBar(['perks'])}
  </>;
}
