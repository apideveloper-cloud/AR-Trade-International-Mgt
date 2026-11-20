import { useMemo, useState } from 'react';
import { useT } from '../../i18n/lang.jsx';
import { Section } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import { nf, pct, pos } from './gsApi.js';

const SORTS = [['clicks', 'Clicks'], ['impressions', 'Impressions'], ['position', 'Position (best first)']];

function Change({ cur, prev }) {
  const tr = useT();
  if (prev == null) return <span className="adgs-sm">{tr('new')}</span>;
  const d = cur - prev;
  if (!d) return <span>■ {tr('same')}</span>;
  return <span>{d > 0 ? '▲ ' : '▼ '}{d > 0 ? tr('+{n} more', { n: nf(Math.abs(d)) }) : tr('-{n} fewer', { n: nf(Math.abs(d)) })}</span>;
}

function Table({ title, what, rows, field, label, go }) {
  const tr = useT();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('clicks');
  const [page, setPage] = useState(1);
  const list = useMemo(() => {
    const f = rows.filter(r => !q || String(r[field]).toLowerCase().includes(q.toLowerCase()));
    return f.sort((a, b) => (sort === 'position' ? a.position - b.position : b[sort] - a[sort]));
  }, [rows, q, sort, field]);
  const pages = Math.max(1, Math.ceil(list.length / 15));
  const p = Math.min(page, pages);
  return (
    <Section title={title} what={what}>
      <div className="adgs-row">
        <input className="a-in adgs-search" type="search" placeholder={tr('Search')} aria-label={tr('Search {title}', { title })} value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select className="a-in adgs-sel" aria-label={tr('Sort by')} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
          {SORTS.map(([v, t]) => <option key={v} value={v}>{tr('Sort: {name}', { name: tr(t) })}</option>)}
        </select>
      </div>
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>{label}</th><th>{tr('Clicks')}</th><th>{tr('Change')}</th><th>{tr('Impressions')}</th><th>{tr('Click rate')}</th><th>{tr('Position')}</th></tr></thead>
          <tbody>
            {list.slice((p - 1) * 15, p * 15).map((r, i) => (
              <tr key={r[field] + i}>
                <td className="adgr-wrap">{r[field]}{r.productId ? <> <button type="button" className="admc-chip" onClick={() => go('products')}>{tr('Product #{id}', { id: r.productId })}</button></> : null}</td>
                <td>{nf(r.clicks)}</td><td><Change cur={r.clicks} prev={r.prevClicks} /></td><td>{nf(r.impressions)}</td><td>{pct(r.ctr)}</td><td>{pos(r.position)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6}>{tr('Nothing to show yet.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={p} pages={pages} setPage={setPage} />
    </Section>
  );
}

/** C. Top 100 search queries and top 100 pages. */
export default function GsTables({ data, go }) {
  const tr = useT();
  return (
    <>
      <Table title={tr('What people searched for')} what={tr('The words people typed into Google before they saw or clicked your site. Change compares clicks with the 28 days before.')} rows={data.topQueries || []} field="query" label={tr('Search words')} go={go} />
      <Table title={tr('Your most visible pages')} what={tr('The pages of your site that Google showed most.')} rows={data.topPages || []} field="page" label={tr('Page')} go={go} />
    </>
  );
}
