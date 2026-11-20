import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Summary, ViewToggle, confirmBox, useView } from '../../ui.jsx';
import { readFileAsDataUrl as readFile } from '../../hooks/download.js';
import { useApiData } from '../../hooks/useApiData.js';
import { CategoryForm } from './CategoryForm.jsx';
import { CategoryCard } from './CategoryCard.jsx';
import { DeleteRedirectModal } from '../seo/redirects/DeleteRedirectModal.jsx';
import '../seo/redirects/redirects.css';
import './catalogPage.css';

/** Categories page: summary, tiles (grid or list) and the add / edit form. */
export function Categories({ onChanged }) {
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
    if (!(await confirmBox('Remove the picture of “' + c.title + '”? The store goes back to the automatic picture.', { danger: true, confirmLabel: 'Remove picture' }))) return;
    setErr(''); setBusy(c.id);
    try { await adm.put('/categories/' + c.id, { image: '' }); await refresh(); } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const remove = async c => {
    if (!(await confirmBox('Delete the category “' + c.title + '”? It has no products. This cannot be undone.', { danger: true, confirmLabel: 'Delete category' }))) return;
    setErr('');
    try { await adm.del('/categories/' + c.id); await refresh(); setGone(c); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <Summary items={[
        ['Categories', rows.length, 'product groups', 'blue', 'tag'],
        ['Visible', rows.filter(c => !c.hidden).length, 'shown on the store', 'green', 'check'],
        ['Hidden', rows.filter(c => c.hidden).length, 'not on the store', 'amber', 'alert'],
        ['Products', rows.reduce((t, c) => t + (c.total || 0), 0), 'in all categories', 'violet', 'box']
      ]} />
      {err && <div className="a-msg err">{err}</div>}
      <div className="a-bar"><b>{rows.length} categories</b><span className="info">Click a picture to change it</span><button type="button" className="a-btn sm grad" onClick={() => setForm('new')}>＋ Add category</button><ViewToggle view={view} setView={setView} /></div>
      <div className={'vw cats acat-grid ' + view}>
        {rows.map(c => (
          <CategoryCard key={c.id} c={c} busy={busy === c.id} onPick={file => pick(c, file)} onEdit={() => setForm(c)} onRemove={() => remove(c)} onClearPicture={() => clear(c)} onToggle={() => toggle(c)} />
        ))}
      </div>
      {gone && <DeleteRedirectModal source={'/shop/' + gone.id} what={'Category “' + gone.title + '” deleted'} onClose={() => setGone(null)} />}
      {form && <CategoryForm cat={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={refresh} />}
    </>
  );
}
