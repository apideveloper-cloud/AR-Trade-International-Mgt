import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import { send, gsMsg, dt, day } from './gsApi.js';

const TABS = [['', 'All'], ['indexed', 'Indexed'], ['not_indexed', 'Not indexed'], ['unknown', 'Unknown'], ['never', 'Not checked']];
const BADGE = { indexed: ['✔', 'Indexed', 'adgs-b-ok'], not_indexed: ['✖', 'Not indexed', 'adgs-b-no'], unknown: ['?', 'Unknown', 'adgs-b-un'] };
const path = u => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };

function Row({ r, onRow }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const b = BADGE[r.classification] || ['○', 'Not checked yet', 'adgs-b-nc'];
  const mismatch = r.googleCanonical && r.userCanonical && r.googleCanonical !== r.userCanonical;
  const inspect = async () => {
    setBusy('check'); setMsg(null);
    const x = await send('/growth/gsc/inspect', { url: r.url });
    setBusy('');
    if (x.ok) onRow({ ...r, ...(x.body.row || x.body) }); else setMsg(x.status === 429 ? { ok: false, text: 'Too many checks right now or today\'s limit is used. Please try again later.' } : gsMsg(x));
  };
  const request = async () => {
    setBusy('req'); setMsg(null);
    let link;
    try { link = (await adm.get('/growth/gsc/deeplink?url=' + encodeURIComponent(r.url))).link; } catch (e) { setBusy(''); return setMsg({ ok: false, text: e.message || 'Could not get the Search Console link.' }); }
    if (link) window.open(link, '_blank', 'noreferrer');
    const x = await send('/growth/gsc/requested', { url: r.url });
    setBusy('');
    if (x.ok) onRow({ ...r, requestedAt: x.body.requestedAt || new Date().toISOString() }); else setMsg(gsMsg(x));
  };
  return (
    <tr>
      <td className="adgr-wrap"><b>{path(r.url)}</b>{r.productName && <div className="adgs-sm">{r.productName}</div>}</td>
      <td><span className={'adgs-badge ' + b[2]}><span aria-hidden="true">{b[0]}</span> {b[1]}</span></td>
      <td className="adgr-wrap">{r.coverageState || '-'}{r.coverageNote && <div className="adgs-sm">{r.coverageNote}</div>}
        {r.error && <div className="adgs-sm">Problem: {r.error}</div>}
        {mismatch && <div className="adgs-sm">Google picked a different main page: {r.googleCanonical}</div>}</td>
      <td>{r.lastCrawl ? day(r.lastCrawl) : 'Not yet'}<div className="adgs-sm">Checked {r.inspectedAt ? dt(r.inspectedAt) : 'never'}</div></td>
      <td>
        <button type="button" className="a-btn ghost sm" disabled={!!busy} onClick={inspect}>{busy === 'check' ? 'Checking...' : 'Check now'}</button>
        {r.classification === 'not_indexed' && (r.requestedAt
          ? <div className="adgs-sm">Requested on {day(r.requestedAt)}</div>
          : <button type="button" className="a-btn sm" disabled={!!busy} onClick={request}>{busy === 'req' ? 'Opening...' : 'Request indexing'}</button>)}
        <Msg m={msg} />
      </td>
    </tr>
  );
}

/** E. Inspected pages, 15 per page, with filters. */
export default function GsInspections({ tick }) {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);
  const res = useApiData(() => adm.get(`/growth/gsc/inspections?status=${status}&q=${encodeURIComponent(term)}&page=${page}&limit=15`), [status, term, page, tick]);
  const d = res.data;
  const onRow = row => res.setData(p => ({ ...p, rows: p.rows.map(x => (x.url === row.url ? row : x)) }));
  return (
    <Section title="Page by page" what="What Google says about each page. Google only lets you request indexing yourself in Search Console. We open the right page for you.">
      <div className="adgs-row" role="group" aria-label="Show pages">
        {TABS.map(([v, t]) => <button key={v} type="button" className={'a-btn sm' + (status === v ? '' : ' ghost')} aria-pressed={status === v} onClick={() => { setStatus(v); setPage(1); }}>{t}</button>)}
        <input className="a-in adgs-search" type="search" placeholder="Search address or product" aria-label="Search pages" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Msg m={res.error ? { ok: false, text: res.error } : null} />
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>Page</th><th>Status</th><th>What Google says</th><th>Last crawled</th><th /></tr></thead>
          <tbody>
            {(d?.rows || []).map(r => <Row key={r.url} r={r} onRow={onRow} />)}
            {d && !d.rows?.length && <tr><td colSpan={5}>No pages here yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
    </Section>
  );
}
