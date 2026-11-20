import { useCallback, useRef, useState } from 'react';
import { adm, getAdminToken } from '../adminApi.js';
import { confirmBox, alertBox } from '../ui.jsx';

const SIZE = 10;

/** POST to the revert endpoint; keeps the status and the 409 conflicts that adm.post would drop. */
async function postRevert(id, force) {
  const t = getAdminToken();
  let res;
  try { res = await fetch(`/api/admin/seo/history/${id}/revert`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(force ? { force: true } : {}) }); } catch { return { status: 0, error: "Can't reach the server. Check your connection and try again." }; }
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...data };
}

const shortVal = v => { const s = v == null || v === '' ? '(empty)' : String(v); return s.length > 60 ? s.slice(0, 60) + '…' : s; };

/** revert(entry) asks, restores, and handles a 409 ("changed since") with a second "Revert anyway" question. Calls onDone() after a success. */
export function useRevert(onDone) {
  const [busyId, setBusyId] = useState(null);
  const lock = useRef(false);
  const revert = useCallback(async e => {
    if (lock.current) return;
    const names = (e.fields || []).map(f => f.field).join(', ');
    if (!(await confirmBox(`Restore the previous values of: ${names}?`, { confirmLabel: 'Revert' }))) return;
    lock.current = true; setBusyId(e.id);
    try {
      let r = await postRevert(e.id, false);
      if (r.status === 409 && Array.isArray(r.conflicts)) {
        const lines = r.conflicts.map(c => `${c.field}, now ${shortVal(c.current)}`).join('; ');
        if (!(await confirmBox('Changed since: ' + lines + '. Revert anyway?', { danger: true, confirmLabel: 'Revert anyway' }))) return;
        r = await postRevert(e.id, true);
      }
      if (r.ok) onDone?.(); else await alertBox(r.error || 'Could not revert this change.');
    } finally { lock.current = false; setBusyId(null); }
  }, [onDone]);
  return { revert, busyId };
}

/** The history of one item: first page, then "Load more" appends the next one. */
export function useHistory(type, id) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);
  const fetchPage = useCallback(async (page, append) => {
    const n = ++seq.current;
    setLoading(true); setErr('');
    try {
      const d = await adm.get(`/seo/history?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&page=${page}&size=${SIZE}`);
      if (n !== seq.current) return;
      setRows(r => (append ? [...r, ...d.rows] : d.rows)); setTotal(d.total); setLoaded(true);
    } catch (e) { if (n === seq.current) setErr(e.message); }
    if (n === seq.current) setLoading(false);
  }, [type, id]);
  const reload = useCallback(() => fetchPage(1, false), [fetchPage]);
  const more = useCallback(() => fetchPage(Math.floor(rows.length / SIZE) + 1, true), [fetchPage, rows.length]);
  return { rows, total, loading, err, loaded, reload, more };
}
