const Kpi = ({ n, label, sub }) => <div className="a-card adrv-kpi"><b>{n}</b><span>{label}</span>{sub && <span>{sub}</span>}</div>;

/** The four number cards and the two warning banners. */
export default function RvStatus({ q }) {
  const s = q.data;
  if (q.error) return <div className="adrv-banner" role="alert">{q.error}</div>;
  if (!s) return null;
  const c = s.counts || {}, r = s.rate || {}, l = s.last30 || {};
  return (
    <>
      {s.enabled === false && <div className="adrv-banner" role="status">Review requests are switched off: they start after you turn them on below.</div>}
      {s.mailReady === false && <div className="adrv-banner" role="status">{s.mailHint || 'E-mail is not set up: requests for customers with an e-mail address will wait. You can still send them by WhatsApp.'}</div>}
      <div className="adrv-strip">
        <Kpi n={r.sent ?? 0} label="Requests sent" sub={`${l.sent ?? 0} in the last 30 days`} />
        <Kpi n={r.reviewed ?? 0} label="Reviews received" sub={`${l.reviewed ?? 0} in the last 30 days`} />
        <Kpi n={(r.pct ?? 0) + ' %'} label="Conversion (reviews per request sent)" />
        <Kpi n={c.whatsappWaiting ?? 0} label="Waiting for WhatsApp" sub="Open each one and press Send in WhatsApp" />
      </div>
    </>
  );
}
