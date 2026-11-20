import { useState } from 'react';
import { adm, useTable } from '../adminApi.js';
import { Empty, Pager, Toolbar, ViewToggle, alertBox, confirmBox, useView } from '../ui.jsx';
import { ListFilter } from '../ListFilter.jsx';
import { BlogEditor } from './blogAdmin/BlogEditor.jsx';
import { ArticleRow } from './blogAdmin/ArticleRow.jsx';
import './blogAdmin/blogAdmin.css';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/entries.js';

/** Blog management for Admins and the Content writer role. */
export function BlogAdmin({ staff }) {
  const tr = useT();
  const t = useTable('/blog', { status: '', from: '', to: '' });
  const [view, setView] = useView('blog');
  const [edit, setEdit] = useState(null); // null = list, 'new' or an id
  const isWriter = staff.role === 'Content writer';
  const del = async r => { if (await confirmBox(tr('Delete “{title}” permanently?', { title: r.title }), { danger: true, confirmLabel: tr('Delete') })) { try { await adm.del('/blog/' + r.id); t.reload(); } catch (e) { alertBox(tr(e.message)); } } };
  if (edit) return <BlogEditor id={edit === 'new' ? null : edit} cats={t.data.categories || []} onDone={id => { setEdit(id || null); t.reload(); }} />;
  return (
    <>
      <ListFilter t={t} noun="article" title="Search articles" search={{ placeholder: 'Title, category or author' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['Published', 'Draft'] }]} range={{ label: 'Published' }} />
      <Toolbar t={t} search={false}>
        <ViewToggle view={view} setView={setView} />
        <button className="a-btn grad" onClick={() => setEdit('new')}>{tr('+ New article')}</button>
      </Toolbar>
      <div className={'vw blg-list ' + view} style={t.loading ? { opacity: .6 } : undefined}>
        {t.data.rows.map(r => <ArticleRow key={r.id} r={r} canDelete={!isWriter || r.authorId === staff.id} onEdit={setEdit} onDelete={del} />)}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
