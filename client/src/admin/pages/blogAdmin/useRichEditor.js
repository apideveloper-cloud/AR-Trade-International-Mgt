import { useEffect, useRef, useState } from 'react';
import { adm } from '../../adminApi.js';
import { readFileAsDataUrl as readFile } from '../../hooks/download.js';

/**
 * Shared state of the article / static-page editors: the form `f`, the contentEditable body `ed`,
 * loading of an existing record, image upload (inline image or cover) and the status message.
 * `fromRecord(r)` maps the API record to the form; `folderOf(f)` names the upload folder.
 */
export function useRichEditor({ id, endpoint, initial, fromRecord, folderOf, onLoaded }) {
  const [f, setF] = useState(initial);
  const [loading, setLoading] = useState(!!id);
  const [loadErr, setLoadErr] = useState(false); // the record could not be read: never show an empty form that could overwrite it
  const [busy, setBusy] = useState(false);
  const [upl, setUpl] = useState(false);
  const [msg, setMsg] = useState(null);
  const ed = useRef(null);
  const cb = useRef({});
  cb.current = { fromRecord, onLoaded };

  useEffect(() => {
    if (!id) { if (ed.current) ed.current.innerHTML = '<p><br></p>'; return; }
    let live = true;
    adm.get(endpoint + '/' + id).then(r => {
      if (!live) return;
      setF(cb.current.fromRecord(r));
      if (cb.current.onLoaded) cb.current.onLoaded(r);
      setLoading(false);
      setTimeout(() => { if (live && ed.current) ed.current.innerHTML = r.body; }, 0);
    }).catch(e => { if (!live) return; setMsg({ err: true, t: e.message }); setLoadErr(true); setLoading(false); });
    return () => { live = false; };
  }, [id, endpoint]);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const patch = p => setF(prev => ({ ...prev, ...p }));
  const cmd = (c, v) => { ed.current && ed.current.focus(); document.execCommand(c, false, v || null); };
  const upload = async file => {
    if (!file) return null;
    setUpl(true); setMsg(null);
    try { const r = await adm.post('/upload-image', { folder: folderOf(f), name: file.name, data: await readFile(file) }); return r.url; }
    catch (e) { setMsg({ err: true, t: e.message }); return null; } finally { setUpl(false); }
  };
  const addImage = async e => { const url = await upload(e.target.files[0]); e.target.value = ''; if (url) { ed.current.focus(); document.execCommand('insertHTML', false, `<img src="${url}" alt="">`); } };
  const setCover = async e => { const url = await upload(e.target.files[0]); e.target.value = ''; if (url) set('cover', url); };

  return { f, set, patch, loading, loadErr, busy, setBusy, upl, msg, setMsg, ed, cmd, addImage, setCover };
}
