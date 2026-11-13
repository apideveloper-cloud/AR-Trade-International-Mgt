import { useEffect, useMemo, useState } from 'react';
import { adm, dateTimeF } from '../adminApi.js';
import { ROLE_HUE, confirmBox } from '../ui.jsx';
import { saveTextFile } from '../hooks/download.js';

const hue = r => ROLE_HUE[r] ?? 250;
const GROUP_ICON = { Overview: '📊', Sales: '🧾', Catalog: '📦', Delivery: '🚚', Engage: '📣', 'Field & mobile app': '📍', System: '⚙️' };
const GROUP_HUE = { Overview: 250, Sales: 160, Catalog: 45, Delivery: 200, Engage: 330, 'Field & mobile app': 120, System: 300 };
const MASTER_ONLY = 'roles.manage';

/** The role matrix: one column per role, one row per permission. Only the Master Admin sees this page. */
export function Roles() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({}); // role -> Set of permission keys (editable copy)
  const [showLegacy, setShowLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => adm.get('/roles').then(d => { setData(d); setDraft(Object.fromEntries(d.roles.map(r => [r.name, new Set(r.perms)]))); }).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);

  const roles = useMemo(() => (data ? data.roles.filter(r => showLegacy || !r.legacy) : []), [data, showLegacy]);
  const groups = useMemo(() => {
    const g = [];
    (data?.perms || []).forEach(p => { let x = g.find(y => y[0] === p.group); if (!x) g.push(x = [p.group, []]); x[1].push(p); });
    return g;
  }, [data]);
  const changed = useMemo(() => (data ? data.roles.filter(r => !r.locked && (draft[r.name]?.size !== r.perms.length || r.perms.some(p => !draft[r.name].has(p)))).map(r => r.name) : []), [data, draft]);

  if (!data) return err ? <div className="a-msg err">{err}</div> : <span className="spin" />;

  const toggle = (role, key) => setDraft(d => { const s = new Set(d[role]); s.has(key) ? s.delete(key) : s.add(key); return { ...d, [role]: s }; });
  const setAll = (role, on) => setDraft(d => ({ ...d, [role]: new Set(on ? data.perms.map(p => p.key).filter(k => k !== MASTER_ONLY) : []) }));
  const editable = key => key !== MASTER_ONLY;

  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      for (const name of changed) await adm.put('/roles/' + encodeURIComponent(name), { perms: [...draft[name]] });
      await load();
      setMsg(`Saved. The new access applies to ${changed.join(', ')} straight away.`);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const reset = async name => {
    if (!(await confirmBox(`Reset "${name}" to its default access?`, { confirmLabel: 'Reset access' }))) return;
    setErr(''); setMsg('');
    try { await adm.post(`/roles/${encodeURIComponent(name)}/reset`); await load(); setMsg(`"${name}" is back to its default access.`); } catch (e) { setErr(e.message); }
  };
  const csv = () => {
    const rows = [['Group', 'Permission', ...roles.map(r => r.name)], ...data.perms.map(p => [p.group, p.label, ...roles.map(r => (r.locked || draft[r.name]?.has(p.key) ? 'Yes' : '')) ])];
    const text = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    saveTextFile('ar-trade-role-matrix.csv', '﻿' + text);
  };

  const th = { padding: '10px 6px', textAlign: 'center', verticalAlign: 'bottom' };
  const stickyL = { position: 'sticky', left: 0, background: '#fff', zIndex: 1, textAlign: 'left' };
  return (
    <>
      <div className="rm-hero">
        <span className="rm-hero-ic">🔐</span>
        <div>
          <b>Role matrix</b>
          <span>Tick what each role may do. <u>Master Admin</u> always has full access and is the only role that can open this page. <u>Admin</u> has limited access: exactly the ticks you set below. Changes apply on the person's next click, no sign-out needed.</span>
        </div>
        <div className="rm-hero-act">
          <label className="rm-legacy"><input type="checkbox" checked={showLegacy} onChange={e => setShowLegacy(e.target.checked)} />Show existing roles</label>
          <button type="button" className="a-btn sm" onClick={csv}>⤓ Download CSV</button>
        </div>
      </div>
      {err && <div className="a-msg err">{err}</div>}
      {msg && <div className="a-msg" style={{ background: '#e6f4ea', color: '#1e6b3a' }}>{msg}</div>}

      <div className="a-table mx" style={{ padding: 0 }}>
        <table className="rm-table" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <colgroup><col style={{ width: 270 }} />{roles.map(r => <col key={r.name} />)}</colgroup>
          <thead>
            <tr>
              <th className="rm-th0" style={{ ...th, ...stickyL, verticalAlign: 'bottom' }}><span>PERMISSION</span><small>{data.perms.length} permissions, grouped</small></th>
              {roles.map(r => {
                const n = r.locked ? data.perms.length : (draft[r.name]?.size || 0), total = data.perms.length;
                return (
                  <th key={r.name} className="rm-th" style={{ ...th, '--h': hue(r.name) }}>
                    <span className="rm-ic">{r.icon}</span>
                    <b>{r.name}</b>
                    <small title={r.desc}>{r.members} member{r.members === 1 ? '' : 's'}</small>
                    <span className="rm-prog" title={n + ' of ' + total + ' permissions'}><i style={{ width: Math.round(n / total * 100) + '%' }} /></span>
                    <em>{r.locked ? 'Full access' : n + ' / ' + total}</em>
                    {!r.locked && (
                      <span className="rm-act">
                        <button type="button" onClick={() => setAll(r.name, true)}>all</button>
                        <button type="button" onClick={() => setAll(r.name, false)}>none</button>
                        <button type="button" onClick={() => reset(r.name)}>reset</button>
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map(([g, perms]) => (
              <GroupRows key={g} group={g} perms={perms} roles={roles} draft={draft} editable={editable} toggle={toggle} stickyL={stickyL} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="a-save"><span>{changed.length ? <b>{changed.length} role{changed.length === 1 ? '' : 's'} with unsaved changes: {changed.join(', ')}</b> : 'No unsaved changes.'}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {changed.length > 0 && <button className="a-btn ghost" onClick={() => setDraft(Object.fromEntries(data.roles.map(r => [r.name, new Set(r.perms)])))}>Discard</button>}
          <button className="a-btn" disabled={!changed.length || busy} onClick={save} style={{ background: 'oklch(0.82 0.13 85)', color: '#16181d', fontWeight: 800 }}>{busy ? 'Saving…' : 'Save role matrix'}</button>
        </span>
      </div>

      <div className="a-card" style={{ gap: 6 }}>
        <h3>Recent changes</h3>
        {!data.log.length && <span style={{ color: '#8a8f9b', fontSize: 13 }}>No changes yet.</span>}
        {data.log.map((l, i) => <div key={i} style={{ fontSize: 13, borderTop: i ? '1px solid #f3f4f7' : 0, paddingTop: i ? 6 : 0 }}><b>{l.role}</b> · {l.what} <span style={{ color: '#8a8f9b' }}>— {l.by}, {dateTimeF(l.at)}</span></div>)}
      </div>
    </>
  );
}

function GroupRows({ group, perms, roles, draft, editable, toggle, stickyL }) {
  return (
    <>
      <tr className="rm-grp" style={{ '--h': GROUP_HUE[group] ?? 250 }}>
        <td colSpan={roles.length + 1}><span className="rm-gic">{GROUP_ICON[group] || '•'}</span><b>{group}</b><em>{perms.length} permission{perms.length === 1 ? '' : 's'}</em></td>
      </tr>
      {perms.map(p => (
        <tr key={p.key} className="rm-row">
          <td className="rm-perm" style={{ ...stickyL, padding: '7px 14px' }}>
            <span className="rm-pl">{p.label}</span>
            <code>{p.key}</code>
          </td>
          {roles.map(r => {
            const on = !!(r.locked || draft[r.name]?.has(p.key));
            const fixed = r.locked || !editable(p.key);
            return (
              <td key={r.name} className={'rm-td' + (on && !fixed ? ' on' : '')} style={{ '--h': hue(r.name) }}>
                {!editable(p.key) && !r.locked ? <span className="rm-lock" title="Master Admin only">🔒</span> : (
                  <label className={'rm-cell' + (fixed ? ' fixed' : '')} title={fixed ? 'Always allowed for the Master Admin' : (on ? 'Allowed. Click to remove' : 'Not allowed. Click to allow')}>
                    <input type="checkbox" checked={on} disabled={fixed} onChange={() => toggle(r.name, p.key)} aria-label={`${r.name}: ${p.label}`} />
                    <span className="rm-box"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
                  </label>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
