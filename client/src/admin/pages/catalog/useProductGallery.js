import { adm } from '../../adminApi.js';
import { readFileAsDataUrl as readFile } from '../../hooks/download.js';

/** Image actions of the product form (state lives in the form): upload up to 8 pictures, remove one, make one the main picture.
 *  Pictures go to the server (uploads/products/<category>/), never into the database. */
export function useProductGallery(f, setF, setErr, setBusy) {
  const upload = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setErr(''); setBusy(true);
    try {
      const added = [];
      for (const file of files.slice(0, 8)) {
        const r = await adm.post('/upload-image', { folder: 'products/' + (f.cat || 'general'), name: file.name, data: await readFile(file) });
        added.push(r.url);
      }
      setF(s => { const g = [...(s.gallery || []), ...added]; return { ...s, gallery: g, img: s.img || g[0] }; });
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  const removeImg = u => setF(s => { const g = (s.gallery || []).filter(x => x !== u); return { ...s, gallery: g, img: s.img === u ? g[0] || '' : s.img }; });
  const makeMain = u => setF(s => ({ ...s, img: u, gallery: [u, ...(s.gallery || []).filter(x => x !== u)] }));
  return { upload, removeImg, makeMain };
}
