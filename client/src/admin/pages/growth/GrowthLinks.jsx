import { useState } from 'react';
import { can } from '../../adminApi.js';
import { Msg } from './parts.jsx';
import { when } from './growthModel.js';
import { send, mcMsg, trMsg } from './lkApi.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/growthD.js';
import LkStats from './LkStats.jsx';
import LkForm from './LkForm.jsx';
import LkList from './LkList.jsx';
import VdGrid from './VdGrid.jsx';
import './growth.css';
import './links.css';

/** Admin > Search & Growth > Links & videos. */
export function GrowthLinks({ staff }) {
  const tr = useT();
  const [tab, setTab] = useState('links');
  const [status, setStatus] = useState('');
  const [tick, setTick] = useState(0);
  const [d, setD] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const canLinks = can(staff, 'seo.manage');
  const canVideos = can(staff, 'products.manage');
  const reload = () => setTick(t => t + 1);
  const checkAll = async () => {
    setBusy(true); setM(null);
    const r = await send('/growth/backlinks/check', {});
    setBusy(false);
    setM(r.status === 429 ? { ok: false, text: tr('A full check ran a moment ago. Please wait a few minutes and try again.') } : trMsg(tr, mcMsg(r, r.body?.queued ? 'The check has started. Refresh in a minute to see the results.' : 'Checked.')));
    if (r.ok) reload();
  };
  return (
    <div className="adlk">
      <div className="adlk-tabs" role="tablist">
        {[['links', 'Links and listings'], ['videos', 'Product videos']].map(([k, l]) => <button type="button" role="tab" aria-selected={tab === k} key={k} className={'adlk-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{tr(l)}</button>)}
      </div>
      {tab === 'links' ? (
        <section className="a-card adlk-sec">
          <p className="adseo-hint">{tr('Where else on the web is your shop listed or linked? Each listing helps Google trust you. Keep your name, address and phone identical everywhere.')}</p>
          <div className="adlk-checkall">
            <button type="button" className="a-btn" disabled={!canLinks || busy} onClick={checkAll}>{busy ? tr('Starting...') : tr('Check all now')}</button>
            <span className="adlk-dim">{tr('Last full check: {when}', { when: d?.lastRunAt ? when(d.lastRunAt) : tr('Never') })}</span>
          </div>
          <Msg m={m} />
          <LkStats d={d} canEdit={canLinks} reload={reload} onFilter={setStatus} />
          <LkForm canEdit={canLinks} onAdded={reload} />
          <LkList status={status} setStatus={setStatus} canEdit={canLinks} tick={tick} onChanged={reload} onData={setD} />
        </section>
      ) : (
        <section className="a-card adlk-sec"><VdGrid canEdit={canVideos} /></section>
      )}
    </div>
  );
}
