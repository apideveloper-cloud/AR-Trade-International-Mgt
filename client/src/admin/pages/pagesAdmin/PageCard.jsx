import { IconBtn } from '../../IconBtn.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';

/** One static page in the grid: cover (or icon), live/draft badge, title, summary and edit / delete icons. */
export function PageCard({ r, icon, hue, canDelete, onEdit, onDelete }) {
  const tr = useT();
  return (
    <article className={'pg-it' + (r.status === 'Published' ? '' : ' draft')} style={{ '--h': hue }}>
      <button type="button" className="pg-cover" onClick={() => onEdit(r.id)} aria-label={tr('Edit {title}', { title: r.title })}>
        {r.cover ? <><span className="pg-bk" style={{ backgroundImage: `url('${r.cover}')` }} /><img src={r.cover} alt="" loading="lazy" /></> : <span className="pg-none">{icon}<small>{tr('No cover image')}</small></span>}
        <span className={'pg-st ' + (r.status === 'Published' ? 'live' : 'dr')}>{r.status === 'Published' ? tr('● Live') : tr('○ Draft')}</span>
        <em className="pg-ed">✎ {tr('Edit page')}</em>
      </button>
      <div className="pg-b">
        <div className="pg-t"><b>{r.title}</b>{r.edited && <em>{tr('edited')}</em>}</div>
        <p>{r.excerpt || tr('No summary yet.')}</p>
        <div className="pg-act">
          <IconBtn icon="edit" tone="pri" title={tr('Edit the page')} onClick={() => onEdit(r.id)} />
          {canDelete && <IconBtn icon="trash" tone="bad" title={tr('Delete the page')} onClick={() => onDelete(r)} />}
        </div>
      </div>
    </article>
  );
}
