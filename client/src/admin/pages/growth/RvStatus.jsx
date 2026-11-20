import { useT } from '../../i18n/lang.jsx';

const Kpi = ({ n, label, sub }) => <div className="a-card adrv-kpi"><b>{n}</b><span>{label}</span>{sub && <span>{sub}</span>}</div>;

/** The four number cards and the two warning banners. */
export default function RvStatus({ q }) {
  const tr = useT();
  const s = q.data;
  if (q.error) return <div className="adrv-banner" role="alert">{tr(q.error)}</div>;
  if (!s) return null;
  const c = s.counts || {}, r = s.rate || {}, l = s.last30 || {};
  return (
    <>
      {s.enabled === false && <div className="adrv-banner" role="status">{tr('Review requests are switched off: they start after you turn them on below.')}</div>}
      {s.mailReady === false && <div className="adrv-banner" role="status">{tr(s.mailHint || 'E-mail is not set up: requests for customers with an e-mail address will wait. You can still send them by WhatsApp.')}</div>}
      <div className="adrv-strip">
        <Kpi n={r.sent ?? 0} label={tr('Requests sent')} sub={tr('{n} in the last 30 days', { n: l.sent ?? 0 })} />
        <Kpi n={r.reviewed ?? 0} label={tr('Reviews received')} sub={tr('{n} in the last 30 days', { n: l.reviewed ?? 0 })} />
        <Kpi n={(r.pct ?? 0) + ' %'} label={tr('Conversion (reviews per request sent)')} />
        <Kpi n={c.whatsappWaiting ?? 0} label={tr('Waiting for WhatsApp')} sub={tr('Open each one and press Send in WhatsApp')} />
      </div>
    </>
  );
}
