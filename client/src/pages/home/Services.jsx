import { Link } from 'react-router-dom';
import { fmt } from '../../api.js';
import { SVC_IMGS } from '../../data.js';
import { useStore } from '../../store.jsx';
import useReveal from '../../useReveal.js';

/** Servicing and repair banner with three service cards. */
export default function Services() {
  const { site } = useStore();
  const reveal = useReveal();
  const cards = [
    ['Printer servicing', 'LASER · INKJET · DOT', 'Cleaning, roller & fuser fixes, part replacement for any brand.', site.svcPrices[0].offer],
    ['Photocopier servicing', 'OFFICE CONTRACTS', 'Indoor and outdoor maintenance plans for offices and institutions.', site.svcPrices[1].offer],
    ['Install & networking', 'SETUP', 'Printer installation, sharing and network setup for your team.', site.svcPrices[3].offer]
  ];
  return (
    <section className="sec">
      <div className="svc" ref={reveal}>
        <span className="grid-bg" />
        <div className="head">
          <div>
            <span className="k">04 · SERVICING &amp; REPAIR</span>
            <h2>We fix what we sell.</h2>
            <p>Trained engineers for every major brand — HP, Canon, Samsung, Epson, Lexmark and Brother. On-site visits across Dhaka or bring it to our Santinagar house.</p>
          </div>
          <div className="svc-aside">
            <div className="free-badge"><b className="big">FREE</b><span><b>Every Saturday</b><span>Laser printer servicing · parts extra</span></span></div>
            <div className="svc-cta">
              <Link to="/services" className="svc-btn pri">Book a technician <i>→</i></Link>
              <Link to="/services" className="svc-btn ghost">See price list</Link>
            </div>
          </div>
        </div>
        <div className="svc-cards">
          {cards.map(([t, tag, d, from], k) => (
            <Link key={t} to="/services" className="svc-card" style={{ '--i': k }}>
              <div className="bg" style={{ backgroundImage: `url('${SVC_IMGS[k]}')` }} /><div className="shade" />
              <span className="tg">{tag}</span><em className="no">{String(k + 1).padStart(2, '0')}</em>
              <div className="body"><span className="t">{t}</span><span className="d">{d}</span><div className="ft"><span>From <b>{fmt(from)}</b></span><i>→</i></div></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
