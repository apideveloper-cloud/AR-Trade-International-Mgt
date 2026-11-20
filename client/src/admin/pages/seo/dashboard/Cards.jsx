import { filterForIssue, n0 } from './dashModel.js';
import { trServer } from '../seoModel.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

/** Issues to fix: one bar per issue, biggest first, with a View button. */
export function IssuesCard({ issues, onGoto }) {
  const tr = useT();
  const list = [...(issues || [])].sort((a, b) => b.count - a.count);
  const max = Math.max(...list.map(i => i.count), 1);
  return (
    <div className="a-card adds-card adds-wide">
      <b>{tr('Issues to fix')}</b>
      {!list.length && <span className="adseo-hint">{tr('No issues found.')}</span>}
      <ul className="adds-issues">
        {list.map(i => (
          <li key={i.id} className="adds-issue">
            <div className="adds-issue-t"><span>{tr(i.label)}</span><b>{n0(i.count)}</b></div>
            <div className="adds-bar"><i className={'adds-fill ' + (i.level === 'error' || i.level === 'bad' ? 'is-bad' : 'is-warn')} style={{ width: Math.max(i.count ? 3 : 0, (i.count / max) * 100) + '%' }} /></div>
            <button type="button" className="a-mini" disabled={!i.count} onClick={() => onGoto('products', filterForIssue(i.id))}>{tr('View')}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Groups of products that share a title or description. */
export function DuplicatesCard({ dup }) {
  const tr = useT();
  const s = dup?.samples || [];
  return (
    <div className="a-card adds-card">
      <b>{tr('Duplicates')}</b>
      <span className="adseo-hint">{tr('{a} duplicate titles · {b} duplicate descriptions', { a: n0(dup?.titles), b: n0(dup?.descriptions) })}</span>
      {!s.length && <span className="adseo-hint">{tr('No duplicate groups to show.')}</span>}
      <ul className="adds-dups">
        {s.map((g, i) => (
          <li key={i}>
            <span className="adds-kind">{tr(g.kind)}</span>
            <span className="adds-clip" title={g.text}>{g.text}</span>
            <span className="adds-chips">{(g.ids || []).map(id => <em key={id} className="adds-chip">#{id}</em>)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Stat = ({ k, v }) => { const tr = useT(); return <li><span>{tr(k)}</span><b>{n0(v)}</b></li>; };

export function BrandsCard({ brands, onGoto }) {
  const tr = useT();
  const b = brands || {};
  return (
    <div className="a-card adds-card">
      <b>{tr('Brands')}</b>
      <ul className="adds-stats"><Stat k="Total" v={b.total} /><Stat k="Indexed" v={b.indexed} /><Stat k="Thin (fewer than 3 products)" v={b.thin} /><Stat k="Hidden" v={b.hidden} /></ul>
      <button type="button" className="a-btn ghost sm" onClick={() => onGoto('brands')}>{tr('Manage brands')}</button>
    </div>
  );
}

export function SitemapCard({ sitemap, note }) {
  const tr = useT();
  const s = sitemap || {};
  return (
    <div className="a-card adds-card">
      <b>{tr('Sitemap')}</b>
      <ul className="adds-stats"><Stat k="Products" v={s.products} /><Stat k="Categories" v={s.categories} /><Stat k="Blog" v={s.blog} /><Stat k="Pages" v={s.pages} /><Stat k="Brands" v={s.brands} /></ul>
      {s.generatedAt && <span className="adseo-hint">{tr('Last generated: {when}', { when: new Date(s.generatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}</span>}
      {note && <span className="adseo-hint">{trServer(tr, note)}</span>}
      <a className="adds-link" href="/sitemap.xml" target="_blank" rel="noreferrer">/sitemap.xml</a>
    </div>
  );
}

export function RedirectsCard({ redirects }) {
  const tr = useT();
  const r = redirects || {};
  return (
    <div className="a-card adds-card">
      <b>{tr('Redirects')}</b>
      <ul className="adds-stats"><Stat k="Total" v={r.total} /><Stat k="Automatic" v={r.auto} /><Stat k="Visits through redirects" v={r.hits} /></ul>
    </div>
  );
}
