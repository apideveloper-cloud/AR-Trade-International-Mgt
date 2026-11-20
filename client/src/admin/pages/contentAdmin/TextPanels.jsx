import { Field } from './Field.jsx';
import { ListEditor } from './ListEditor.jsx';
import { fieldGrid, lbl, stackGrid, wideGrid } from './shared.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';

const policyFields = [{ k: 't', label: 'Title' }, { k: 'k', label: 'Web address key (e.g. privacy)' }];
const AREA_KEYS = ['intro', 'mdMessage', 'vision', 'mission'];
const ABOUT_FIELDS = [['heading', 'Page heading'], ['intro', 'Introduction'], ['mdMessage', 'Managing Director message'], ['mdName', 'Managing Director name'], ['mdTitle', 'Managing Director title'], ['vision', 'Vision'], ['mission', 'Mission']];
const MENUS = [['hot', 'Hot Products dropdown'], ['services', 'Our Services dropdown'], ['blog', 'Blog dropdown'], ['about', 'Footer "About us" column']];
const FOOTER_FIELDS = [['tagline', 'Footer description'], ['hours', 'Opening hours'], ['mobileBanking', 'Contact page: mobile banking line'], ['email2', 'Contact page: second email']];
const menuItems = list => (list || []).map(i => ({ t: i.t, link: i.href || i.to || '' }));

/** FAQs tab. */
export function FaqsPanel({ data, set, saveBar }) {
  const tr = useT();
  return <>
    <ListEditor items={data.faqs} setItems={fn => set('faqs', fn)} max={40} title={f => f.q || tr('New question')} blank={{ q: '', a: '' }}
      fields={[{ k: 'q', label: 'Question', wide: true }, { k: 'a', type: 'area', label: 'Answer (you can use {phone} for the store phone)', rows: 3 }]} />
    {saveBar(['faqs'])}
  </>;
}

/** Policies tab: title/key plus a section list per policy page. */
export function PoliciesPanel({ data, set, saveBar }) {
  const tr = useT();
  const patch = (pi, fn) => set('policies', a => a.map((x, j) => (j === pi ? fn(x) : x)));
  return <>
    {data.policies.map((p, pi) => (
      <div key={pi} style={{ border: '1px solid #e4e2dc', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={fieldGrid}>
          {policyFields.map(f => <Field key={f.k} f={f} item={p} set={(k, v) => patch(pi, x => ({ ...x, [k]: v }))} />)}
        </div>
        <ListEditor items={p.secs} setItems={fn => patch(pi, x => ({ ...x, secs: fn(x.secs) }))} max={30} title={(s, i) => tr('Section {n} · {name}', { n: i + 1, name: s.h || '' })} blank={{ h: '', p: '' }}
          fields={[{ k: 'h', label: 'Heading', wide: true }, { k: 'p', type: 'area', label: 'Text', rows: 3 }]} />
      </div>
    ))}
    {saveBar(['policies'])}
  </>;
}

/** About page tab: texts, numbers and "why choose us" cards. */
export function AboutPanel({ data, set, saveBar }) {
  const tr = useT();
  const setAbout = (k, v) => set('about', a => ({ ...a, [k]: v }));
  return <>
    <h4 className="cx-h">{tr('Introduction')}</h4>
    <div style={stackGrid}>
      {ABOUT_FIELDS.map(([k, l]) => (
        <label key={k} style={lbl}>{tr(l)}{AREA_KEYS.includes(k) ? <textarea className="a-input" rows={3} value={data.about[k] || ''} onChange={e => setAbout(k, e.target.value)} /> : <input className="a-input" value={data.about[k] || ''} onChange={e => setAbout(k, e.target.value)} />}</label>
      ))}
    </div>
    <h4 className="cx-h">{tr('Numbers')}</h4>
    <ListEditor items={data.stats} setItems={fn => set('stats', fn)} max={8} title={s => `${s.v} ${s.t}`} blank={{ v: '', t: '' }} fields={[{ k: 'v', label: 'Number (e.g. 2011)' }, { k: 't', label: 'Caption' }]} />
    <h4 className="cx-h">{tr('Why choose us')}</h4>
    <ListEditor items={data.whys} setItems={fn => set('whys', fn)} max={12} title={w => w.t || tr('New card')} blank={{ t: '', d: '' }} fields={[{ k: 't', label: 'Title' }, { k: 'd', type: 'area', label: 'Description', rows: 2 }]} />
    {saveBar(['about', 'stats', 'whys'])}
  </>;
}

/** Menus and footer tab: link lists (stored as {t, to}) and footer texts. */
export function MenusPanel({ data, set, saveBar }) {
  const tr = useT();
  return <>
    {MENUS.map(([k, title]) => (
      <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 className="cx-h">{tr(title)}</h4>
        <ListEditor items={menuItems(data.menus[k])} max={20} title={i => i.t || tr('New link')} blank={{ t: '', link: '' }}
          setItems={fn => set('menus', m => ({ ...m, [k]: fn(menuItems(m[k])).map(i => ({ t: i.t, to: i.link })) }))}
          fields={[{ k: 't', label: 'Text' }, { k: 'link', label: 'Link (/shop/toner, /blog or https://…)' }]} />
      </div>
    ))}
    <h4 className="cx-h">{tr('Footer and contact page texts')}</h4>
    <div style={stackGrid}>
      {FOOTER_FIELDS.map(([k, l]) => <label key={k} style={lbl}>{tr(l)}<input className="a-input" value={data.footer[k] || ''} onChange={e => set('footer', f => ({ ...f, [k]: e.target.value }))} /></label>)}
    </div>
    {saveBar(['menus', 'footer'])}
  </>;
}

/** Texts and links tab: social links, section titles, block toggles and search hints. */
export function GeneralPanel({ data, set, saveBar }) {
  const tr = useT();
  return <>
    <h4 className="cx-h">{tr('Social links')}</h4>
    <div style={wideGrid}>
      {['facebook', 'instagram', 'linkedin', 'youtube', 'x'].map(k => <label key={k} style={lbl}>{k[0].toUpperCase() + k.slice(1)}<input className="a-input" value={data.social?.[k] || ''} onChange={e => set('social', s => ({ ...s, [k]: e.target.value }))} placeholder="https://…" /></label>)}
    </div>
    <h4 className="cx-h">{tr('Section titles on the home page')}</h4>
    <div style={wideGrid}>
      {Object.keys(data.labels || {}).map(k => <label key={k} style={lbl}>{k}<input className="a-input" value={data.labels[k]} onChange={e => set('labels', l => ({ ...l, [k]: e.target.value }))} /></label>)}
    </div>
    <h4 className="cx-h">{tr('Home page blocks (show / hide)')}</h4>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {Object.keys(data.sections || {}).map(k => <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={!!data.sections[k]} onChange={e => set('sections', s => ({ ...s, [k]: e.target.checked }))} />{k}</label>)}
    </div>
    <label style={lbl}>{tr('Search-box typing hints (one per line)')}<textarea className="a-input" rows={5} value={(data.words || []).join('\n')} onChange={e => set('words', e.target.value.split('\n'))} /></label>
    {saveBar(['social', 'labels', 'sections', 'words'])}
  </>;
}
