import { useState } from 'react';
import { Msg } from './parts.jsx';
import { send, mcMsg, trMsg, KINDS, STATUSES } from './lkApi.js';
import { useT } from '../../i18n/lang.jsx';

const EMPTY = { kind: 'citation', name: '', url: '', target: '', anchor: '', status: 'planned', notes: '' };

/** "Add a link or listing" form. */
export default function LkForm({ canEdit, onAdded }) {
  const tr = useT();
  const [f, setF] = useState(EMPTY);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const submit = async e => {
    e.preventDefault();
    if (!f.name.trim()) { setM({ ok: false, text: tr('Please type a name, for example the website or directory.') }); return; }
    setBusy(true); setM(null);
    const body = { kind: f.kind, name: f.name.trim(), status: f.status };
    ['url', 'target', 'anchor', 'notes'].forEach(k => { if (f[k].trim()) body[k] = f[k].trim(); });
    const r = await send('/growth/backlinks', body);
    setBusy(false);
    setM(mcMsg(r, 'Added.'));
    if (r.ok) { setF(EMPTY); onAdded(); }
  };
  return (
    <form className="adlk-form" onSubmit={submit}>
      <h4>{tr('Add a link or listing')}</h4>
      {!canEdit && <p className="adseo-hint">{tr('Only the Master Admin or Admin can change this.')}</p>}
      <div className="adlk-grid">
        <label>{tr('Type')}<select className="a-in" value={f.kind} onChange={e => set('kind', e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select></label>
        <label>{tr('Name')}<input className="a-in" maxLength={120} value={f.name} onChange={e => set('name', e.target.value)} placeholder={tr('e.g. Bangladesh Business Directory')} /></label>
        <label>{tr('Their page (web address)')}<input className="a-in" maxLength={500} value={f.url} onChange={e => set('url', e.target.value)} placeholder="https://..." /></label>
        <label>{tr('Our page it points to (blank = home page)')}<input className="a-in" maxLength={500} value={f.target} onChange={e => set('target', e.target.value)} /></label>
        <label>{tr('Link text')}<input className="a-in" maxLength={120} value={f.anchor} onChange={e => set('anchor', e.target.value)} /></label>
        <label>{tr('Status')}<select className="a-in" value={f.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select></label>
        <label className="adlk-wide">{tr('Notes')}<input className="a-in" maxLength={500} value={f.notes} onChange={e => set('notes', e.target.value)} /></label>
      </div>
      <Msg m={trMsg(tr, m)} />
      <button type="submit" className="a-btn" disabled={!canEdit || busy}>{busy ? tr('Adding...') : tr('Add to my list')}</button>
    </form>
  );
}
