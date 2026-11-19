import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../../api.js';
import { Badge, Empty, H2, Loading, acc } from './shared.jsx';

export default function Servicing() {
  const [rows, setRows] = useState(null);
  useEffect(() => { acc.get('/services').then(setRows).catch(() => setRows([])); }, []);
  return (
    <>
      <H2 right={<Link to="/services" className="ac-btn dark">Book new service</Link>}>Service requests</H2>
      <div className="ac-card ac-card-flush">
        {rows === null && <Loading />}
        {rows?.map(v => (
          <div key={v.id} className="ac-service-row">
            <div className="ac-service-info"><b>{v.type} <span className="ac-dim">· {v.id}</span></b><span>{v.model} — {v.issue}</span><span className="ac-muted">Preferred date: {v.date ? fmtDate(v.date) : '—'}</span></div>
            <Badge s={v.status} />
          </div>
        ))}
        {rows && !rows.length && <Empty size="plain">No service requests yet.</Empty>}
      </div>
    </>
  );
}
