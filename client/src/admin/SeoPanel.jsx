// "SEO · how this appears on Google": the title, description and keywords search engines show, with a live preview.
// Used by the blog and site-page editors. `value` is { metaTitle, metaDesc, metaKeywords, noindex }; `onChange` gets the changed fields.
import './seoPanel.css';

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'best', 'top', 'your', 'are', 'you', 'how', 'what']);
const keywordsFrom = (...texts) => [...new Set(texts.join(' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3 && !STOP.has(w)))].slice(0, 10).join(', ');
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…');

export function SeoPanel({ value, onChange, path, title, summary, category }) {
  const v = { metaTitle: '', metaDesc: '', metaKeywords: '', noindex: false, ...value };
  const shownTitle = v.metaTitle || (title ? `${title} | AR Trade International` : 'Page title | AR Trade International');
  const shownDesc = v.metaDesc || summary || 'Without a description, Google picks a few lines from the page text.';
  const suggest = () => onChange({
    metaTitle: clip(title ? `${title} | AR Trade` : '', 60),
    metaDesc: clip(summary || '', 155),
    metaKeywords: keywordsFrom(title || '', category || '', summary || '')
  });
  const counter = (n, max) => <small className={'seo-n' + (n > max ? ' over' : '')}>{n}/{max} recommended</small>;
  return (
    <section className="seo">
      <header><b>SEO</b><span>How this appears on Google</span>
        <button type="button" className="a-btn ghost sm" onClick={suggest} disabled={!title}>Suggest from the page</button></header>
      <div className={'seo-prev' + (v.noindex ? ' off' : '')} aria-label="Search result preview">
        <small>artradeinternational.com › {String(path || '').replace(/^\//, '').replace(/\//g, ' › ')}</small>
        <b>{clip(shownTitle, 62)}</b>
        <p>{clip(shownDesc, 160)}</p>
        {v.noindex && <i>Hidden from search engines</i>}
      </div>
      <label className="a-lbl">SEO title {counter(v.metaTitle.length, 60)}<input className="a-input" maxLength={160} value={v.metaTitle} onChange={e => onChange({ metaTitle: e.target.value })} placeholder={title ? `${title} | AR Trade International` : ''} /></label>
      <label className="a-lbl">Meta description {counter(v.metaDesc.length, 160)}<textarea className="a-input" rows={3} maxLength={320} value={v.metaDesc} onChange={e => onChange({ metaDesc: e.target.value })} placeholder="One or two sentences that make someone click" /></label>
      <label className="a-lbl">Keywords <small className="seo-n">comma separated, most important first</small><textarea className="a-input" rows={2} maxLength={500} value={v.metaKeywords} onChange={e => onChange({ metaKeywords: e.target.value })} placeholder="toner price in bangladesh, printer servicing dhaka" /></label>
      <label className="seo-hide"><input type="checkbox" checked={!!v.noindex} onChange={e => onChange({ noindex: e.target.checked })} /><span><b>Hide from search engines</b><small>Adds noindex and removes the page from the sitemap</small></span></label>
    </section>
  );
}
