import { ListEditor } from './ListEditor.jsx';
import { SLIDE_FIELDS } from './contentConfig.js';
import { lbl } from './shared.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';

const slideName = (s, tr = x => x) => (s.type === 'image' ? (s.alt || tr('banner')) : (s.title || tr('text slide')));

/** Home slider tab: order preview strip, seconds per slide and the slide list. */
export function SlidesPanel({ data, set, saveBar }) {
  const tr = useT();
  return <>
    <div className="cx-strip" aria-label={tr('Slide order preview')}>
      {data.slides.map((s, i) => <div key={i} className={'cx-th' + (s.on === false ? ' off' : '')} title={slideName(s, tr)} style={{ backgroundImage: `url('${s.type === 'image' ? s.img : s.pic}')` }}><em>{i + 1}</em></div>)}
      <label style={{ ...lbl, maxWidth: 200, marginLeft: 'auto' }}>{tr('Seconds per slide')}<input className="a-input" type="number" min="2" max="30" step="0.5" value={data.slideSecs ?? 5.5} onChange={e => set('slideSecs', e.target.value)} /></label>
    </div>
    <ListEditor items={data.slides} setItems={fn => set('slides', fn)} fields={SLIDE_FIELDS} max={12} title={(s, i) => tr('Slide {n} · {name}', { n: i + 1, name: slideName(s, tr) })} blank={() => ({ on: true, type: 'image', img: '', alt: '', href: '#/shop/all' })} />
    {saveBar(['slides', 'slideSecs'])}
  </>;
}

/** Brand logos tab. */
export function BrandsPanel({ data, set, saveBar }) {
  const tr = useT();
  return <>
    <ListEditor tiles items={data.brands} setItems={fn => set('brands', fn)} max={40} title={b => b.n || tr('New brand')} blank={{ n: '', src: '' }}
      fields={[{ k: 'n', label: 'Brand name' }, { k: 'src', type: 'image', label: 'Logo', folder: 'brands' }]} />
    {saveBar(['brands'])}
  </>;
}

/** Client logos tab (stored as a plain list of image links, edited as {src} items). */
export function ClientsPanel({ data, set, saveBar }) {
  const tr = useT();
  const wrap = a => a.map(c => ({ src: c }));
  return <>
    <ListEditor tiles items={wrap(data.clients || [])} setItems={fn => set('clients', a => fn(wrap(a)).map(x => x.src))} max={80} title={(c, i) => tr('Client logo {n}', { n: i + 1 })} blank={{ src: '' }}
      fields={[{ k: 'src', type: 'image', label: 'Logo', folder: 'clients' }]} />
    {saveBar(['clients'])}
  </>;
}

/** Home highlights (perks) tab. */
export function PerksPanel({ data, set, saveBar }) {
  const tr = useT();
  return <>
    <ListEditor items={data.perks} setItems={fn => set('perks', fn)} max={8} title={p => p.t || tr('Highlight')} blank={{ ic: '✓', t: '', d: '' }}
      fields={[{ k: 'ic', label: 'Icon (a symbol)' }, { k: 't', label: 'Title' }, { k: 'd', label: 'Description', wide: true }]} />
    {saveBar(['perks'])}
  </>;
}
