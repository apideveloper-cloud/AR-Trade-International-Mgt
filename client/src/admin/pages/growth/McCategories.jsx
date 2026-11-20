import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { Switch } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { send, mcMsg, TAXONOMY_URL } from './mcApi.js';

/** C. Category mapping, exclusions and the feed settings. */
export default function McCategories({ settings, canEdit, onSaved }) {
  const q = useApiData(() => adm.get('/growth/merchant/categories'), []);
  const [map, setMap] = useState({});
  const [ex, setEx] = useState({});
  const [s, setS] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    const a = {}, b = {};
    (q.data.rows || []).forEach(r => { a[r.id] = r.google || ''; b[r.id] = !!r.excluded; });
    setMap(a); setEx(b);
  }, [q.data]);
  useEffect(() => { if (settings) setS(x => x || { skipSmallImages: !!settings.skipSmallImages, minImagePx: settings.minImagePx || 800, contentLanguage: settings.contentLanguage || 'en', feedLabel: settings.feedLabel || 'BD' }); }, [settings]);
  if (q.error) return <Section title="Categories"><Msg m={{ ok: false, text: q.error }} /></Section>;
  if (!s) return null;
  const set = p => setS(x => ({ ...x, ...p }));
  const save = async () => {
    const px = Number(s.minImagePx);
    if (!Number.isInteger(px) || px < 100 || px > 4000) return setM({ ok: false, text: 'Smallest picture size: type a whole number from 100 to 4000.' });
    if (!/^[a-z]{2}$/i.test(s.contentLanguage)) return setM({ ok: false, text: 'Language: use 2 letters, for example en.' });
    if (!/^[a-z]{2}$/i.test(s.feedLabel)) return setM({ ok: false, text: 'Country: use 2 letters, for example BD.' });
    const categoryMap = {};
    Object.entries(map).forEach(([id, v]) => { if (String(v).trim()) categoryMap[id] = String(v).trim(); });
    setBusy(true);
    const r = await send('/growth/merchant/settings', { ...s, minImagePx: px, contentLanguage: s.contentLanguage.toLowerCase(), feedLabel: s.feedLabel.toUpperCase(), categoryMap, excludedCategories: Object.keys(ex).filter(k => ex[k]).map(k => (isNaN(k) ? k : Number(k))) });
    setBusy(false);
    setM(mcMsg(r, 'Saved. The feed will use these settings.'));
    if (r.ok) onSaved();
  };
  const dis = !canEdit;
  return (
    <Section id="admc-cats" title="Categories and feed settings" what="Tell Google which Google product category each of your categories belongs to. Google shows your products to the right shoppers this way.">
      <p className="adseo-hint"><a href={TAXONOMY_URL} target="_blank" rel="noreferrer">Check this against Google's product category list</a></p>
      {dis && <p className="adseo-hint">Only people who can manage products can change these.</p>}
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>Your category</th><th>Products</th><th>Google category (number or full name)</th><th>Exclude</th></tr></thead>
          <tbody>
            {(q.data?.rows || []).map(r => (
              <tr key={r.id}>
                <td className="adgr-wrap"><b>{r.title}</b></td>
                <td>{r.products}</td>
                <td className="adgr-wrap admc-cell">
                  <input className="a-in" maxLength={250} disabled={dis} value={map[r.id] ?? ''} onChange={e => setMap(x => ({ ...x, [r.id]: e.target.value }))} placeholder="e.g. 5258" aria-label={'Google category for ' + r.title} />
                  {r.suggestion != null && !dis && <div><button type="button" className="a-btn ghost sm" onClick={() => setMap(x => ({ ...x, [r.id]: String(r.suggestion) }))}>Use suggestion</button> <span className="adgr-dim">{r.suggestion} {r.note || ''}</span></div>}
                </td>
                <td className="adgr-wrap"><label className="admc-chk"><input type="checkbox" disabled={dis} checked={!!ex[r.id]} onChange={e => setEx(x => ({ ...x, [r.id]: e.target.checked }))} /> Exclude this category from the feed</label></td>
              </tr>
            ))}
            {!q.loading && !(q.data?.rows || []).length && <tr><td colSpan={4} className="adgr-empty">No categories yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="admc-row"><Switch on={s.skipSmallImages} onChange={v => !dis && set({ skipSmallImages: v })} title="Leave out small pictures" />
        <span>Leave out products whose main picture is smaller than</span>
        <input className="a-in admc-num" type="number" min="100" max="4000" disabled={dis} value={s.minImagePx} onChange={e => set({ minImagePx: e.target.value })} aria-label="Smallest picture size in pixels" /><span>pixels</span></div>
      <div className="admc-row">
        <label className="admc-f">Language (2 letters)<input className="a-in" maxLength={2} disabled={dis} value={s.contentLanguage} onChange={e => set({ contentLanguage: e.target.value })} /></label>
        <label className="admc-f">Country (2 letters, e.g. BD)<input className="a-in" maxLength={2} disabled={dis} value={s.feedLabel} onChange={e => set({ feedLabel: e.target.value })} /></label>
      </div>
      {!dis && <div className="admc-row"><button type="button" className="a-btn" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save settings'}</button></div>}
      <Msg m={m} />
    </Section>
  );
}
