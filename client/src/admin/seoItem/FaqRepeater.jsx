const MAX = 20;

/** Questions and answers shown on the page and in the FAQPage schema. */
export function FaqRepeater({ faq = [], set }) {
  const put = next => set({ faq: next });
  const edit = (i, k, v) => put(faq.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const move = (i, d) => { const n = [...faq]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; put(n); };
  return (
    <div className="adsi-sec">
      <div className="adsi-hd"><b>FAQ</b><small className="adsi-note">{faq.length}/{MAX} · shown on the page and in FAQPage schema</small>
        <button type="button" className="a-btn ghost sm" disabled={faq.length >= MAX} onClick={() => put([...faq, { q: '', a: '' }])}>+ Add question</button></div>
      {faq.map((x, i) => (
        <div className="adsi-faq" key={i}>
          <div className="adsi-stack">
            <input className="a-input" placeholder="Question" maxLength={200} value={x.q} onChange={e => edit(i, 'q', e.target.value)} />
            <textarea className="a-input" rows={2} placeholder="Answer" maxLength={1000} value={x.a} onChange={e => edit(i, 'a', e.target.value)} />
          </div>
          <div className="adsi-faq-btn">
            <button type="button" className="a-btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button type="button" className="a-btn ghost sm" disabled={i === faq.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button type="button" className="a-btn ghost sm" onClick={() => put(faq.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
