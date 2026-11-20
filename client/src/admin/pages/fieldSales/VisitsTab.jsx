import { Empty, Pager, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Av, Chip, fDate, fTime, taka, toneOf } from '../../fieldKit.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/field.js';

const STATUS_FILTER = [{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: [{ v: 'Planned', t: 'Planned' }, { v: 'InProgress', t: 'In progress' }, { v: 'Done', t: 'Done' }] }];

/** The visits tab: filters, the week strip and one card per visit. `v` is the visits table, `vt` the same table with the date-aware setter for the filter. */
export function VisitsTab({ v, vt }) {
  const tr = useT();
  const one = v.params.from && v.params.from === v.params.to;
  const goDay = d => v.set({ from: d, to: d, date: d });
  const vd = v.data;
  return (
    <>
      <ListFilter t={vt} noun="visit" title="Search visits" search={{ placeholder: 'Customer, area, contact or purpose' }} selects={STATUS_FILTER} range={{ label: 'Visit date', def: 'today' }} />
      <section className="a-card">
        <div className="fd-week">{(vd.week || []).map(d => <button key={d.date} type="button" disabled={d.off} className={(one && d.date === v.params.from ? 'on ' : '') + (d.count ? 'has' : '')} onClick={() => goDay(d.date)}><small>{d.dn}</small><b>{d.dt}</b><em>{d.off ? tr('off') : d.count || '·'}</em></button>)}</div>
        <div className="fd-bar"><span className="fd-sub">{v.loading && !vd.visits ? '…' : tr(vd.total === 1 ? '{period} · 1 visit, {done} done' : '{period} · {n} visits, {done} done', { period: one ? fDate(v.params.from) : tr('Selected period'), n: vd.total, done: vd.done })}</span></div>
        <Toolbar t={v} search={false} />
        <div className="fd-appr" style={{ opacity: v.loading ? 0.6 : 1 }}>
          {(vd.rows || []).map(x => (
            <div key={x.id} className="fd-ap">
              <Av name={x.customer} />
              <div className="fd-apb">
                <div className="fd-aph"><b>{x.customer}</b><Chip tone={toneOf(x.status)}>{tr(x.status === 'InProgress' ? 'In progress' : x.status)}</Chip><Chip tone="blue">{tr(x.purpose)}</Chip></div>
                <div className="fd-aps">{!one && fDate(x.date) + ' · '}{x.time} · {x.area || x.address} {x.contact ? '· ' + x.contact : ''}</div>
                <div className="fd-apm">{x.checkIn && <span>{tr('In {time}', { time: fTime(x.checkIn) })}</span>}{x.checkOut && <span>{tr('Out {time}', { time: fTime(x.checkOut) })}</span>}{x.outcome && <span><b>{x.outcome}</b></span>}{x.orderValue > 0 && <strong>{taka(x.orderValue)}</strong>}</div>
                {x.notes && <div className="fd-apd">{x.notes}</div>}{x.followupAction && <div className="fd-apd">{tr('Follow-up: {action}', { action: x.followupAction })}{x.followupWhen ? ' · ' + x.followupWhen : ''}</div>}
              </div>
            </div>
          ))}
        </div>
        <Empty t={v} /><Pager t={v} />
      </section>
    </>
  );
}
