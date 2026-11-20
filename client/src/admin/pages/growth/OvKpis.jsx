import { NA, change, isNum, num } from './ovApi.js';
import { useT } from '../../i18n/lang.jsx';

function Kpi({ title, big, note, cls, page, go }) {
  const tr = useT();
  return (
    <button type="button" className="adov-kpi" onClick={() => go(page)}>
      <span className="adov-k">{tr(title)}</span>
      <span className="adov-big">{big === NA ? tr(NA) : big}</span>
      <span className={'adov-note ' + (cls || '')}>{tr(note)}</span>
    </button>
  );
}

/** (3) Six numbers; each opens its page. */
export default function OvKpis({ d, go }) {
  const tr = useT();
  const s = d.search || {}, h = d.health || {}, ins = s.inspected;
  const live = s.connected !== false && s.cur;
  const clicks = live ? s.cur.clicks : null;
  const imp = live ? s.cur.impressions : null;
  const cc = change(s.delta?.clicks, { unit: '%', tr });
  const ic = change(s.delta?.impressions, { unit: '%', tr });
  const errs = h.schema?.counts?.error;
  const warns = h.schema?.counts?.warning;
  const feed = h.feed || {};
  const rv = h.reviews || {};
  return (
    <div className="adov-kpis">
      <Kpi title="Search clicks (28 days)" big={isNum(clicks) ? num(clicks) : NA} note={isNum(clicks) ? cc.text : 'Connect Google to see this'} cls={isNum(clicks) ? cc.cls : ''} page="growth-search" go={go} />
      <Kpi title="Impressions (28 days)" big={isNum(imp) ? num(imp) : NA} note={isNum(imp) ? ic.text : 'Connect Google to see this'} cls={isNum(imp) ? ic.cls : ''} page="growth-search" go={go} />
      <Kpi title="Pages indexed" big={ins && isNum(ins.indexed) ? num(ins.indexed) : NA} note={ins && isNum(ins.total) ? tr('of {total} checked', { total: num(ins.total) }) + (ins.notIndexed ? ', ' + tr('{n} not indexed', { n: num(ins.notIndexed) }) : '') : 'Not checked yet'} page="growth-search" go={go} />
      <Kpi title="Structured data errors" big={isNum(errs) ? num(errs) : NA} note={isNum(warns) ? tr('{n} warnings', { n: num(warns) }) : 'Not checked yet'} cls={errs > 0 ? 'adov-bad' : ''} page="growth-schema" go={go} />
      <Kpi title="Product feed items" big={isNum(feed.itemCount) ? num(feed.itemCount) : NA} note={feed.flagEnabled === false ? 'Feed is switched off' : 'Products sent to Google Shopping'} cls={feed.flagEnabled === false ? 'adov-bad' : ''} page="growth-merchant" go={go} />
      <Kpi title="Reviews waiting" big={isNum(rv.pending) ? num(rv.pending) : NA} note={rv.spam > 0 ? tr('{n} look like spam', { n: num(rv.spam) }) : 'Waiting for you to approve'} page="growth-reviews" go={go} />
    </div>
  );
}
