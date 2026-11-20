import { useState } from 'react';
import { fld } from '../../adminApi.js';
import { alertBox } from '../../ui.jsx';
import { downloadCsv, todayBd } from '../../fieldKit.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

// The accountant's side of the console: money owed to us, money collected, expenses, purchase orders and the reports.
// The lists are paged and filtered by the server (useTable); the "all rows" CSV downloads read every page.
export const month0 = () => todayBd().slice(0, 7);

/** Every row of a server-paged list that matches the table's filters (200 per request), for the CSV downloads. */
export async function allRows(path, params) {
  const out = [];
  for (let page = 1; page <= 200; page++) {
    const qs = new URLSearchParams(Object.entries({ ...params, page, size: 200 }).filter(([, v]) => v !== '' && v != null));
    const d = await fld.get(`${path}?${qs}`);
    out.push(...d.rows);
    if (out.length >= d.total || !d.rows.length) break;
  }
  return out;
}

/** The console's grid table for one page of server rows. rows = [{ key, item, cells, full }]; a full row is the detail of the row before it. */
export function Tbl({ t, cols, head, rows, onRow }) {
  const tr = useT();
  return (
    <div className="fd-tbl" role="table" style={{ opacity: t.loading ? 0.6 : 1 }}>
      <div className="fd-th" role="row" style={{ gridTemplateColumns: cols }}>{head.map(h => <span key={h}>{tr(h)}</span>)}</div>
      {rows.map((r, i) => (
        <div key={r.key ?? i} role="row" className={'fd-tr' + (onRow && r.item ? ' click' : '') + (r.full ? ' full' : '')} style={{ gridTemplateColumns: r.full ? '1fr' : cols }} onClick={onRow && r.item ? () => onRow(r.item) : undefined}>
          {r.cells.map((c, j) => <span key={j}>{c}</span>)}
        </div>
      ))}
    </div>
  );
}

/** "Download all matching rows as CSV" button for a useTable list. */
export function CsvButton({ t, path, name, head, line, params }) {
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { const rows = await allRows(path, params || t.params); downloadCsv(name, head, rows.flatMap(line)); } catch (e) { alertBox(tr(e.message)); }
    setBusy(false);
  };
  return <button type="button" className="a-mini" style={{ width: 'auto', flex: 'none' }} disabled={busy || !t.data.total} onClick={run}>{busy ? tr('Preparing…') : tr('⤓ CSV')}</button>;
}
