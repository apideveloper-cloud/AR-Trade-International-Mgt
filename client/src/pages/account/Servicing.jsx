import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../../api.js';
import { Badge, H2, Loading, acc } from './shared.jsx';

export default function Servicing() {
  const [rows, setRows] = useState(null);
  useEffect(() => { acc.get('/services').then(setRows).catch(() => setRows([])); }, []);
  return (
    <>
      <H2 right={<Link to="/services" className="ac-btn dark">Book new service</Link>}>Service requests</H2>
      <div className="ac-card ac-s9">
        {rows === null && <Loading />}
        {rows?.map(v => (
          <div key={v.id} className="ac-s69">
            <div className="ac-s70"><b>{v.type} <span className="ac-s15">· {v.id}</span></b><span>{v.model} — {v.issue}</span><span className="ac-s6">Preferred date: {v.date ? fmtDate(v.date) : '—'}</span></div>
            <Badge s={v.status} />
          </div>
        ))}
        {rows && !rows.length && <div className="ac-s46">No service requests yet.</div>}
      </div>
    </>
  );
}
