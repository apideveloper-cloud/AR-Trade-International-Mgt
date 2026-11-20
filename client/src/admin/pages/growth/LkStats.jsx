import { useState } from 'react';
import { Msg } from './parts.jsx';
import { send, mcMsg, STATUSES, KIND_TEXT } from './lkApi.js';

/** Count cards by status plus the starter checklist. */
export default function LkStats({ d, canEdit, reload, onFilter }) {
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState('');
  const counts = d?.counts || {};
  const add = async s => {
    setBusy(s.name); setM(null);
    const r = await send('/growth/backlinks/starter', { name: s.name });
    setBusy('');
    setM(mcMsg(r, s.name + ' was added to your list.'));
    if (r.ok) reload();
  };
  const todo = (d?.starter || []).filter(s => !s.added);
  return (
    <>
      <div className="adlk-cards">
        {STATUSES.map(([k, l, ic]) => (
          <button type="button" key={k} className={'adlk-count adlk-c-' + k + (k === 'lost' && counts.lost > 0 ? ' adlk-hot' : '')} onClick={() => onFilter(k)}>
            <span className="adlk-n">{counts[k] || 0}</span>
            <span className="adlk-l">{ic} {l}</span>
            {k === 'lost' && counts.lost > 0 && <span className="adlk-warn">Link removed: needs attention</span>}
          </button>
        ))}
      </div>
      <Msg m={m} />
      {todo.length > 0 && (
        <div className="adlk-starter">
          <h4>Starter checklist</h4>
          <p className="adseo-hint">Common places worth listing your shop. Add the ones you want to track.</p>
          <ul>
            {todo.map(s => (
              <li key={s.name}>
                <div><b>{s.name}</b> <span className="adlk-dim">{KIND_TEXT[s.kind] || s.kind}</span>{s.note && <div className="adlk-dim">{s.note}</div>}</div>
                <button type="button" className="a-btn ghost sm" disabled={!canEdit || busy === s.name} onClick={() => add(s)}>{busy === s.name ? 'Adding...' : 'Add to my list'}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
