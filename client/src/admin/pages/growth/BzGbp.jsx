import { useEffect, useRef, useState } from 'react';
import { Switch } from '../../ui.jsx';
import { send, mcMsg, trMsg } from './bzApi.js';
import { Msg, CopyBtn } from './parts.jsx';
import { useT } from '../../i18n/lang.jsx';

const URLS = [['profileUrl', 'Your Google profile link', 'Open your profile on Google Maps, press Share and copy the link.'], ['reviewLink', 'Review link', "In your profile, choose 'Get more reviews' and copy the link."]];
const LISTED = [['listedName', 'Name Google shows'], ['listedPhone', 'Phone Google shows'], ['listedAddress', 'Address Google shows'], ['listedHours', 'Hours Google shows']];

/** Section C: Google Business Profile. */
export default function BzGbp({ gbp, copy, canEdit, onSaved }) {
  const tr = useT();
  const [g, setG] = useState(gbp);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const typed = useRef(new Set()); // text boxes with a change that is not saved yet: a tick or a switch (saved on its own) must not wipe them
  useEffect(() => setG(x => ({ ...gbp, ...Object.fromEntries([...typed.current].map(k => [k, x[k]])) })), [gbp]);
  const set = patch => setG(x => ({ ...x, ...patch }));
  const edit = (k, v) => { typed.current.add(k); set({ [k]: v }); };
  const post = async (body, okText) => {
    setBusy(true); setM(null);
    const r = await send('/growth/business/gbp', body);
    setBusy(false);
    setM(mcMsg(r, okText));
    if (r.ok) { if ('profileUrl' in body) typed.current.clear(); onSaved?.(r.body?.gbp); }
    return r.ok;
  };
  const tick = async (id, done) => {
    const old = g.checklist;
    set({ checklist: old.map(c => (c.id === id ? { ...c, done } : c)) });
    if (!(await post({ checklist: { [id]: done } }, 'Saved.'))) set({ checklist: old });
  };
  const flag = (k, v) => { set({ [k]: v }); post({ [k]: v }, 'Saved.'); };
  const save = () => post(Object.fromEntries([...URLS, ...LISTED].map(([k]) => [k, g[k] || ''])), 'Saved.');
  const c = copy || {};
  const one = [['Name', c.name], ['Phone', c.phone], ['Address', c.address], ['Hours', c.hours], ['Website', c.website]];
  return (
    <section className="a-card adbz-card" id="adbz-gbp">
      <h3>{tr('Google Business Profile')}</h3>
      <p className="adbz-hint">{tr('A free profile that shows your shop on Google Maps and in local search. Google asks you to claim and verify it yourself, so this checklist walks you through it.')}</p>
      <div className="adbz-row">
        <a className="a-btn" href="https://business.google.com" target="_blank" rel="noreferrer">{tr('Open Google Business')}</a>
        <a className="a-btn" href="https://www.bingplaces.com" target="_blank" rel="noreferrer">{tr('Open Bing Places')}</a>
      </div>
      {(g.checklist || []).map(i => (
        <label key={i.id} className="adbz-check">
          <input type="checkbox" disabled={!canEdit || busy} checked={!!i.done} onChange={e => tick(i.id, e.target.checked)} />
          <span>{tr(i.label)}{i.hint && <small>{tr(i.hint)}</small>}</span>
        </label>
      ))}
      <div className="adbz-row"><Switch on={!!g.claimed} onChange={v => canEdit && flag('claimed', v)} title={tr('Claimed')} /><span>{tr('I have claimed the profile')}</span></div>
      <div className="adbz-row"><Switch on={!!g.verified} onChange={v => canEdit && flag('verified', v)} title={tr('Verified')} /><span>{tr('Google has verified it')}</span></div>
      <div className="adbz-form">
        {URLS.map(([k, l, h]) => (
          <label key={k} className="adbz-field">{tr(l)}
            <input className="a-in" value={g[k] || ''} placeholder="https://" disabled={!canEdit} onChange={e => edit(k, e.target.value)} /><small>{tr(h)}</small>
          </label>
        ))}
      </div>
      <h4 className="adbz-sub">{tr('Copy-ready details')}</h4>
      <p className="adbz-hint">{tr('Paste these into Google so they match your website exactly.')}</p>
      <textarea className="a-in adbz-box" readOnly value={c.text || ''} />
      <div className="adbz-row"><CopyBtn text={c.text || ''} />{one.map(([l, v]) => v ? <span key={l} className="adbz-row">{tr(l)}: <CopyBtn text={v} /></span> : null)}</div>
      <h4 className="adbz-sub">{tr('What Google shows today')}</h4>
      <p className="adbz-hint">{tr('Type what you see on Google right now. The check above compares it with your details.')}</p>
      <div className="adbz-form">
        {LISTED.map(([k, l]) => <label key={k} className="adbz-field">{tr(l)}<input className="a-in" value={g[k] || ''} disabled={!canEdit} onChange={e => edit(k, e.target.value)} /></label>)}
      </div>
      <div className="adbz-row"><button type="button" className="a-btn a-btn-primary" disabled={!canEdit || busy} onClick={save}>{tr('Save profile details')}</button><Msg m={trMsg(tr, m)} /></div>
    </section>
  );
}
