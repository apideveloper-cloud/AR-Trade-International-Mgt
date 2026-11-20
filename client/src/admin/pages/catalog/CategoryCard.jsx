import { IconBtn } from '../../IconBtn.jsx';
import { Switch } from '../../ui.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';

const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

/** Hidden file input that hands the chosen picture to `onPick` and clears itself. */
const PhotoInput = ({ onPick }) => <input type="file" accept={IMAGE_TYPES} hidden onChange={e => { onPick(e.target.files[0]); e.target.value = ''; }} />;

/** One category tile: picture, name, counts and the photo / edit / delete / visibility actions. */
export function CategoryCard({ c, busy, onPick, onEdit, onRemove, onClearPicture, onToggle }) {
  const tr = useT();
  return (
    <div className="a-card acat-card">
      <label className="cat-pic" title={c.img ? tr('Change picture') : tr('Add a picture')} style={{ backgroundImage: c.img ? `url('${c.img}')` : 'none', opacity: busy ? .5 : 1 }}>
        {!c.img && <span>＋<small>{tr('Photo')}</small></span>}
        <PhotoInput onPick={onPick} />
      </label>
      <div className="acat-body">
        <b>{c.title}</b>
        <span className="acat-meta">{tr('{n} products', { n: c.count })} · {c.hidden ? tr('hidden on store') : tr('visible')}</span>
        <span className="acat-meta">{c.description}</span>
        <span className="acat-acts">
          <label className="acat-link">{busy ? tr('Uploading…') : c.img ? tr('Change photo') : tr('Add photo')}<PhotoInput onPick={onPick} /></label>
          <span className="ic-row"><IconBtn icon="edit" title={tr('Edit the name and description')} onClick={onEdit} />
            {!c.total && <IconBtn icon="trash" tone="bad" title={tr('Delete this empty category')} onClick={onRemove} />}</span>
          {c.img && <button type="button" className="acat-rm" onClick={onClearPicture}>{tr('Remove')}</button>}
        </span>
      </div>
      <Switch on={!c.hidden} onChange={onToggle} title={tr('Visible on the store')} />
    </div>
  );
}
