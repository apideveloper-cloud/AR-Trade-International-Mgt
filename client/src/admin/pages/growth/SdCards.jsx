import { NA, isNum, num, when } from './ovApi.js';
import { useT } from '../../i18n/lang.jsx';
import { Rich } from './parts.jsx';

/** Plain-English explanation of the check, with the biggest current problem named. */
function Note({ d }) {
  const tr = useT();
  const r = d.lastRun;
  const top = [...(d.byCode || [])].sort((a, b) => b.count - a.count)[0];
  return (
    <div className="adov-note">
      <h4>{tr('What is this check?')}</h4>
      <p>
        <Rich text={tr('Behind every page of your shop there is hidden information that Google reads: the price, whether the item is in stock, the star rating, your address and phone. When this information is complete, Google can show <b>prices, stars and your shop details</b> right in the search results, and more people click.')} />{' '}
        {tr('This check visits every page of your shop the way Google does{last}: the home page, categories, brands, blog, information pages and all products. It looks for missing or wrong details.', { last: r ? ' ' + tr('({n} pages last time)', { n: num(r.checked) }) : '' })}
      </p>

      <h4>{tr('How to read the results')}</h4>
      <ul>
        <li><b className="adov-bad">✖ {tr('Error')}</b>: <Rich text={tr('important information is missing, so Google may <b>not</b> show a price or stars for that page. Fix these first.')} /></li>
        <li><b>⚠ {tr('Warning')}</b>: {tr('a helpful extra detail is missing (for example a brand or a barcode). The page still works; fixing it can help a little.')}</li>
      </ul>

      <h4>{tr('What should I do?')}</h4>
      <ol>
        <li><Rich text={tr('Press <b>Check now</b>. It takes about a minute and shows its progress.')} /></li>
        <li><Rich text={tr('Under <b>Problems found</b> each line tells you what is wrong and what to do. Press a line to see only those pages.')} /></li>
        <li>{tr('Open the product or page in the admin and fix it.')}</li>
        <li><Rich text={tr('Press <b>Check now</b> again to confirm that the problem is gone.')} /></li>
      </ol>

      {top && (
        <p className="adov-note-top">
          <b>{tr(top.count === 1 ? 'Biggest problem right now ({n} page):' : 'Biggest problem right now ({n} pages):', { n: num(top.count) })}</b> {tr(top.label)} {top.hint && <><b>{tr('What to do:')}</b> {tr(top.hint)}</>}
        </p>
      )}
      <p className="adseo-hint">{tr('The check also runs by itself every night, so you do not have to remember it.')}</p>
    </div>
  );
}

/** Top cards, the explanation and Check now. */
export default function SdCards({ d, busy, run, reload, loading, progress }) {
  const tr = useT();
  const r = d.lastRun, c = d.counts || {};
  return (
    <>
      <div className="adov-kpis">
        <div className="adov-kpi adov-static"><span className="adov-k">{tr('Pages checked')}</span><span className="adov-big">{r ? num(r.checked) : tr(NA)}</span></div>
        <div className="adov-kpi adov-static"><span className="adov-k">{tr('Errors')}</span><span className={'adov-big' + (c.error > 0 ? ' adov-bad' : '')}>{isNum(c.error) ? num(c.error) : tr(NA)}</span></div>
        <div className="adov-kpi adov-static"><span className="adov-k">{tr('Warnings')}</span><span className="adov-big">{isNum(c.warning) ? num(c.warning) : tr(NA)}</span></div>
        <div className="adov-kpi adov-static"><span className="adov-k">{tr('Last check')}</span><span className="adov-big adov-sm">{r ? when(r.at) : tr('Never')}</span></div>
      </div>
      <div className="a-card adov-sec">
        <div className="adov-top">
          <button type="button" className="a-btn" disabled={busy} onClick={run}>{busy ? tr('Checking…') : tr('Check now')}</button>
          <button type="button" className="a-btn sm" disabled={loading} onClick={() => reload()}>{tr('Refresh')}</button>
        </div>
        {progress}
        <Note d={d} />
      </div>
    </>
  );
}
