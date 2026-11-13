import { useCallback, useEffect, useState } from 'react';
import { can, hubApi as hub } from '../admin/adminApi.js';

/** The board is only loaded for office staff; riders only need their own jobs. */
export function useBoard(staff) {
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const office = staff && can(staff, 'hub.view');
  const load = useCallback(() => (office ? hub.get('/board').then(b => { setBoard(b); setErr(''); }).catch(e => setErr(e.message)) : Promise.resolve()), [office]);
  useEffect(() => {
    if (!office) return undefined;
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [office, load]);
  return { board, err, load };
}
