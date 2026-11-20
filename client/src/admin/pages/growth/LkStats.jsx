import { useState } from 'react';
import { Msg } from './parts.jsx';
import { send, mcMsg, trMsg, STATUSES, KIND_TEXT } from './lkApi.js';
import { useT } from '../../i18n/lang.jsx';

/** Count cards by status plus the starter checklist. */
export default function LkStats({ d, canEdit, reload, onFilter }) {
  const tr = useT();
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState('');
  const counts = d?.counts || {};
  const add = async s => {
    setBusy(s.name); setM(null);
    const r = await send('/growth/backlinks/starter', { name: s.name });
    setBusy('');
    setM({ ...mcMsg(r, tr('{name} was added to your list.', { name: tr(s.name) })) });
    if (r.ok) reload();
  };
  const todo = (d?.starter || []).filter(s => !s.added);
  return (
    <>
      <div className="adlk-cards">
        {STATUSES.map(([k, l, ic]) => (
          <button type="button" key={k} className={'adlk-count adlk-c-' + k + (k === 'lost' && counts.lost > 0 ? ' adlk-hot' : '')} onClick={() => onFilter(k)}>
            <span className="adlk-n">{counts[k] || 0}</span>
            <span className="adlk-l">{ic} {tr(l)}</span>
            {k === 'lost' && counts.lost > 0 && <span className="adlk-warn">{tr('Link removed: needs attention')}</span>}
          </button>
        ))}
      </div>
      <Msg m={trMsg(tr, m)} />
      {todo.length > 0 && (
        <div className="adlk-starter">
          <h4>{tr('Starter checklist')}</h4>
          <p className="adseo-hint">{tr('Common places worth listing your shop. Add the ones you want to track.')}</p>
          <ul>
            {todo.map(s => (
              <li key={s.name}>
                <div><b>{tr(s.name)}</b> <span className="adlk-dim">{tr(KIND_TEXT[s.kind] || s.kind)}</span>{s.note && <div className="adlk-dim">{tr(s.note)}</div>}</div>
                <button type="button" className="a-btn ghost sm" disabled={!canEdit || busy === s.name} onClick={() => add(s)}>{busy === s.name ? tr('Adding...') : tr('Add to my list')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
