import './blogAdmin.css';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';

const IMG_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

/** Formatting buttons above a contentEditable body (bold, headings, lists, link, image upload). */
export function RichToolbar({ tools, cmd, uploading, onImage, linkTitle, roomy }) {
  const tr = useT();
  const addLink = () => { const u = window.prompt(tr('Link address (https://…)')); if (u) cmd('createLink', u); };
  return (
    <div className={'blg-tb' + (roomy ? ' blg-tb-roomy' : '')}>
      {tools.map(([l, t, fn, cls]) => <button key={l} type="button" title={tr(t)} onMouseDown={e => e.preventDefault()} onClick={() => fn(cmd)} className={'a-btn ghost sm' + (cls ? ' ' + cls : '')}>{tr(l)}</button>)}
      <button type="button" title={linkTitle ? tr(linkTitle) : undefined} onMouseDown={e => e.preventDefault()} onClick={addLink} className="a-btn ghost sm">🔗 {tr('Link')}</button>
      <label className="a-btn ghost sm blg-pick">{uploading ? tr('Uploading…') : '🖼 ' + tr('Image')}<input type="file" accept={IMG_TYPES} hidden onChange={onImage} /></label>
    </div>
  );
}
