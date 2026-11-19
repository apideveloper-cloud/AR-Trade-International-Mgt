import { Field } from './Field.jsx';
import { fieldGrid } from './shared.js';

/** Editable list of cards: fields per item (with optional conditions), reorder, remove, add. `tiles` = compact logo grid. */
export function ListEditor({ items, setItems, fields, blank, title, max = 60, tiles = false }) {
  const mv = (i, d) => setItems(a => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return b; [b[i], b[j]] = [b[j], b[i]]; return b; });
  const upd = (i, k, v) => setItems(a => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const remove = i => setItems(a => a.filter((_, j) => j !== i));
  const add = () => setItems(a => [...a, typeof blank === 'function' ? blank() : { ...blank }]);
  if (tiles) {
    return (
      <div className="lt-grid">
        {items.map((it, i) => (
          <div key={i} className={'lt-card' + (it.on === false ? ' off' : '')}>
            <div className="lt-top">
              <span className="cx-no">{i + 1}</span>
              <span className="lt-sp" />
              <button type="button" className="cx-ic" title="Move earlier" onClick={() => mv(i, -1)} disabled={i === 0}>←</button>
              <button type="button" className="cx-ic" title="Move later" onClick={() => mv(i, 1)} disabled={i === items.length - 1}>→</button>
              <button type="button" className="cx-ic del" title="Remove this logo" onClick={() => remove(i)}>✕</button>
            </div>
            {fields.filter(f => f.type === 'image').map(f => <Field key={f.k} f={{ ...f, tile: true }} item={it} set={(k, v) => upd(i, k, v)} />)}
            {fields.filter(f => f.type !== 'image').map(f => <Field key={f.k} f={f} item={it} set={(k, v) => upd(i, k, v)} />)}
          </div>
        ))}
        {items.length < max && <button type="button" className="lt-add" onClick={add}><b>＋</b>Add a logo<small>{items.length} of {max}</small></button>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} className={'cx-item' + (it.on === false ? ' off' : '')}>
          <div className="cx-item-hd">
            <span className="cx-no">{i + 1}</span>
            <b>{title(it, i)}</b>
            <button type="button" className="cx-ic" title="Move up" onClick={() => mv(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" className="cx-ic" title="Move down" onClick={() => mv(i, 1)} disabled={i === items.length - 1}>↓</button>
            <button type="button" className="cx-ic del" title="Remove" onClick={() => remove(i)}>✕</button>
          </div>
          <div style={fieldGrid}>
            {fields.filter(f => !f.show || f.show(it)).map(f => <Field key={f.k} f={f} item={it} set={(k, v) => upd(i, k, v)} />)}
          </div>
        </div>
      ))}
      {items.length < max && <button type="button" className="cx-add" onClick={add}>＋ Add another</button>}
    </div>
  );
}
