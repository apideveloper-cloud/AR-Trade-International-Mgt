import { useCallback, useEffect, useState } from 'react';
import { fld } from '../../adminApi.js';
import { Switch } from '../../ui.jsx';
import { Notice } from '../../fieldKit.jsx';
import '../../field.css';

const ROLES = [['manager', 'Manager'], ['accountant', 'Accountant'], ['purchase', 'Purchase'], ['rm', 'RM'], ['field', 'Field Officer']];
const ROLE_H = { manager: 160, accountant: 300, purchase: 45, rm: 20, field: 195 };
const MOD_GROUPS = [
  ['Attendance and tracking', 230, ['attendance', 'tracking', 'team', 'leave']],
  ['Sales and customers', 160, ['customers', 'visits', 'sales', 'delivery', 'collection']],
  ['Money and approvals', 75, ['expenses', 'approvals', 'purchase', 'reports']],
  ['Communication', 300, ['notifications', 'contacts']]
];
const MOD_ICON = { attendance: '⏱', tracking: '📍', team: '🗺', leave: '🌴', notifications: '🔔', expenses: '🧾', approvals: '✅', customers: '👥', visits: '📅', sales: '🛒', delivery: '🚚', collection: '💵', purchase: '📦', reports: '📊', contacts: '📞' };

export function FieldModules() {
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
    try { await fld.put('/modules/config/' + m.key, patch); setSaved(`${m.label} saved`); setErr(''); } catch (e) { setCfg(before); setErr(e.message); }
  };
  const toggleRole = (m, r) => saveModule(m, { roles: m.roles.includes(r) ? m.roles.filter(x => x !== r) : [...m.roles, r] });
  const toggleAuto = async a => {
    const before = autos;
    setAutos(autos.map(x => (x.key === a.key ? { ...x, enabled: !a.enabled } : x)));
    try { await fld.put('/admin/automation/' + a.key, { enabled: !a.enabled }); setSaved(`${a.title} ${a.enabled ? 'paused' : 'running'}`); await load(); } catch (e) { setAutos(before); setErr(e.message); }
  };
  if (err && !cfg) return <Notice err={err} />;
  if (!cfg) return <span className="spin" />;
  return (
    <>
      <Notice err={err} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Mobile app modules</h3><small className="fd-sub">Switch a module off for everyone, or choose which roles see it. Admins always keep every module. Changes reach the phones within a few seconds.</small></div>{saved && <span className="fd-saved">✓ {saved}</span>}</div>
        <div className="fm" role="table" aria-label="Which role sees which module">
          <div className="fm-head" role="row"><span>Module</span><span>On</span>{ROLES.map(([k, l]) => <span key={k} style={{ '--h': ROLE_H[k] }}>{l}</span>)}<span className="fm-end">Quick set</span></div>
          {MOD_GROUPS.map(([gname, hue, keys]) => {
            const rows = cfg.modules.filter(m => keys.includes(m.key));
            if (!rows.length) return null;
            return (
              <div key={gname} className="fm-grp" style={{ '--g': hue }}>
                <div className="fm-gh"><b>{gname}</b><small>{rows.filter(m => m.enabled).length} of {rows.length} on</small></div>
                {rows.map(m => (
                  <div key={m.key} className={'fm-row' + (m.enabled ? '' : ' off')} role="row">
                    <span className="fm-name"><i>{MOD_ICON[m.key] || '•'}</i><span><b>{m.label}</b><small>{m.bn}</small></span></span>
                    <span><Switch on={m.enabled} onChange={on => saveModule(m, { enabled: on })} title={m.enabled ? 'Turn off for everyone' : 'Turn on'} /></span>
                    {ROLES.map(([k, l]) => (
                      <span key={k} className="fm-c" style={{ '--h': ROLE_H[k] }}>
                        <button type="button" disabled={!m.enabled} className={'fm-cb' + (m.roles.includes(k) ? ' on' : '')} aria-pressed={m.roles.includes(k)} aria-label={`${l} can use ${m.label}`} title={`${l}: ${m.roles.includes(k) ? 'can use' : 'cannot use'} ${m.label}`} onClick={() => toggleRole(m, k)}>{m.roles.includes(k) ? '✓' : ''}</button>
                      </span>
                    ))}
                    <span className="fm-end"><button type="button" className="fm-q" disabled={!m.enabled} onClick={() => saveModule(m, { roles: ROLES.map(r => r[0]) })}>All</button><button type="button" className="fm-q" disabled={!m.enabled} onClick={() => saveModule(m, { roles: [] })}>None</button></span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <small className="fd-sub">Admins always keep every module, so they are not in the grid. A module that is off disappears for everyone, whatever the ticks say.</small>
      </section>
      {autos && (
        <section className="a-card">
          <div className="card-hd"><h3>Automations</h3></div>
          <div className="fd-autos">
            {autos.map(a => (
              <div key={a.key} className="fd-auto">
                <span className="fd-mt"><b>{a.title}</b><small>{a.bn}</small><em className={a.enabled ? 'on' : ''}>{a.status}</em></span>
                <Switch on={a.enabled} onChange={() => toggleAuto(a)} title={a.enabled ? 'Pause' : 'Run'} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
