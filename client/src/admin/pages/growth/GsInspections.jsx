import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { useT } from '../../i18n/lang.jsx';
import { Msg, Section } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import { send, gsMsg, dt, day } from './gsApi.js';

const TABS = [['', 'All'], ['indexed', 'Indexed'], ['not_indexed', 'Not indexed'], ['unknown', 'Unknown'], ['never', 'Not checked']];
const BADGE = { indexed: ['✔', 'Indexed', 'adgs-b-ok'], not_indexed: ['✖', 'Not indexed', 'adgs-b-no'], unknown: ['?', 'Unknown', 'adgs-b-un'] };
const path = u => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };

function Row({ r, onRow }) {
  const tr = useT();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const bb = BADGE[r.classification] || ['○', 'Not checked yet', 'adgs-b-nc'];
  const b = [bb[0], tr(bb[1]), bb[2]];
  const mismatch = r.googleCanonical && r.userCanonical && r.googleCanonical !== r.userCanonical;
  const inspect = async () => {
    setBusy('check'); setMsg(null);
    const x = await send('/growth/gsc/inspect', { url: r.url });
    setBusy('');
    if (x.ok) onRow({ ...r, ...(x.body.row || x.body) }); else setMsg(x.status === 429 ? { ok: false, text: tr("Too many checks right now or today's limit is used. Please try again later.") } : gsMsg(x, undefined, tr));
  };
  const request = async () => {
    setBusy('req'); setMsg(null);
    let link;
    try { link = (await adm.get('/growth/gsc/deeplink?url=' + encodeURIComponent(r.url))).link; } catch (e) { setBusy(''); return setMsg({ ok: false, text: tr(e.message || 'Could not get the Search Console link.') }); }
    if (link) window.open(link, '_blank', 'noreferrer');
    const x = await send('/growth/gsc/requested', { url: r.url });
    setBusy('');
    if (x.ok) onRow({ ...r, requestedAt: x.body.requestedAt || new Date().toISOString() }); else setMsg(gsMsg(x, undefined, tr));
  };
  return (
    <tr>
      <td className="adgr-wrap"><b>{path(r.url)}</b>{r.productName && <div className="adgs-sm">{r.productName}</div>}</td>
      <td><span className={'adgs-badge ' + b[2]}><span aria-hidden="true">{b[0]}</span> {b[1]}</span></td>
      <td className="adgr-wrap">{r.coverageState || '-'}{r.coverageNote && <div className="adgs-sm">{r.coverageNote}</div>}
        {r.error && <div className="adgs-sm">{tr('Problem: {err}', { err: r.error })}</div>}
        {mismatch && <div className="adgs-sm">{tr('Google picked a different main page: {url}', { url: r.googleCanonical })}</div>}</td>
      <td>{r.lastCrawl ? day(r.lastCrawl, tr) : tr('Not yet')}<div className="adgs-sm">{tr('Checked {when}', { when: r.inspectedAt ? dt(r.inspectedAt, tr) : tr('never') })}</div></td>
      <td>
        <button type="button" className="a-btn ghost sm" disabled={!!busy} onClick={inspect}>{busy === 'check' ? tr('Checking...') : tr('Check now')}</button>
        {r.classification === 'not_indexed' && (r.requestedAt
          ? <div className="adgs-sm">{tr('Requested on {date}', { date: day(r.requestedAt, tr) })}</div>
          : <button type="button" className="a-btn sm" disabled={!!busy} onClick={request}>{busy === 'req' ? tr('Opening...') : tr('Request indexing')}</button>)}
        <Msg m={msg} />
      </td>
    </tr>
  );
}

/** E. Inspected pages, 15 per page, with filters. */
export default function GsInspections({ tick }) {
  const tr = useT();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  const res = useApiData(() => adm.get(`/growth/gsc/inspections?status=${status}&q=${encodeURIComponent(term)}&page=${page}&limit=15`), [status, term, page, tick]);
  const d = res.data;
  const onRow = row => res.setData(p => ({ ...p, rows: p.rows.map(x => (x.url === row.url ? row : x)) }));
  return (
    <Section title={tr('Page by page')} what={tr('What Google says about each page. Google only lets you request indexing yourself in Search Console. We open the right page for you.')}>
      <div className="adgs-row" role="group" aria-label={tr('Show pages')}>
        {TABS.map(([v, t]) => <button key={v} type="button" className={'a-btn sm' + (status === v ? '' : ' ghost')} aria-pressed={status === v} onClick={() => { setStatus(v); setPage(1); }}>{tr(t)}</button>)}
        <input className="a-in adgs-search" type="search" placeholder={tr('Search address or product')} aria-label={tr('Search pages')} value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Msg m={res.error ? { ok: false, text: tr(res.error) } : null} />
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>{tr('Page')}</th><th>{tr('Status')}</th><th>{tr('What Google says')}</th><th>{tr('Last crawled')}</th><th /></tr></thead>
          <tbody>
            {(d?.rows || []).map(r => <Row key={r.url} r={r} onRow={onRow} />)}
            {d && !d.rows?.length && <tr><td colSpan={5}>{tr('No pages here yet.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
    </Section>
  );
}
