import { Pager } from './IssueList.jsx';
import { pathOf, richUrl, sevOf } from './ovApi.js';
import { useT } from '../../i18n/lang.jsx';

const TABS = [['', 'All'], ['error', 'Errors'], ['warning', 'Warnings']];
const KINDS = ['home', 'product', 'category', 'brand', 'blog', 'page'];
const abs = u => (/^https?:/i.test(u || '') ? u : window.location.origin + (u || '/'));

/** Problems by type, filters and the list of pages with problems. */
export default function SdList({ d, f, set, page, setPage }) {
  const tr = useT();
  const codes = d.byCode || [], rows = d.rows || [];
  return (
    <section className="a-card adov-sec">
      <h3>{tr('Problems found')}</h3>
      {codes.length > 0 && (
        <div className="adov-chips" aria-label={tr('Problems by type')}>
          {codes.map(c => {
            const s = sevOf(c.severity);
            return (
              <button key={c.code} type="button" title={c.hint ? tr(c.hint) : ''} aria-pressed={f.code === c.code} className={'adov-chip' + (f.code === c.code ? ' on' : '')} onClick={() => set({ code: f.code === c.code ? '' : c.code })}>
                <span aria-hidden="true">{s.icon}</span> {c.label ? tr(c.label) : c.code} <b>{c.count}</b>
              </button>
            );
          })}
        </div>
      )}
      <div className="adov-top">
        <div className="adov-tabs" role="group" aria-label={tr('Show')}>
          {TABS.map(([v, l]) => <button key={v} type="button" aria-pressed={f.severity === v} className={'adov-tab' + (f.severity === v ? ' on' : '')} onClick={() => set({ severity: v })}>{tr(l)}</button>)}
        </div>
        <label className="adov-sel">{tr('Page type')}
          <select value={f.kind} onChange={e => set({ kind: e.target.value })}>
            <option value="">{tr('All types')}</option>
            {KINDS.map(k => <option key={k} value={k}>{tr(k[0].toUpperCase() + k.slice(1))}</option>)}
          </select>
        </label>
        {(f.code || f.severity || f.kind) && <button type="button" className="a-btn sm" onClick={() => set({ code: '', severity: '', kind: '' })}>{tr('Clear filters')}</button>}
      </div>
      {rows.length === 0 && <p className="adov-ok">✔ {d.lastRun ? tr('No problems found here') : tr('No check has been run yet. Press Check now.')}</p>}
      <ul className="adov-list">
        {rows.map((r, i) => {
          const s = sevOf(r.severity);
          return (
            <li key={r.url + r.code + i} className="adov-item adov-col">
              <div className="adov-row">
                <span className={'adov-badge ' + s.cls}><span aria-hidden="true">{s.icon}</span> {tr(s.label)}</span>
                <b className="adov-wrap">{r.label ? tr(r.label) : r.code}</b>
              </div>
              <span className="adov-sub adov-wrap">{pathOf(r.url)}{r.productName ? ' (' + r.productName + ')' : ''}{r.type ? ' · ' + r.type : ''}{r.kind ? ' · ' + r.kind : ''}</span>
              {r.hint && <span className="adov-wrap">{tr(r.hint)}</span>}
              {r.detail && <span className="adov-sub adov-wrap">{tr(r.detail)}</span>}
              <a className="adov-link" href={richUrl(abs(r.url))} target="_blank" rel="noreferrer noopener">{tr("Test this page in Google's tool")}</a>
            </li>
          );
        })}
      </ul>
      <Pager page={d.page || page} pages={d.pages || 1} setPage={setPage} />
    </section>
  );
}
