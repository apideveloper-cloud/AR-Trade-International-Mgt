import { useEffect, useState } from 'react';
import { useBusy } from '../../hooks/useBusy.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/seo.js';
import { SecHead, jump } from '../system/settings/parts.jsx';
import { TemplateEditor } from './TemplateEditor.jsx';
import { BusinessSection, FlagsSection, GeneralSection, RobotsSection, ShippingSection, VerificationSection } from './SettingsSections.jsx';
import { putJson, setIn, trServer } from './seoModel.js';
import { AutomationSection } from './Automation.jsx';

const NAV = [['seo-general', 'General'], ['seo-templates', 'Templates'], ['seo-business', 'Business'], ['seo-shipping', 'Shipping and returns'], ['seo-verify', 'Verification'], ['seo-robots', 'Robots'], ['seo-flags', 'Switches'], ['seo-automation', 'Automation']];

/** The Settings tab. `st` is the shared state from SeoPage: { data (server answer), draft, setDraft, dirty, setSaved, setSavedPath }. */
export function SeoSettings({ st }) {
  const tr = useT();
  const { data, draft, setDraft } = st;
  const [saving, runSave] = useBusy();
  const [robBusy, runRobots] = useBusy();
  const [errs, setErrs] = useState([]);
  const [msg, setMsg] = useState('');
  const [robErrs, setRobErrs] = useState([]);
  const [robOk, setRobOk] = useState(false);
  const [robText, setRobText] = useState(draft?.robots?.customTxt || '');
  useEffect(() => {
    const warn = e => { if (st.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [st.dirty]);
  const set = (path, v) => { setMsg(''); setDraft(d => setIn(d, path, v)); };
  const save = e => {
    e.preventDefault(); setErrs([]); setMsg('');
    return runSave(async () => {
      const r = await putJson('/seo/settings', { settings: draft });
      if (r.ok) { st.setSaved(r.data.settings || draft); setMsg('Saved. The website uses the new SEO settings now.'); } else setErrs(r.errors);
    });
  };
  const saveRobots = () => runRobots(async () => {
    setRobErrs([]); setRobOk(false);
    const r = await putJson('/seo/robots', { text: robText });
    if (r.ok) { setRobOk(true); st.setSavedPath(['robots', 'customTxt'], robText); } else setRobErrs(r.errors);
  });
  return (
    <form className="adseo-form" onSubmit={save}>
      <div className="adseo-nav">{NAV.map(([id, l]) => <button key={id} type="button" onClick={() => jump(id)}>{tr(l)} ↓</button>)}</div>
      <GeneralSection s={draft} set={set} />
      <div className="a-card st-sec" id="seo-templates" style={{ '--h': 160 }}>
        <SecHead icon="📝" title={tr('Templates')} sub={tr('How titles and descriptions are built for each type of page')} />
        <TemplateEditor templates={draft.templates} defaults={data.defaults} vars={data.vars || []} onChange={(kind, f, v) => set(['templates', kind, f], v)} />
      </div>
      <BusinessSection s={draft} set={set} />
      <ShippingSection s={draft} set={set} />
      <VerificationSection s={draft} set={set} />
      <RobotsSection s={draft} set={set} text={robText} onText={t => { setRobText(t); setRobOk(false); }} onValidate={saveRobots} busy={robBusy} errors={robErrs} ok={robOk} />
      <FlagsSection s={draft} set={set} />
      <AutomationSection />
      {errs.length > 0 && <div className="a-msg err"><ul className="adseo-errs">{errs.map((e, i) => <li key={i}>{trServer(tr, e)}</li>)}</ul></div>}
      <div className="a-save">
        <span>{saving ? tr('Saving…') : msg ? tr(msg) : (st.dirty ? tr('You have unsaved changes.') : tr('Nothing changed yet.'))}</span>
        <button className="a-btn adseo-savebtn" disabled={saving}>{tr('Save all settings')}</button>
      </div>
    </form>
  );
}
