import { invApi } from '../../../adminApi.js';
import { alertBox } from '../../../ui.jsx';
import { downloadCsv } from '../../../fieldKit.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/inventory.js';

/** All rows of a server-paged list that match the current filters (for CSV export): pages of 200, at most 5,000 rows. */
export async function fetchAll(path, params) {
  const base = Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== '' && v != null && k !== 'page' && k !== 'size'));
  const out = [];
  for (let page = 1; page <= 25; page++) {
    const r = await invApi.get(`${path}?${new URLSearchParams({ ...base, page, size: 200 })}`);
    out.push(...r.rows);
    if (out.length >= r.total || !r.rows.length) break;
  }
  return out;
}

/** Downloads every row matching the table's filters as a CSV file; a failed fetch shows the message. */
export async function exportCsv(path, params, file, head, toRow, tr = s => s) {
  const list = await fetchAll(path, params).catch(e => { alertBox(tr(e.message)); return []; });
  if (list.length) downloadCsv(file, head, list.map(toRow));
}

/** The small "CSV" button of a list card. */
export function CsvButton({ onClick, disabled }) {
  const tr = useT();
  return <button type="button" className="a-mini" onClick={onClick} disabled={disabled}>⤓ {tr('CSV')}</button>;
}
