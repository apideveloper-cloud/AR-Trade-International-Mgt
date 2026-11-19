import { IconBtn } from '../../IconBtn.jsx';

/** One static page in the grid: cover (or icon), live/draft badge, title, summary and edit / delete icons. */
export function PageCard({ r, icon, hue, canDelete, onEdit, onDelete }) {
  return (
    <article className={'pg-it' + (r.status === 'Published' ? '' : ' draft')} style={{ '--h': hue }}>
      <button type="button" className="pg-cover" onClick={() => onEdit(r.id)} aria-label={'Edit ' + r.title}>
        {r.cover ? <><span className="pg-bk" style={{ backgroundImage: `url('${r.cover}')` }} /><img src={r.cover} alt="" loading="lazy" /></> : <span className="pg-none">{icon}<small>No cover image</small></span>}
        <span className={'pg-st ' + (r.status === 'Published' ? 'live' : 'dr')}>{r.status === 'Published' ? '● Live' : '○ Draft'}</span>
        <em className="pg-ed">✎ Edit page</em>
      </button>
      <div className="pg-b">
        <div className="pg-t"><b>{r.title}</b>{r.edited && <em>edited</em>}</div>
        <p>{r.excerpt || 'No summary yet.'}</p>
        <div className="pg-act">
          <IconBtn icon="edit" tone="pri" title="Edit the page" onClick={() => onEdit(r.id)} />
          {canDelete && <IconBtn icon="trash" tone="bad" title="Delete the page" onClick={() => onDelete(r)} />}
        </div>
      </div>
    </article>
  );
}
