import { useCallback, useEffect, useState } from 'react';
import { fld } from '../../adminApi.js';
import { ModuleGrid } from './modules/ModuleGrid.jsx';
import { AutomationList } from './modules/AutomationList.jsx';
import { Notice } from '../../fieldKit.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/field.js';
import '../../field.css';

/** Which roles see which mobile-app module, and the automations switches. */
export function FieldModules() {
  const tr = useT();
  const [cfg, setCfg] = useState(null);
  const [autos, setAutos] = useState(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const load = useCallback(async () => {
    try { const [c, a] = await Promise.all([fld.get('/modules/config'), fld.get('/admin/automation')]); setCfg(c); setAutos(a); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const saveModule = async (m, patch) => {
    const before = cfg;
    setCfg({ ...cfg, modules: cfg.modules.map(x => (x.key === m.key ? { ...x, ...patch } : x)) });
    try { await fld.put('/modules/config/' + m.key, patch); setSaved(tr('{name} saved', { name: tr(m.label) })); setErr(''); } catch (e) { setCfg(before); setErr(e.message); }
  };
  const toggleRole = (m, r) => saveModule(m, { roles: m.roles.includes(r) ? m.roles.filter(x => x !== r) : [...m.roles, r] });
  const toggleAuto = async a => {
    const before = autos;
    setAutos(autos.map(x => (x.key === a.key ? { ...x, enabled: !a.enabled } : x)));
    try { await fld.put('/admin/automation/' + a.key, { enabled: !a.enabled }); setSaved(tr(a.enabled ? '{name} paused' : '{name} running', { name: tr(a.title) })); await load(); } catch (e) { setAutos(before); setErr(e.message); }
  };
  if (err && !cfg) return <Notice err={tr(err)} />;
  if (!cfg) return <span className="spin" />;
  return (
    <>
      <Notice err={err && tr(err)} />
      <section className="a-card">
        <div className="card-hd"><div><h3>{tr('Mobile app modules')}</h3><small className="fd-sub">{tr('Switch a module off for everyone, or choose which roles see it. Admins always keep every module. Changes reach the phones within a few seconds.')}</small></div>{saved && <span className="fd-saved">✓ {saved}</span>}</div>
        <ModuleGrid modules={cfg.modules} onSave={saveModule} onToggleRole={toggleRole} />
        <small className="fd-sub">{tr('Admins always keep every module, so they are not in the grid. A module that is off disappears for everyone, whatever the ticks say.')}</small>
      </section>
      {autos && <AutomationList autos={autos} onToggle={toggleAuto} />}
    </>
  );
}
