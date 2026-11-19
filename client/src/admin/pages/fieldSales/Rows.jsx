import './fieldSales.css';

/** The console's grid table for one server page (the paging, search and "no rows" notice live outside, in Toolbar / ListFilter / Pager / Empty). */
export function Rows({ t, cols, head, rows, onRow }) {
  if (!rows.length) return null;
  return (
    <div className="fd-tbl" role="table" style={{ opacity: t.loading ? 0.6 : 1 }}>
      <div className="fd-th" role="row" style={{ gridTemplateColumns: cols }}>{head.map(h => <span key={h}>{h}</span>)}</div>
      {rows.map((r, i) => (
        <div key={r.key ?? i} role="row" className={'fd-tr' + (onRow && r.item ? ' click' : '') + (r.full ? ' full' : '')} style={{ gridTemplateColumns: r.full ? '1fr' : cols }} onClick={onRow && r.item ? () => onRow(r.item) : undefined}>
          {r.cells.map((c, j) => <span key={j}>{c}</span>)}
        </div>
      ))}
    </div>
  );
}
