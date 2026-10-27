import { useCallback, useEffect, useState } from 'react';
import { adm, downloadFile } from '../adminApi.js';
import { Summary, alertBox, confirmBox } from '../ui.jsx';
import { Chip, Grid, Notice, fDateTime } from '../fieldKit.jsx';
import '../field.css';

const size = n => (n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const until = iso => {
  const m = Math.round((new Date(iso) - Date.now()) / 60000);
  return m <= 1 ? 'due now' : m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};
const LABEL = { db: 'Database', files: 'Uploads' };

/** Backups of the database and of the uploads folder: automatic every few hours, manual "Back up now", download, delete. Master Admin only. */
export function Backups() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState(null);
  const [tab, setTab] = useState('all');
  const [dirIn, setDirIn] = useState(null);
  const [dirBusy, setDirBusy] = useState(false);
  const load = useCallback(() => adm.get('/backups').then(r => { setD(r); setErr(''); }).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, d?.running || busy ? 1000 : 30000); return () => clearInterval(t); }, [load, d?.running, busy]);

  const now = async scope => {
    setBusy(scope); setErr(''); setDone(null);
    try { const r = await adm.post('/backups', { scope }); setDone(r); await load(); } catch (e) { setErr(e.message); await load(); }
    setBusy('');
  };
  const saveDir = async () => {
    if (!(await confirmBox(`New backups will be saved in ${dirIn.trim()}. Copies already made stay where they are.`, { confirmLabel: 'Change folder' }))) return;
    setDirBusy(true);
    try { const r = await adm.put('/backups/dir', { dir: dirIn.trim() }); setD(r); setDirIn(null); setErr(''); } catch (e) { alertBox(e.message); }
    setDirBusy(false);
  };
  const get = async b => { try { await downloadFile(`/backups/${b.id}/download`, b.file); } catch (e) { alertBox(e.message); } };
  const del = async b => {
    if (!(await confirmBox(`Delete the ${LABEL[b.scope].toLowerCase()} backup from ${fDateTime(b.at)}? It cannot be recovered afterwards.`, { danger: true, confirmLabel: 'Delete backup' }))) return;
    try { await adm.del('/backups/' + b.id); await load(); } catch (e) { alertBox(e.message); }
  };

  if (err && !d) return <Notice err={err} onRetry={load} />;
  if (!d) return <span className="spin" />;
  const items = d.items, shown = tab === 'all' ? items : items.filter(i => i.scope === tab);
  const running = busy || d.running;
  const s = d.scopes;
  const failedOf = sc => { const l = items.find(i => i.scope === sc); return l && l.status === 'Failed' ? l : null; };
  const cards = [
    { scope: 'db', icon: '⛁', title: 'Database backup', text: <>Every table and row of the system, saved as one compressed file. Made <b>automatically every {d.intervalHours} hours</b>.</> },
    { scope: 'files', icon: '▣', title: 'Uploads folder backup', text: <>All product images, CVs and other uploaded files, saved as one compressed archive. Made <b>automatically every {d.intervalHours} hours</b> when something changed.</> }
  ];
  return (
    <>
      <Summary items={[
        ['Database', s.db.last ? fDateTime(s.db.last) : 'None yet', s.db.last ? `${s.db.lastKind === 'auto' ? 'automatic' : 'manual'} · ${size(s.db.lastSize)}` : 'press Back up now', failedOf('db') ? 'red' : 'green', 'check'],
        ['Uploads', s.files.last ? fDateTime(s.files.last) : 'None yet', s.files.last ? `${s.files.lastKind === 'auto' ? 'automatic' : 'manual'} · ${size(s.files.lastSize)}` : 'press Back up now', failedOf('files') ? 'red' : 'green', 'check'],
        ['Next automatic', running ? 'running…' : until(s.db.nextAuto), `every ${d.intervalHours} hours`, 'blue', 'clock'],
        ['Disk used', size(d.totalBytes), `${s.db.copies + s.files.copies} copies · kept ${d.keepDays} days`, 'amber', 'tag']
      ]} />
      <Notice err={err} onRetry={load} />
      <div className="bk-pair">
      {cards.map(c => (
        <section key={c.scope} className={"a-card bk-now " + c.scope}>
          <div className="bk-ic" aria-hidden="true">{c.icon}</div>
          <div className="bk-tx">
            <h3>{c.title}</h3>
            <p>{c.text} Press the button to make one right now. Copies older than <b>{d.keepDays} days</b> are deleted automatically.</p>
            <div className="bk-facts">
              <span><small>Last backup</small><b>{s[c.scope].last ? fDateTime(s[c.scope].last) : 'None yet'}</b></span>
              <span><small>Size</small><b>{s[c.scope].last ? size(s[c.scope].lastSize) : '—'}</b></span>
              <span><small>Next automatic</small><b>{running && d.progress?.scope === c.scope ? 'running…' : until(s[c.scope].nextAuto)}</b></span>
              <span><small>Copies kept</small><b>{s[c.scope].copies} · {size(s[c.scope].bytes)}</b></span>
            </div>
            {d.progress && d.progress.scope === c.scope && (
              <div className="bk-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.progress.pct} aria-label="Backup progress">
                <div className="bk-bar"><i style={{ width: d.progress.pct + '%' }} /></div>
                <div className="bk-pl"><b>{d.progress.pct}%</b><span>{d.progress.phase} · {d.progress.seconds}s{d.progress.kind === 'auto' ? ' · automatic backup' : ''}</span></div>
              </div>
            )}
            {done && done.scope === c.scope && <p className="bk-ok">✓ Backup finished: {size(done.size)}, {c.scope === 'db' ? `${done.tables} tables, ${done.rows.toLocaleString('en-US')} rows` : `${done.rows.toLocaleString('en-US')} files`}, {(done.ms / 1000).toFixed(1)} s.</p>}
            {c.scope === 'files' && s.files.unchangedAt && <p className="fd-sub">Last automatic check {fDateTime(s.files.unchangedAt)}: nothing new in the uploads, so no extra copy was made.</p>}
            {failedOf(c.scope) && busy !== c.scope && <p className="bk-bad">The last backup failed: {failedOf(c.scope).error || 'unknown error'}. It will be tried again automatically.</p>}
          </div>
          <button type="button" className="a-btn bk-btn" onClick={() => now(c.scope)} disabled={!!running}>{busy === c.scope || d.progress?.scope === c.scope ? <><span className="spin sm" /> Backing up…</> : `${c.icon} Back up now`}</button>
        </section>
      ))}
      </div>
      <section className="a-card bk-dir">
        <div className="card-hd"><div><h3>Backup folder</h3><small className="fd-sub">Where new backups are saved on the server · Master Admin only</small></div></div>
        {dirIn === null ? (
          <div className="bk-dirrow"><code title={d.dir}>{d.dir}</code><button type="button" className="a-mini" onClick={() => setDirIn(d.dir)} disabled={!!running}>Change folder</button></div>
        ) : (
          <div className="bk-dirrow"><input value={dirIn} onChange={e => setDirIn(e.target.value)} placeholder={d.defaultDir} spellCheck={false} aria-label="Backup folder path" /><button type="button" className="a-mini on" onClick={saveDir} disabled={dirBusy || !dirIn.trim()}>{dirBusy ? 'Saving…' : 'Save'}</button><button type="button" className="a-mini" onClick={() => setDirIn(null)}>Cancel</button><button type="button" className="a-mini" onClick={() => setDirIn(d.defaultDir)}>Use default</button></div>
        )}
        <small className="fd-sub">Use a full path, e.g. {'D:\\Backups\\AR'} (Windows) or /var/backups/artrade (Linux). The folder is created if missing and the server must be able to write to it. It cannot be inside the uploads folder.</small>
      </section>
      <section className="a-card">
        <div className="card-hd"><div><h3>Backup history</h3><small className="fd-sub">Newest first · download a copy to keep it off the server</small></div>
          <div className="bk-acts">{[['all', 'All'], ['db', 'Database'], ['files', 'Uploads']].map(([k, l]) => <button key={k} type="button" className={'a-mini' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
        </div>
        <Grid cols="44px 170px 100px 100px 100px 150px 110px 150px" head={['SL', 'Created', 'What', 'Type', 'Size', 'Contents', 'Status', 'Actions']} empty="No backups yet."
          rows={shown.map((b, i) => ({ key: b.id, cells: [i + 1,
            <span key="t"><b>{fDateTime(b.at)}</b><small style={{ display: 'block', color: '#6b7388' }}>{b.by || '—'}</small></span>,
            <Chip key="w" tone={b.scope === 'db' ? 'amber' : 'ok'}>{LABEL[b.scope]}</Chip>,
            <Chip key="k" tone={b.kind === 'auto' ? 'blue' : 'violet'}>{b.kind === 'auto' ? 'Automatic' : 'Manual'}</Chip>,
            b.status === 'Done' ? size(b.size) : '—',
            b.status !== 'Done' ? '—' : b.scope === 'db' ? `${b.tables} tables / ${b.rows.toLocaleString('en-US')} rows` : `${b.rows.toLocaleString('en-US')} files`,
            <span key="s"><Chip tone={b.status === 'Done' ? (b.exists ? 'ok' : 'amber') : b.status === 'Failed' ? 'bad' : 'blue'}>{b.status === 'Done' && !b.exists ? 'File missing' : b.status}</Chip></span>,
            <span key="a" className="bk-acts">
              {b.exists && <button type="button" className="a-mini" onClick={() => get(b)} title={'Download ' + b.file}>⤓ Download</button>}
              {b.status !== 'Running' && <button type="button" className="a-mini bk-del" onClick={() => del(b)} title="Delete this backup">✕</button>}
            </span>] }))} />
      </section>
      <section className="a-card bk-help">
        <h3>How to restore a backup</h3>
        <p>Restoring replaces the data, so it is done on the server, with the site stopped, and never by accident from this page. Keep a fresh backup first.</p>
        <pre>systemctl stop artrade-api
# database
gunzip -c server/backups/&lt;ar-backup-file&gt;.sql.gz | mysql -h 127.0.0.1 -u &lt;user&gt; -p &lt;database&gt;
# uploads folder
tar -xzf server/backups/&lt;ar-uploads-file&gt;.tar.gz -C server/uploads
systemctl start artrade-api</pre>
        <p className="fd-sub">Backups sit in <b>{d.dir}</b> next to the website's own files. For safety against a disk failure, download one regularly and keep it somewhere else.</p>
      </section>
    </>
  );
}
