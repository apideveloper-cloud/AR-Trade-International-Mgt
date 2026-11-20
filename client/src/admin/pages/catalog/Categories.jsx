import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Summary, ViewToggle, confirmBox, useView } from '../../ui.jsx';
import { readFileAsDataUrl as readFile } from '../../hooks/download.js';
import { useApiData } from '../../hooks/useApiData.js';
import { CategoryForm } from './CategoryForm.jsx';
import { CategoryCard } from './CategoryCard.jsx';
import { DeleteRedirectModal } from '../seo/redirects/DeleteRedirectModal.jsx';
import '../seo/redirects/redirects.css';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';
import './catalogPage.css';

/** Categories page: summary, tiles (grid or list) and the add / edit form. */
export function Categories({ onChanged }) {
  const tr = useT();
  const list = useApiData(() => adm.get('/categories'), [], []);
  const rows = list.data, load = list.reload;
  const [view, setView] = useView('categories', 'grid');
  const [busy, setBusy] = useState('');
  const [actionErr, setErr] = useState('');
  const err = actionErr || list.error;
  const [gone, setGone] = useState(null); // the category just deleted: offer a redirect from its old address
  const [form, setForm] = useState(null); // 'new', or the category being edited
  const refresh = async () => { await load(); onChanged?.(); };
  const toggle = async c => {
    try { await adm.put('/categories/' + c.id, { hidden: !c.hidden }); await refresh(); } catch (e) { setErr(e.message); }
  };
  const pick = async (c, file) => {
    if (!file) return;
    setErr(''); setBusy(c.id);
    try {
      const up = await adm.post('/upload-image', { folder: 'site/categories', name: c.id + '-' + file.name, data: await readFile(file) });
      await adm.put('/categories/' + c.id, { image: up.url });
      await refresh();
    } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const clear = async c => {
    if (!(await confirmBox(tr('Remove the picture of “{name}”? The store goes back to the automatic picture.', { name: c.title }), { danger: true, confirmLabel: tr('Remove picture') }))) return;
    setErr(''); setBusy(c.id);
    try { await adm.put('/categories/' + c.id, { image: '' }); await refresh(); } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const remove = async c => {
    if (!(await confirmBox(tr('Delete the category “{name}”? It has no products. This cannot be undone.', { name: c.title }), { danger: true, confirmLabel: tr('Delete category') }))) return;
    setErr('');
    try { await adm.del('/categories/' + c.id); await refresh(); setGone(c); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <Summary items={[
        [tr('Categories'), rows.length, tr('product groups'), 'blue', 'tag'],
        [tr('Visible'), rows.filter(c => !c.hidden).length, tr('shown on the store'), 'green', 'check'],
        [tr('Hidden'), rows.filter(c => c.hidden).length, tr('not on the store'), 'amber', 'alert'],
        [tr('Products'), rows.reduce((t, c) => t + (c.total || 0), 0), tr('in all categories'), 'violet', 'box']
      ]} />
      {err && <div className="a-msg err">{tr(err)}</div>}
      <div className="a-bar"><b>{tr('{n} categories', { n: rows.length })}</b><span className="info">{tr('Click a picture to change it')}</span><button type="button" className="a-btn sm grad" onClick={() => setForm('new')}>{tr('＋ Add category')}</button><ViewToggle view={view} setView={setView} /></div>
      <div className={'vw cats acat-grid ' + view}>
        {rows.map(c => (
          <CategoryCard key={c.id} c={c} busy={busy === c.id} onPick={file => pick(c, file)} onEdit={() => setForm(c)} onRemove={() => remove(c)} onClearPicture={() => clear(c)} onToggle={() => toggle(c)} />
        ))}
      </div>
      {gone && <DeleteRedirectModal source={'/shop/' + gone.id} what={tr('Category “{name}” deleted', { name: gone.title })} onClose={() => setGone(null)} />}
      {form && <CategoryForm cat={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={refresh} />}
    </>
  );
}
