import { useEffect, useMemo, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';
import { confirmBox } from '../../ui.jsx';
import { MASTER_ONLY } from './rolesMeta.js';

const draftOf = d => Object.fromEntries(d.roles.map(r => [r.name, new Set(r.perms)]));

/** Loads the role matrix and owns the editable draft plus save / reset / discard. */
export function useRoleMatrix() {
  const tr = useT();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({}); // role -> Set of permission keys (editable copy)
  const [showLegacy, setShowLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // `keep`: roles whose unsaved ticks stay as they are (resetting one role must not throw away the edits of the others)
  const load = (keep = []) => adm.get('/roles').then(d => { setData(d); setDraft(prev => ({ ...draftOf(d), ...Object.fromEntries(keep.filter(k => prev[k]).map(k => [k, prev[k]])) })); }).catch(e => setErr(tr(e.message)));
  useEffect(() => { load(); }, []);

  const roles = useMemo(() => (data ? data.roles.filter(r => showLegacy || !r.legacy) : []), [data, showLegacy]);
  const groups = useMemo(() => {
    const g = [];
    (data?.perms || []).forEach(p => { let x = g.find(y => y[0] === p.group); if (!x) g.push(x = [p.group, []]); x[1].push(p); });
    return g;
  }, [data]);
  const changed = useMemo(() => (data ? data.roles.filter(r => !r.locked && (draft[r.name]?.size !== r.perms.length || r.perms.some(p => !draft[r.name].has(p)))).map(r => r.name) : []), [data, draft]);

  const toggle = (role, key) => setDraft(d => { const s = new Set(d[role]); s.has(key) ? s.delete(key) : s.add(key); return { ...d, [role]: s }; });
  const setAll = (role, on) => setDraft(d => ({ ...d, [role]: new Set(on ? data.perms.map(p => p.key).filter(k => k !== MASTER_ONLY) : []) }));
  const discard = () => setDraft(draftOf(data));
  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      for (const name of changed) await adm.put('/roles/' + encodeURIComponent(name), { perms: [...draft[name]] });
      await load();
      setMsg(tr('Saved. The new access applies to {names} straight away.', { names: changed.map(n => tr(n)).join(', ') }));
    } catch (e) { setErr(tr(e.message)); }
    setBusy(false);
  };
  const reset = async name => {
    if (!(await confirmBox(tr('Reset "{name}" to its default access?', { name: tr(name) }), { confirmLabel: tr('Reset access') }))) return;
    setErr(''); setMsg('');
    try { await adm.post(`/roles/${encodeURIComponent(name)}/reset`); await load(changed.filter(n => n !== name)); setMsg(tr('"{name}" is back to its default access.', { name: tr(name) })); } catch (e) { setErr(tr(e.message)); }
  };
  return { data, draft, roles, groups, changed, busy, msg, err, showLegacy, setShowLegacy, toggle, setAll, discard, save, reset };
}
