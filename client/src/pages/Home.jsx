import CategoryRails from '../components/CategoryRails.jsx';
import ClientLogos from '../components/ClientLogos.jsx';
import { useStore } from '../store.jsx';
import Brands from './home/Brands.jsx';
import Categories from './home/Categories.jsx';
import Fresh from './home/Fresh.jsx';
import Hero from './home/Hero.jsx';
import HeroSide from './home/HeroSide.jsx';
import Offer from './home/Offer.jsx';
import Popular from './home/Popular.jsx';
import PriceAlert from './home/PriceAlert.jsx';
import Services from './home/Services.jsx';
import './home/home.css';

/** Storefront home page: hero, perks, category/product sections (each toggled from Admin), brands, clients, price alert. */
export default function Home() {
  const { content, site } = useStore();
  const sec = content.sections;
  return (
    <div className="hm-page">
      <section className="hero-row">
        <Hero />
        <HeroSide />
      </section>
      {sec.perks && (
        <section className="sec hm-pt-16">
          <div className="perks">
            {content.perks.map(p => <div className="perk" key={p.t}><span className="ic">{p.ic}</span><div><b>{p.t}</b><span>{p.d}</span></div></div>)}
          </div>
        </section>
      )}
      {sec.categories && <Categories />}
      {sec.popular && <Popular />}
      <CategoryRails />
      {sec.offer && site.showOffer !== false && <Offer />}
      {sec.fresh && <Fresh />}
      {sec.services && <Services />}
      {sec.brands && <Brands />}
      {sec.clients !== false && <section className="sec hm-pt-36"><ClientLogos variant="marquee" eyebrow="TRUSTED BY" title="Our corporate clients" /></section>}
      {sec.alert && <PriceAlert />}
    </div>
  );
}
