import { dateF } from '../../adminApi.js';
import { Pill } from '../../ui.jsx';
import { IconBtn } from '../../IconBtn.jsx';
import './blogAdmin.css';

/** One article in the blog list: cover thumbnail, title, status, meta line and the view / edit / delete icons. */
export function ArticleRow({ r, canDelete, onEdit, onDelete }) {
  return (
    <div className="a-card blg-row">
      <div className="bl-cover blg-thumb" style={r.cover ? { backgroundImage: `url('${r.cover}')` } : undefined} />
      <div className="blg-info">
        <div className="blg-head"><b>{r.title}</b><Pill s={r.status === 'Published' ? 'Active' : 'Pending'} label={r.status} /></div>
        <span className="blg-meta">{r.category} · {dateF(r.date)} · by {r.author}{r.updated ? ' · edited' : ''}</span>
      </div>
      <div className="ic-row">
        {r.status === 'Published' && <IconBtn icon="view" title="View on the site" href={'/blog/' + encodeURIComponent(r.slug)} />}
        <IconBtn icon="edit" tone="pri" title="Edit the article" onClick={() => onEdit(r.id)} />
        {canDelete && <IconBtn icon="trash" tone="bad" title="Delete the article" onClick={() => onDelete(r)} />}
      </div>
    </div>
  );
}
