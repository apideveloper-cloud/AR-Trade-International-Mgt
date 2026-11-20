import { useState } from 'react';
import { adm, dateF, fmtMoney, slNo, useTable } from '../../adminApi.js';
import { Empty, Pager, Summary, Toolbar, alertBox } from '../../ui.jsx';
import { CustomerDrawer, KEY_ICON, LOCK_ICON } from './CustomerDrawer.jsx';
import { SetPasswordModal } from './SetPasswordModal.jsx';
import { ResetRequests } from './ResetRequests.jsx';
import { ResetLinkModal } from './ResetLinkModal.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { withAlert } from '../../hooks/withAlert.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';
import './salesInline.css';

/** Customers page: summary, search, the customer grid, password-reset requests and the customer drawer. */
export function Customers() {
  const tr = useT();
  const t = useTable('/customers', { from: '', to: '' });
  const resets = useApiData(() => adm.get('/password-resets').catch(() => []), [], []);
  const reqs = resets.data, loadReqs = resets.reload;
  const [link, setLink] = useState(null); // { name, url, phone, hours }
  const makeLink = async c => {
    try { const r = await adm.post(`/customers/${c.userId}/reset-link`); setLink({ name: c.name, phone: c.phone, url: window.location.origin + r.path, hours: r.hours }); loadReqs(); } catch (e) { alertBox(tr(e.message)); }
  };
  const dismiss = withAlert(async id => { await adm.del('/password-resets/' + id); loadReqs(); });
  const [pwFor, setPwFor] = useState(null);
  const setPw = c => setPwFor(c);
  const [view, setView] = useState(null); // the customer whose details are open
  return (
    <>
      {pwFor && <SetPasswordModal c={pwFor} onClose={() => setPwFor(null)} onDone={loadReqs} />}
      {reqs.length > 0 && <ResetRequests reqs={reqs} onCreate={makeLink} onDismiss={dismiss} />}
      {link && <ResetLinkModal link={link} onClose={() => setLink(null)} />}
      {t.data.summary && (() => {
        const m = t.data.summary, pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
        return <Summary items={[
          [tr('Customers'), m.total, tr('{n} with an online account', { n: m.accounts }), 'blue', 'users'],
          [tr('Buyers'), m.buyers, tr('{n}% have placed an order', { n: pct(m.buyers, m.total) }), 'green', 'check'],
          [tr('Lifetime revenue'), fmtMoney(m.revenue), tr('Avg {n} per buyer', { n: fmtMoney(m.avg) }), 'violet', 'money'],
          [tr('Repeat customers'), m.repeat, tr('{n}% of buyers ordered 2+ times', { n: pct(m.repeat, m.buyers) }), 'amber', 'repeat'],
          [tr('New accounts'), m.newAccounts, tr('Registered in the last 30 days'), 'blue', 'plus'],
          [tr('Top customer'), m.top ? m.top.name : '–', m.top ? tr('{n} lifetime', { n: fmtMoney(m.top.ltv) }) : tr('No orders yet'), 'amber', 'star']
        ]} />;
      })()}
      <ListFilter t={t} noun="customer" title="Search customers" search={{ placeholder: 'Name, phone, email or member ID' }} range={{ label: 'Last order' }} />
      <Toolbar t={t} search={false} />
      <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
        <div className="sinl-min904">
          <div className="head sinl-cucols"><span>{tr('SL')}</span><span>{tr('Customer')}</span><span>{tr('Phone')}</span><span>{tr('Orders')}</span><span>{tr('Lifetime')}</span><span>{tr('Last order')}</span><span className="sinl-right">{tr('Password')}</span></div>
          {t.data.rows.map((c, i) => (
            <div key={c.phone + c.name} className="row cu-row sinl-cucols" onClick={() => setView(c)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setView(c); }}>
              <span className="sl">{slNo(t, i)}</span>
              <span className="sinl-stack"><b>{c.name}</b><span className="sinl-sub">{c.memberCode ? `${c.memberCode} · ` : ''}{c.email}</span></span>
              <a href={'tel:' + c.phone}>{c.phone}</a><span>{c.n}</span><b>{fmtMoney(c.ltv)}</b><span className="sinl-muted">{dateF(c.last)}</span>
              {c.userId ? <span className="cu-act" onClick={e => e.stopPropagation()}><button type="button" className="cu-ic" title={tr('Reset link: create a one-time link the customer can use to choose a new password')} aria-label={tr('Create reset link')} onClick={() => makeLink(c)}>{KEY_ICON}</button><button type="button" className="cu-ic" title={tr('Set password: type a new password for this customer yourself')} aria-label={tr('Set password')} onClick={() => setPw(c)}>{LOCK_ICON}</button></span> : <span className="sinl-noacct">{tr('no account')}</span>}
            </div>
          ))}
        </div>
      </div>
      <Empty t={t} /><Pager t={t} />
      {view && <CustomerDrawer c={view} onClose={() => setView(null)} onReset={makeLink} onSetPassword={setPw} />}
    </>
  );
}
