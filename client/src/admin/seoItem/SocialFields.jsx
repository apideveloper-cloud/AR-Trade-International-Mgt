const host = u => { try { return new URL(u).host; } catch { return 'artradeinternational.com'; } };

/** Open Graph and Twitter fields with a Facebook-style card. */
export function SocialFields({ manual, set, auto, url }) {
  const title = manual.ogTitle || auto?.ogTitle || auto?.title || '';
  const desc = manual.ogDescription || auto?.ogDescription || auto?.description || '';
  const f = (k, label, area) => {
    const Tag = area ? 'textarea' : 'input';
    return <label className="a-lbl">{label}<Tag className="a-input" rows={area ? 2 : undefined} maxLength={300} value={manual[k] || ''} onChange={e => set({ [k]: e.target.value })} /></label>;
  };
  return (
    <div className="adsi-sec">
      <div className="adsi-hd"><b>Social sharing</b></div>
      <div className="adsi-two">
        <div className="adsi-stack">
          {f('ogTitle', 'Share title (Facebook / OG)')}
          {f('ogDescription', 'Share description', true)}
          <label className="a-lbl">Share image <small className="adsi-note">path or https address</small>
            <input className="a-input" value={manual.ogImage || ''} onChange={e => set({ ogImage: e.target.value })} placeholder="/uploads/..." /></label>
          {f('twitterTitle', 'Twitter title')}
          {f('twitterDescription', 'Twitter description', true)}
        </div>
        <div className="adsi-fb" aria-label="Share card preview">
          <div className="adsi-fb-img">{manual.ogImage ? <img src={manual.ogImage} alt="" /> : <span>No image</span>}</div>
          <div className="adsi-fb-tx"><small>{host(url).toUpperCase()}</small><b>{title || 'Title'}</b><span>{desc}</span></div>
        </div>
      </div>
    </div>
  );
}
