import { sel } from './constants.js';

const PARTIAL_OPTIONS = [
  ['split', 'Ship available now', 'Rest follows when restocked — no extra delivery fee'],
  ['together', 'Wait, ship together', 'We hold the order until everything is in stock'],
  ['drop', 'Remove unavailable', 'Pay only for what is in stock today']
];

/** Warnings under the contact box: short-stock handling choice and the "needs approval" note. */
export default function StockNotices({ t, partial, setPartial }) {
  const shortL = t.lines.filter(l => l.short > 0);
  return (
    <>
      {shortL.length > 0 && (
        <div className="note-warn">
          <div className="ct-warn-top"><span className="ex">!</span><div className="ct-col3"><b className="ct-warn-t">Some items are short on stock</b><span className="ct-warn-d">{shortL.map(l => `${l.name.split(' (')[0]}: ${l.avail} of ${l.qty} in stock`).join(' · ')}</span></div></div>
          <div className="two ct-two-190">
            {PARTIAL_OPTIONS.map(([k, tt, d]) => (
              <button type="button" key={k} className={sel(partial === k)} onClick={() => setPartial(k)}><b className="ct-opt-t">{tt}</b><small>{d}</small></button>
            ))}
          </div>
        </div>
      )}
      {t.heldN > 0 && (
        <div className="note-hold"><i>⏸</i><div className="ct-col3"><b className="ct-hold-t">{t.heldN} item(s) need approval before dispatch</b><span className="ct-hold-d">High-value machines and special orders are held until our team confirms model, installation and payment. Everything else in your cart ships as normal.</span></div></div>
      )}
    </>
  );
}
