import { IconBtn } from '../../IconBtn.jsx';
import { Switch } from '../../ui.jsx';

const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

/** Hidden file input that hands the chosen picture to `onPick` and clears itself. */
const PhotoInput = ({ onPick }) => <input type="file" accept={IMAGE_TYPES} hidden onChange={e => { onPick(e.target.files[0]); e.target.value = ''; }} />;

/** One category tile: picture, name, counts and the photo / edit / delete / visibility actions. */
export function CategoryCard({ c, busy, onPick, onEdit, onRemove, onClearPicture, onToggle }) {
  return (
    <div className="a-card acat-card">
      <label className="cat-pic" title={c.img ? 'Change picture' : 'Add a picture'} style={{ backgroundImage: c.img ? `url('${c.img}')` : 'none', opacity: busy ? .5 : 1 }}>
        {!c.img && <span>＋<small>Photo</small></span>}
        <PhotoInput onPick={onPick} />
      </label>
      <div className="acat-body">
        <b>{c.title}</b>
        <span className="acat-meta">{c.count} products · {c.hidden ? 'hidden on store' : 'visible'}</span>
        <span className="acat-meta">{c.description}</span>
        <span className="acat-acts">
          <label className="acat-link">{busy ? 'Uploading…' : c.img ? 'Change photo' : 'Add photo'}<PhotoInput onPick={onPick} /></label>
          <span className="ic-row"><IconBtn icon="edit" title="Edit the name and description" onClick={onEdit} />
            {!c.total && <IconBtn icon="trash" tone="bad" title="Delete this empty category" onClick={onRemove} />}</span>
          {c.img && <button type="button" className="acat-rm" onClick={onClearPicture}>Remove</button>}
        </span>
      </div>
      <Switch on={!c.hidden} onChange={onToggle} title="Visible on the store" />
    </div>
  );
}
