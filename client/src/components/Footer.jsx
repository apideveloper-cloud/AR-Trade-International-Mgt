import { Link } from 'react-router-dom';
import { DEFAULT_FOOTER, DEFAULT_MENUS, withDefaults } from '../data.js';
import Brand from './Brand.jsx';
import SocialIcon from './footer/SocialIcon.jsx';
import { useStore } from '../store.jsx';
import { openChat } from './Chat.jsx';
import './footer/footer-extra.css';

/** Internal footer link. */
const L = ({ to, children }) => <Link to={to} className="lk">{children}</Link>;

/** Site footer: call-to-action, link columns, showroom details, payment/shipping logos and legal links. */
export default function Footer() {
  const { site, content } = useStore();
  const ft = withDefaults(DEFAULT_FOOTER, content.footer);
  const aboutLinks = content.menus && content.menus.about && content.menus.about.length ? content.menus.about : DEFAULT_MENUS.about;
  return (
    <footer className="footer">
      <span className="g1" /><span className="g2" />
      <div className="foot-in">
        <div className="foot-cta">
          <div className="l">
            <img src="/ar-icon-round.png" alt="AR Trade" />
            <div><b>{content.labels.needToner}</b><span className="ftx-note">Order before 2 PM for same-day delivery inside Dhaka.</span></div>
          </div>
          <div className="foot-acts">
            <button className="ghost" onClick={openChat}>💬 Start live chat</button>
            <a className="call" href="tel:+8801977554401">☏ Call {site.phone}</a>
          </div>
        </div>
        <div className="foot-grid">
          <div className="col">
            <Brand size={48} />
            <p className="ftx-tagline">{ft.tagline}</p>
            <div className="socials">{Object.entries(content.social).map(([k, href]) => <SocialIcon key={k} name={k} href={href} />)}</div>
          </div>
          <div className="col">
            <h5>SHOP</h5>
            <L to="/shop/toner">Toner &amp; cartridge</L><L to="/shop/copier-toner">Copier toner</L><L to="/shop/ink">Ink &amp; bottles</L><L to="/shop/printer">Printers</L>
            <L to="/offers">Offers</L><L to="/compare">Compare products</L><L to="/wishlist">Wishlist</L>
          </div>
          <div className="col">
            <h5>ABOUT US</h5>
            {aboutLinks.map(l => (l.href
              ? <a key={l.t} href={l.href} target="_blank" rel="noreferrer" className="lk">{l.t} <span className="ftx-ext">↗</span></a>
              : <L key={l.t} to={l.to}>{l.t}</L>))}
          </div>
          <div className="col">
            <h5>HELP &amp; ACCOUNT</h5>
            <L to="/services">Servicing</L><L to="/contact">Contact</L><L to="/account">My account</L><L to="/track">Track order</L><L to="/faq">FAQ</L><L to="/blog">Blog</L>
          </div>
          <div className="col ftx-showroom">
            <h5>SHOWROOM</h5>
            <span className="foot-info"><i>⌖</i>{site.address}</span>
            <span className="foot-info ftx-hours"><i>◷</i>{ft.hours}</span>
            <a href="tel:+8801977554401" className="foot-info ftx-phone"><i>☏</i>{site.phone}</a>
            <a href={'mailto:' + site.email} className="foot-info"><i>@</i>{site.email}</a>
          </div>
        </div>
        <div className="pay-row">
          <div><span>WE ACCEPT</span><img src="/api/uploads/site/bank-account.webp" alt="Payment methods: bKash, Rocket, Nagad, Bank transfer" loading="lazy" /></div>
          <div><span>SHIPPING PARTNERS</span><img src="/api/uploads/site/shipping-partners.webp" alt="Shipping partners: RedX, SA Paribahan, Steadfast, Sundarban" loading="lazy" /></div>
        </div>
        <div className="foot-bot">
          <span className="copy">© 2011–{new Date().getFullYear()} AR Trade International. All rights reserved.</span>
          <span className="dev-by">Dev By: <b className="ftx-dev">Eng. A T M Faruque</b></span>
          <div className="legal">
            <Link to="/policy/privacy">Privacy</Link><Link to="/policy/terms">Terms</Link><Link to="/policy/returns">Returns</Link><Link to="/policy/shipping">Shipping</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
