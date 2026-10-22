import { Link } from 'react-router-dom';
import { DEFAULT_FOOTER, DEFAULT_MENUS, withDefaults } from '../data.js';
import Brand from './Brand.jsx';
import { useStore } from '../store.jsx';
import { openChat } from './Chat.jsx';

const SOCIAL = {
  facebook: ['#1877f2', 'M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9H17l.6-4h-4.1V8.9c0-.6.3-.9.5-.9z'],
  linkedin: ['#0a66c2', 'M4.5 9.5h3v10h-3zM10 9.5h2.9v1.4c.5-.9 1.7-1.7 3.4-1.7 3 0 3.7 1.9 3.7 4.6v5.7h-3v-5c0-1.2-.1-2.6-1.7-2.6s-2.3 1.2-2.3 2.6v5H10z'],
  youtube: ['#ff0033', 'M10 8.5v7l6-3.5z'],
  x: ['#000', 'M5 4.5h4.2l3.5 4.8 4-4.8h2l-5.1 6 5.9 8.5h-4.2l-3.8-5.2-4.4 5.2h-2l5.5-6.5z']
};

function SocialIcon({ name, href }) {
  if (name === 'instagram') {
    return (
      <a href={href} target="_blank" rel="noreferrer" title="Instagram" aria-label="Instagram" style={{ background: 'linear-gradient(45deg,#f9a825,#e1306c 50%,#833ab4)' }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="17" cy="7" r="1.2" /></svg>
      </a>
    );
  }
  const [bg, d] = SOCIAL[name] || ['#333', ''];
  return (
    <a href={href} target="_blank" rel="noreferrer" title={name} aria-label={name} style={{ background: bg }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d={d} />{name === 'linkedin' && <circle cx="6" cy="6" r="1.8" />}</svg>
    </a>
  );
}

const L = ({ to, children }) => <Link to={to} className="lk">{children}</Link>;

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
            <img src="/api/uploads/site/ar-icon-round.png" alt="AR Trade" />
            <div><b>{content.labels.needToner}</b><span style={{ fontSize: 13.5 }}>Order before 2 PM for same-day delivery inside Dhaka.</span></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ghost" onClick={openChat}>Start live chat</button>
            <a className="call" href="tel:+8801977554401">☏ Call {site.phone}</a>
          </div>
        </div>
        <div className="foot-grid">
          <div className="col">
            <Brand size={48} />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, maxWidth: 300 }}>{ft.tagline}</p>
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
              ? <a key={l.t} href={l.href} target="_blank" rel="noreferrer" className="lk">{l.t} <span style={{ opacity: .6 }}>↗</span></a>
              : <L key={l.t} to={l.to}>{l.t}</L>))}
          </div>
          <div className="col">
            <h5>HELP &amp; ACCOUNT</h5>
            <L to="/services">Servicing</L><L to="/contact">Contact</L><L to="/account">My account</L><L to="/track">Track order</L><L to="/faq">FAQ</L><L to="/blog">Blog</L>
          </div>
          <div className="col" style={{ gap: 12, fontSize: 14, lineHeight: 1.5 }}>
            <h5>SHOWROOM</h5>
            <span className="foot-info"><i>⌖</i>{site.address}</span>
            <span className="foot-info" style={{ color: '#8f9bb8', fontSize: 13 }}><i>◷</i>{ft.hours}</span>
            <a href="tel:+8801977554401" className="foot-info" style={{ color: '#fff', fontWeight: 700 }}><i>☏</i>{site.phone}</a>
            <a href="mailto:info@artradeinternational.com" className="foot-info"><i>@</i>{site.email}</a>
          </div>
        </div>
        <div className="pay-row">
          <div><span>WE ACCEPT</span><img src="/api/uploads/site/bank-account.webp" alt="Payment methods: bKash, Rocket, Nagad, Bank transfer" loading="lazy" /></div>
          <div><span>SHIPPING PARTNERS</span><img src="/api/uploads/site/shipping-partners.webp" alt="Shipping partners: RedX, SA Paribahan, Steadfast, Sundarban" loading="lazy" /></div>
        </div>
        <div className="foot-bot">
          <span className="copy">© 2011–{new Date().getFullYear()} AR Trade International. All rights reserved.</span>
          <span className="dev-by">Dev By: <b style={{ color: '#fff', fontWeight: 700 }}>Eng. A T M Faruque</b></span>
          <div className="legal">
            <Link to="/policy/privacy">Privacy</Link><Link to="/policy/terms">Terms</Link><Link to="/policy/returns">Returns</Link><Link to="/policy/shipping">Shipping</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
