import { useEffect, useState } from 'react';
import './services.css';
import { api } from '../../api.js';
import { useStore } from '../../store.jsx';
import ServicesHero from './ServicesHero.jsx';
import ServiceDetailsGrid from './ServiceDetailsGrid.jsx';
import ChargesTable from './ChargesTable.jsx';
import BookingCard from './BookingCard.jsx';

/** /services: offer, detail pages, price list, booking form and caution note. */
export default function Services() {
  const { site, user } = useStore();
  const [details, setDetails] = useState([]);
  useEffect(() => {
    let live = true;
    api.get('/pages?group=servicing').then(d => live && setDetails(d.pages)).catch(() => {});
    return () => { live = false; };
  }, []);
  return (
    <section className="sv sv-page">
      <ServicesHero />
      {details.length > 0 && <ServiceDetailsGrid details={details} />}
      <div className="sv-cols">
        <ChargesTable prices={site.svcPrices} />
        <BookingCard user={user} />
      </div>
      <div className="bn sv-caution">
        <span className="sv-caution-h">Caution / সতর্কতা</span>
        <span className="sv-caution-p">মানি রিসিপ্ট ছাড়া লেনদেন করবেন না · রিসিপ্টে কর্তৃপক্ষের সিল ও স্বাক্ষর বাধ্যতামূলক · টেকনিশিয়ানের পার্সোনাল নাম্বারে যোগাযোগ করবেন না · আমাদের কোন শাখা নেই।</span>
      </div>
    </section>
  );
}
