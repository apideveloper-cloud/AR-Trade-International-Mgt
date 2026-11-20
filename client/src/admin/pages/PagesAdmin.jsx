import { useState } from 'react';
import { adm, can } from '../adminApi.js';
import { confirmBox } from '../ui.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { withAlert } from '../hooks/withAlert.js';
import { PageEditor } from './pagesAdmin/PageEditor.jsx';
import { PageCard } from './pagesAdmin/PageCard.jsx';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/entries.js';

const GROUPS = [['servicing', 'Servicing details', 'Shown on the Servicing page'], ['clients', 'Corporate clients', 'Shown on the About page'], ['company', 'Company profile', 'Profile, mission and vision']];
const GROUP_LOOK = { servicing: ['🛠', 215], clients: ['🏢', 160], company: ['📘', 45] };

/** Servicing details, corporate clients and the company profile — editable by Admin and Content writer. */
export function PagesAdmin({ staff }) {
  const tr = useT();
  const pagesQ = useApiData(() => adm.get('/pages').catch(() => []));
  const rows = pagesQ.data, load = pagesQ.reload;
  const [edit, setEdit] = useState(null); // null | { id } | { group } for new
  const [tab, setTab] = useState(GROUPS[0][0]);
  const [q, setQ] = useState('');
  const del = withAlert(async r => { if (await confirmBox(tr('Delete “{title}”?', { title: r.title }), { danger: true, confirmLabel: tr('Delete') })) { await adm.del('/pages/' + r.id); load(); } });
  if (edit) return <PageEditor id={edit.id} group={edit.group || rows?.find(r => r.id === edit.id)?.group} onDone={id => { setEdit(id ? { id } : null); load(); }} />;
  if (!rows) return <div className="a-card">{tr('Loading…')}</div>;
  const isAdmin = can(staff, 'pages.delete');
  const cur = GROUPS.find(g => g[0] === tab) || GROUPS[0];
  const [icon, hue] = GROUP_LOOK[cur[0]];
  const list = rows.filter(r => r.group === cur[0] && (!q.trim() || (r.title + ' ' + (r.excerpt || '')).toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="pg">
      <div className="pg-tabs" role="tablist">
        {GROUPS.map(([g, title]) => {
          const n = rows.filter(r => r.group === g).length, live = rows.filter(r => r.group === g && r.status === 'Published').length;
          return <button key={g} type="button" role="tab" aria-selected={tab === g} className={tab === g ? 'on' : ''} style={{ '--h': GROUP_LOOK[g][1] }} onClick={() => setTab(g)}><i>{GROUP_LOOK[g][0]}</i><span><b>{tr(title)}</b><small>{tr(n === 1 ? '{n} page · {live} live' : '{n} pages · {live} live', { n, live })}</small></span></button>;
        })}
      </div>
      <section className="pg-card">
        <div className="pg-hd" style={{ '--h': hue }}>
          <span className="pg-hi">{icon}</span>
          <div><h3>{tr(cur[1])}</h3><span>{tr('{desc} · {n} shown', { desc: tr(cur[2]), n: list.length })}</span></div>
          <input className="a-input pg-q" type="search" placeholder={tr('Search pages…')} value={q} onChange={e => setQ(e.target.value)} aria-label={tr('Search pages')} />
          <button type="button" className="a-btn sm pg-new" onClick={() => setEdit({ group: cur[0] })}>{tr('＋ New page')}</button>
        </div>
        <div className="pg-grid">
          {list.map(r => <PageCard key={r.id} r={r} icon={icon} hue={hue} canDelete={isAdmin} onEdit={id => setEdit({ id })} onDelete={del} />)}
          <button type="button" className="pg-add" onClick={() => setEdit({ group: cur[0] })}><b>＋</b>{tr('New page')}<small>{tr(cur[1])}</small></button>
        </div>
        {!list.length && rows.some(r => r.group === cur[0]) && <div className="a-empty">{tr('No page matches your search.')}</div>}
      </section>
    </div>
  );
}
