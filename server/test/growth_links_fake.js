// Test helper (not a test): in-memory stand-in for the growth_backlinks table, matching the exact SQL of backlinks.js and linkCheck.js.
export function fakeLinksDb() {
  const db = { rows: [], seq: 0, sql: [] };
  const query = async (sql, p = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim(); db.sql.push(s);
    if (s.startsWith('CREATE TABLE')) return [{}];
    if (s.startsWith('SELECT id FROM growth_backlinks WHERE name')) return [db.rows.filter(r => r.name === p[0]).map(r => ({ id: r.id }))];
    if (s.startsWith('SELECT * FROM growth_backlinks WHERE id')) return [db.rows.filter(r => r.id === p[0]).map(r => ({ ...r }))];
    if (s.startsWith('INSERT INTO growth_backlinks')) {
      const cols = /\(([^)]*)\) VALUES/.exec(s)[1].split(', ');
      const row = { id: ++db.seq, link_found: null, rel: '', http_status: null, last_checked: null, fail_count: 0, created_at: new Date(0) };
      cols.forEach((c, i) => { row[c] = p[i]; }); db.rows.push(row); return [{ insertId: row.id }];
    }
    if (s.startsWith('UPDATE growth_backlinks SET')) {
      const id = p[p.length - 1], r = db.rows.find(x => x.id === id); if (!r) return [{ affectedRows: 0 }];
      let i = 0;
      for (const part of /SET (.*) WHERE id = \?/.exec(s)[1].split(', ')) {
        const [c, rhs] = part.split(' = '); r[c] = rhs === '?' ? p[i++] : rhs === 'NULL' ? null : rhs === "''" ? '' : Number(rhs);
      }
      return [{ affectedRows: 1 }];
    }
    if (s.startsWith('DELETE FROM growth_backlinks')) { const n = db.rows.length; db.rows = db.rows.filter(r => r.id !== p[0]); return [{ affectedRows: n - db.rows.length }]; }
    if (s.startsWith("SELECT * FROM growth_backlinks WHERE status <> 'Rejected'")) return [db.rows.filter(r => r.status !== 'Rejected' && r.url !== '').slice(0, p[0]).map(r => ({ ...r }))];
    if (s.startsWith('SELECT COUNT(*) AS n FROM growth_backlinks')) return [[{ n: db.rows.length }]];
    if (s.startsWith('SELECT * FROM growth_backlinks ORDER BY')) return [db.rows.slice().reverse().slice(p[1], p[1] + p[0]).map(r => ({ ...r }))];
    if (s.startsWith('SELECT status, COUNT')) { const m = {}; db.rows.forEach(r => { m[r.status] = (m[r.status] || 0) + 1; }); return [Object.entries(m).map(([status, n]) => ({ status, n }))]; }
    if (s.startsWith('SELECT name FROM growth_backlinks')) return [db.rows.map(r => ({ name: r.name }))];
    if (s.startsWith('SELECT MAX(last_checked)')) return [[{ t: null }]];
    throw new Error('fakeLinksDb: unexpected SQL ' + s.slice(0, 90));
  };
  db.query = query;
  return db;
}
