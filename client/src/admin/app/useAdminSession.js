import { useCallback, useEffect, useState } from 'react';
import { adm, can, fld, getAdminToken, setAdminToken, setUnauthorizedHandler } from '../adminApi.js';

/** Signed-in staff (restored from the saved token), sign-out, the category list for product forms and the field-app modules the role may use. */
export function useAdminSession() {
  const [staff, setStaff] = useState(null);
  const [ready, setReady] = useState(false);
  const [cats, setCats] = useState([]);
  const [mods, setMods] = useState(null); // field-app modules this role may use: the menu hides pages whose module is off for them

  const logout = useCallback(() => { setAdminToken(null); setStaff(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  useEffect(() => {
    if (!getAdminToken()) { setReady(true); return; }
    adm.get('/me').then(r => setStaff(r.staff)).catch(() => setAdminToken(null)).finally(() => setReady(true));
  }, []);
  const loadCats = useCallback(() => adm.get('/categories').then(r => setCats(r.map(c => ({ id: c.id, title: c.title })))).catch(() => {}), []);
  useEffect(() => { if (staff && can(staff, 'products.view')) loadCats(); }, [staff, loadCats]);
  useEffect(() => {
    if (!staff) { setMods(null); return undefined; }
    let stale = false; // an answer for a previous sign-in must not set the menu of the next one
    fld.get('/modules/me').then(r => { if (!stale) setMods(r.modules); }).catch(() => { if (!stale) setMods(null); });
    return () => { stale = true; };
  }, [staff]);
  return { staff, setStaff, ready, cats, loadCats, mods, logout };
}
