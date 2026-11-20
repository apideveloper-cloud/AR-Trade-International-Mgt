/** Five tappable stars as an accessible radio group (arrow keys move, visible focus). */
export default function RrqStars({ name, value, onChange, t }) {
  return (
    <div className="rrq-stars" role="radiogroup" aria-label={t.rate}>
      {[1, 2, 3, 4, 5].map(n => (
        <label key={n} className={'rrq-star' + (n <= value ? ' on' : '')}>
          <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} aria-label={t.stars(n)} />
          <span aria-hidden="true">★</span>
        </label>
      ))}
      <span className="rrq-star-lbl" aria-live="polite">{t.labels[value]}</span>
    </div>
  );
}
