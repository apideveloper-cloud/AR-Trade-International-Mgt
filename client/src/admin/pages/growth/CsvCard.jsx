import { useState } from 'react';
import { downloadFile } from '../../adminApi.js';
import { confirmBox } from '../../ui.jsx';
import { Msg, Section } from './parts.jsx';
import { jumpText, money, send } from './pricesApi.js';

const MAX = 2 * 1024 * 1024;
const FIELDS = { price: 'Price', old: 'Old price', saleEnds: 'Sale ends', stock: 'Stock', stockStatus: 'Stock status' };
const show = v => (v == null || v === '' ? '(blank)' : typeof v === 'number' ? money(v) : String(v));

/** Download the price list as CSV, edit it in Excel, import it back (preview first). */
export default function CsvCard({ canEdit, onSaved }) {
  const [csv, setCsv] = useState('');
  const [name, setName] = useState('');
  const [pv, setPv] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setM(null);
    try { await downloadFile('/growth/prices/csv', 'prices.csv'); } catch (e) { setM({ ok: false, text: e.message || 'Download failed' }); }
  };
  const pick = async e => {
    const f = e.target.files?.[0]; e.target.value = '';
    setPv(null); setM(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { setM({ ok: false, text: 'Please choose a .csv file.' }); return; }
    if (f.size > MAX) { setM({ ok: false, text: 'This file is bigger than 2 MB. Split it into smaller files.' }); return; }
    const text = await f.text();
    setCsv(text); setName(f.name); setBusy(true);
    const r = await send('/growth/prices/csv/preview', { csv: text });
    setBusy(false);
    if (r.ok) setPv(r.body); else setM({ ok: false, text: r.body.error || 'Could not read this file.' });
  };
  const apply = async confirmJump => {
    setBusy(true); setM(null);
    const r = await send('/growth/prices/csv/apply', { csv, confirmJump: !!confirmJump });
    setBusy(false);
    if (r.ok) { setM({ ok: true, text: `Done. ${r.body.updated ?? 0} product(s) updated.` }); setPv(null); setCsv(''); setName(''); onSaved(); return; }
    if (r.status === 409 && r.body.needsConfirm) { if (await confirmBox(jumpText(r.body.needsConfirm), { confirmLabel: 'Yes, apply' })) apply(true); return; }
    setM({ ok: false, text: r.status === 400 && r.body.errors ? 'Nothing was changed. The file has errors: ' + r.body.errors.map(x => `#${x.id} ${x.message}`).join('; ') : r.body.error || 'Could not apply the file.' });
  };
  const s = pv?.summary;
  const shown = (pv?.rows || []).filter(r => r.errors?.length || Object.keys(r.changes || {}).length);
  return (
    <Section id="adgp-csv" title="Spreadsheet (CSV)" what="Download all prices, change them in Excel, then import the file back. Products are matched by ID first, then by SKU. Blank cells stay unchanged.">
      <div className="adgr-acts">
        <button type="button" className="a-btn ghost sm" onClick={download}>Download CSV</button>
        {canEdit && <label className="a-btn sm adgp-file">Import CSV<input type="file" accept=".csv,text/csv" onChange={pick} hidden /></label>}
        {name && <span className="adgr-dim">{name}</span>}
        {busy && <span className="spin" />}
      </div>
      {!canEdit && <div className="adgr-note">Only the Master Admin or Admin can import prices.</div>}
      <Msg m={m} />
      {s && (
        <>
          <ul className="adgr-sum">
            <li>Rows: <b>{s.total}</b></li><li>Matched: <b>{s.matched}</b></li><li>Not found: <b>{s.unmatched}</b></li>
            <li>Will change: <b>{s.changed}</b></li><li>Errors: <b>{s.errors}</b></li><li>Big price jumps: <b>{s.jumps}</b></li>
          </ul>
          <div className="adgr-scroll">
            <table className="adgr-tbl">
              <thead><tr><th>Line</th><th>Product</th><th>Matched by</th><th>Changes</th></tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.line} className={r.errors?.length ? 'adgp-rowbad' : ''}>
                    <td>{r.line}</td><td className="adgr-wrap">{r.name || '-'} {r.id ? <span className="adgr-dim">#{r.id}</span> : null}</td><td>{r.match || '-'}</td>
                    <td className="adgr-wrap">
                      {Object.entries(r.changes || {}).map(([f, c]) => <div key={f}>{FIELDS[f] || f}: {show(c.from)} → <b>{show(c.to)}</b></div>)}
                      {r.jump && <div className="adgp-warnt">⚠ Price changes by more than 50 %</div>}
                      {(r.errors || []).map((e, i) => <div key={i} className="adgp-err">⚠ Error: {typeof e === 'string' ? e : e.message}</div>)}
                    </td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={4} className="adgr-empty">Nothing in this file would change anything.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="adgr-acts">
            <button type="button" className="a-btn sm" disabled={busy || s.errors > 0 || !s.changed} onClick={() => apply(false)}>Apply changes</button>
            {s.errors > 0 && <span className="adgp-err">Fix the errors in the file and import it again.</span>}
            <button type="button" className="a-btn ghost sm" onClick={() => { setPv(null); setCsv(''); setName(''); }}>Cancel</button>
          </div>
        </>
      )}
    </Section>
  );
}
