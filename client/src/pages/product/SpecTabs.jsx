import { useEffect, useState } from 'react';
import { cleanHtml } from '../../sanitize.js';
import { SPEC_ICON } from './productHelpers.js';
import DeliveryWarranty from './DeliveryWarranty.jsx';

/** Description / Specification / Delivery & warranty tabs. `resetKey` returns to the Specification tab when the product changes. */
export default function SpecTabs({ full, rows, dlv, site, resetKey }) {
  const [tab, setTab] = useState('spec');
  useEffect(() => { setTab('spec'); }, [resetKey]);
  const tabs = [...(full && (full.description || full.short) ? [['desc', 'Description']] : []), ['spec', 'Specification'], ['ship', 'Delivery & warranty']];
  return (
    <div className="ptabs2">
      <div className="bar2">{tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="body" key={tab}>
        {tab === 'desc' && full && <div className="bp-body pd-desc" dangerouslySetInnerHTML={{ __html: cleanHtml((full.short && !(full.description || '').includes(full.short.slice(0, 40)) ? full.short : '') + (full.description || '')) }} />}
        {tab === 'spec' && (
          <>
            <div className="spec2">{rows.map(([k, v]) => <div key={k} className={String(v).length > 34 ? 'wide' : undefined}><i>{SPEC_ICON[k] || '•'}</i><span><small>{k}</small><b>{v}</b></span></div>)}</div>
            <div className="spec-note"><i>i</i>Please confirm your existing toner model matches before ordering.</div>
          </>
        )}
        {tab === 'ship' && <DeliveryWarranty dlv={dlv} site={site} />}
      </div>
    </div>
  );
}
