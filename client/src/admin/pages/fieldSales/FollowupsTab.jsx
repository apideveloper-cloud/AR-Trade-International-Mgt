import { useState } from 'react';
import { Empty, Pager, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Av, Chip, Tabs, fDateTime } from '../../fieldKit.jsx';

const STATUS_FILTER = [{ key: 'status', label: 'Status', all: 'Open and done', icon: 'status', options: ['Open', 'Done'] }];
const BUCKETS = [['all', 'All'], ['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Upcoming']];

/** The follow-ups tab: bucket tabs, one card per follow-up, "Done…" with a required note, and Reopen. `act(id, what, body)` calls the API and resolves true on success. */
export function FollowupsTab({ f, act }) {
  const [note, setNote] = useState(null); // { id, text } while a follow-up is being closed
  const fc = f.data.counts || {};
  const markDone = async (id, text) => { if (await act(id, 'done', { remarks: text })) setNote(null); };
  return (
    <>
      <ListFilter t={f} noun="follow-up" title="Search follow-ups" search={{ placeholder: 'Customer, area, title or note' }} selects={STATUS_FILTER} range={{ label: 'Due' }} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={f.params.bucket} onChange={k => f.set({ bucket: k })} items={BUCKETS.map(([k, l]) => (k === 'all' ? [k, l] : [k, l, fc[k]]))} /></div>
        <Toolbar t={f} search={false} />
        <div className="fd-appr" style={{ opacity: f.loading ? 0.6 : 1 }}>
          {(f.data.rows || []).map(x => (
            <div key={x.id} className={'fd-ap' + (x.status === 'Open' && x.group === 0 ? ' open' : '')}>
              <Av name={x.customer} />
              <div className="fd-apb">
                <div className="fd-aph"><b>{x.customer}</b><Chip tone={x.status !== 'Open' ? 'ok' : x.group === 0 ? 'bad' : x.group === 1 ? 'amber' : 'violet'}>{x.status !== 'Open' ? x.status : ['Overdue', 'Today', 'Upcoming'][x.group]}</Chip><Chip tone="blue">{x.action}</Chip></div>
                <div className="fd-aps">{x.title} · due {fDateTime(x.dueAt)}</div>
                {x.note && <div className="fd-apd">{x.note}</div>}{x.doneRemarks && <div className="fd-apd">Done: {x.doneRemarks}</div>}
                {note?.id === x.id && <div className="fd-rej"><textarea className="a-input" rows={2} placeholder="What happened? (required)" value={note.text} onChange={e => setNote({ ...note, text: e.target.value })} autoFocus /><div><button type="button" className="a-mini" onClick={() => setNote(null)}>Cancel</button><button type="button" className="a-mini ok" disabled={!note.text.trim()} onClick={() => markDone(x.id, note.text.trim())}>Mark done</button></div></div>}
              </div>
              <div className="fd-apa">{x.status === 'Open' ? <button type="button" className="a-mini ok" onClick={() => setNote({ id: x.id, text: '' })}>Done…</button> : <button type="button" className="a-mini" onClick={() => act(x.id, 'reopen')}>Reopen</button>}</div>
            </div>
          ))}
        </div>
        <Empty t={f} /><Pager t={f} />
      </section>
    </>
  );
}
