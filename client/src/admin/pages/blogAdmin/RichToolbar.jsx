import './blogAdmin.css';

const IMG_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

/** Formatting buttons above a contentEditable body (bold, headings, lists, link, image upload). */
export function RichToolbar({ tools, cmd, uploading, onImage, linkTitle, roomy }) {
  const addLink = () => { const u = window.prompt('Link address (https://…)'); if (u) cmd('createLink', u); };
  return (
    <div className={'blg-tb' + (roomy ? ' blg-tb-roomy' : '')}>
      {tools.map(([l, t, fn, cls]) => <button key={l} type="button" title={t} onMouseDown={e => e.preventDefault()} onClick={() => fn(cmd)} className={'a-btn ghost sm' + (cls ? ' ' + cls : '')}>{l}</button>)}
      <button type="button" title={linkTitle} onMouseDown={e => e.preventDefault()} onClick={addLink} className="a-btn ghost sm">🔗 Link</button>
      <label className="a-btn ghost sm blg-pick">{uploading ? 'Uploading…' : '🖼 Image'}<input type="file" accept={IMG_TYPES} hidden onChange={onImage} /></label>
    </div>
  );
}
