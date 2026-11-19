import { Summary } from '../ui.jsx';
import { Notice, fDateTime } from '../fieldKit.jsx';
import '../field.css';
import { BackupCards } from './backups/BackupCards.jsx';
import { BackupHistory } from './backups/BackupHistory.jsx';
import { BackupDir, DeleteCodeCard } from './backups/BackupSettings.jsx';
import { CodeModal } from './backups/CodeModal.jsx';
import { size, until } from './backups/format.js';
import { useBackups } from './backups/useBackups.js';
import { useDeleteCode } from './backups/useDeleteCode.js';

/** Backups of the database and of the uploads folder: automatic every few hours, manual "Back up now", download, delete. Master Admin only. */
export function Backups() {
  const { d, setD, err, setErr, busy, done, load, now } = useBackups();
  const dc = useDeleteCode(d, setD, load);

  if (err && !d) return <Notice err={err} onRetry={load} />;
  if (!d) return <span className="spin" />;
  const items = d.items;
  const running = busy || d.running;
  const s = d.scopes;
  const failedOf = sc => { const l = items.find(i => i.scope === sc); return l && l.status === 'Failed' ? l : null; };
  const last = (sc, label) => [label, s[sc].last ? fDateTime(s[sc].last) : 'None yet', s[sc].last ? `${s[sc].lastKind === 'auto' ? 'automatic' : 'manual'} · ${size(s[sc].lastSize)}` : 'press Back up now', failedOf(sc) ? 'red' : 'green', 'check'];
  return (
    <>
      <Summary items={[
        last('db', 'Database'),
        last('files', 'Uploads'),
        ['Next automatic', running ? 'running…' : until(s.db.nextAuto), `every ${d.intervalHours} hours`, 'blue', 'clock'],
        ['Disk used', size(d.totalBytes), `${s.db.copies + s.files.copies} copies · kept ${d.keepDays} days`, 'amber', 'tag']
      ]} />
      <Notice err={err} onRetry={load} />
      <BackupCards d={d} busy={busy} done={done} running={running} failedOf={failedOf} now={now} />
      <BackupDir d={d} running={running} setD={setD} setErr={setErr} />
      <DeleteCodeCard deleteCodeSet={d.deleteCodeSet} onOpen={() => dc.open({ kind: 'set' })} />
      <BackupHistory items={items} onDelete={dc.del} />
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
      {dc.ask && <CodeModal ask={dc.ask} codes={dc.codes} setCodes={dc.setCodes} deleteCodeSet={d.deleteCodeSet} onClose={() => dc.setAsk(null)} onSubmit={dc.submit} />}
    </>
  );
}
