const over = (text, max) => ((text || '').length > max ? '#b3261e' : undefined);

/** SEO / Google listing card of the product form, with an Auto-fill button. */
export function ProductSeoCard({ f, setF, on }) {
  const autoFill = () => setF(s => ({ ...s, metaTitle: s.name + ' Price in Bangladesh | AR Trade', metaDesc: `${s.name}. Buy online in Dhaka, Bangladesh. Genuine, fast delivery.`, metaKeywords: [s.name, s.brand && `${s.brand} ${s.part || ''}`.trim(), s.part, `${s.name} price in Bangladesh`, 'AR Trade International'].filter(Boolean).join(', ') }));
  return (
    <section className="pf-card pf-seo">
      <h4>SEO · Google listing
        <button type="button" className="a-btn" onClick={autoFill}>Auto-fill</button>
      </h4>
      <label className="a-lbl">SEO title <small style={{ color: over(f.metaTitle, 60) }}>{(f.metaTitle || '').length}/60</small><input className="a-input" maxLength={160} value={f.metaTitle || ''} onChange={on('metaTitle')} placeholder="Product name + Price in Bangladesh | AR Trade" /></label>
      <label className="a-lbl">Meta description <small style={{ color: over(f.metaDesc, 160) }}>{(f.metaDesc || '').length}/160</small><textarea className="a-input" rows={2} maxLength={320} value={f.metaDesc || ''} onChange={on('metaDesc')} /></label>
      <label className="a-lbl">SEO keywords <small>comma separated, most important first</small><textarea className="a-input" rows={2} maxLength={500} value={f.metaKeywords || ''} onChange={on('metaKeywords')} placeholder="hp 79a toner, hp cf279a, toner price in bangladesh" /></label>
    </section>
  );
}
